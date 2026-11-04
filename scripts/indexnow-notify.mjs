#!/usr/bin/env node
// indexnow-notify.mjs — tell IndexNow which canonical URLs changed between two production deploys of
// notes.junghanacs.com. Phase 1: run by the operator after a requested push and a successful Workers build.
// It never runs inside a build; nothing here is armed by environment variables.
//
//   stamp <publicDir>            build stage: write public/deploy.json (public commit/build ids only)
//   notify [--dry-run] [--wait-for <sha>] [--allow-large]
//                                read the canonical stamp, compute (baseline, live] and POST once
//   bootstrap --base <sha> [--rehearsal]
//                                first baseline on this host (refuses if a state already exists)
//   reset --base <sha> --confirm-current <sha> [--rehearsal]
//                                replace an existing baseline (must name the current one)
//   status [--rehearsal]         print the state and the last receipt
//   --origin/--endpoint (both loopback) make a notify a rehearsal with its own state namespace.
//
// Contract and exit codes: docs/deploy-cloudflare.md ("IndexNow 배포 후 통지").
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import yaml from "js-yaml"

export const HOST = "notes.junghanacs.com"
export const ORIGIN = `https://${HOST}`
// The key has one source: INDEXNOW_KEY in scripts/post-build.sh, which writes public/<key>.txt.
export function readKey(file = path.join(path.dirname(fileURLToPath(import.meta.url)), "post-build.sh")) {
  const m = fs.readFileSync(file, "utf8").match(/^INDEXNOW_KEY="([A-Za-z0-9-]{8,128})"$/m)
  if (!m) throw new Error(`INDEXNOW_KEY (8–128 of A-Za-z0-9-) not found in ${file}`)
  return m[1]
}
export const KEY = readKey()
export const STAMP_PATH = "/deploy.json"
export const ENDPOINT = "https://api.indexnow.org/indexnow"
export const MAX_URLS_PER_POST = 10000 // indexnow.org/documentation: "up to 10,000 URLs per post"
export const DEFAULT_CAP = 1000 // guard against a mass re-export turning into a whole-garden resubmission
export const COOLDOWN_MS = 10 * 60 * 1000 // indexnow.org/faq: wait at least 10 minutes before resubmitting
const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1000
// quartz.config.ts ignorePatterns (test-enforced lockstep). Quartz globs content/ with these as top-level names.
export const IGNORE_PATTERNS = ["test", "private", "tmp", "templates", ".obsidian"]
const MAIN_REF = "refs/remotes/origin/main"
const STAMP_KEYS = ["schema", "host", "commit", "branch", "build", "built_at", "clean"]
const SHA = /^[0-9a-f]{40}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const EXIT = {
  ok: 0,
  usage: 2,
  notReady: 10,
  precondition: 11,
  cooldown: 12,
  receivedPending: 20,
  rateLimited: 21,
  rejected: 22,
  unknown: 23,
  stateWriteFailed: 24,
}

class Stop extends Error {
  constructor(exit, outcome, message) {
    super(message)
    this.exit = exit
    this.outcome = outcome
  }
}

// ---------------------------------------------------------------------------------------------------
// Quartz slugs (quartz/util/path.ts, copied; parity is tested against the original with tsx).

function stripSlashes(s, onlyStripPrefix) {
  if (s.startsWith("/")) s = s.substring(1)
  if (!onlyStripPrefix && s.endsWith("/")) s = s.slice(0, -1)
  return s
}
function endsWith(s, suffix) {
  return s === suffix || s.endsWith("/" + suffix)
}
function trimSuffix(s, suffix) {
  if (endsWith(s, suffix)) s = s.slice(0, -suffix.length)
  return s
}
function getFileExtension(s) {
  return s.match(/\.[A-Za-z0-9]+$/)?.[0]
}
function sluggify(s) {
  return s
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, ""),
    )
    .join("/")
    .replace(/\/$/, "")
}
export function slugifyFilePath(fp, excludeExt) {
  fp = stripSlashes(fp)
  let ext = getFileExtension(fp)
  const withoutFileExt = fp.replace(new RegExp(ext + "$"), "")
  if (excludeExt || [".md", ".html", undefined].includes(ext)) ext = ""
  let slug = sluggify(withoutFileExt)
  if (endsWith(slug, "_index")) slug = slug.replace(/_index$/, "index")
  return slug + ext
}
export function simplifySlug(fp) {
  const res = stripSlashes(trimSuffix(fp, "index"), true)
  return res.length === 0 ? "/" : res
}
/** content-relative .md path → the sitemap <loc> Quartz emits for it (case preserved, encodeURI). */
export function urlForContentPath(rel) {
  const simple = simplifySlug(slugifyFilePath(rel))
  return simple === "/" ? `${ORIGIN}/` : `${ORIGIN}/${encodeURI(simple)}`
}
/** Not globbed by Quartz: a top-level ignore pattern, or any dot segment (its globby call uses dot: false). */
export function isIgnored(rel) {
  const segments = rel.split("/")
  return IGNORE_PATTERNS.includes(segments[0]) || segments.some((s) => s.startsWith("."))
}

// Quartz FrontMatter's YAML path (quartz/plugins/transformers/frontmatter.ts parseFrontmatter) and
// RemoveDrafts (draft === true || draft === "true"). Invalid YAML throws, as it fails the Quartz build.
export function isDraft(text) {
  const normalized = text.replace(/^\uFEFF/, "")
  const firstLineEnd = normalized.indexOf("\n")
  const firstLine = (firstLineEnd === -1 ? normalized : normalized.slice(0, firstLineEnd)).trimEnd()
  if (firstLine !== "---") return false
  const bodyStart = firstLineEnd + 1
  const closeMatch = /(^|\n)---\s*(\n|$)/.exec(normalized.slice(bodyStart))
  if (!closeMatch) return false
  const raw = normalized.slice(bodyStart, bodyStart + closeMatch.index + closeMatch[1].length)
  const data = yaml.load(raw, { schema: yaml.JSON_SCHEMA, json: true })
  const fm = data && typeof data === "object" && !Array.isArray(data) ? data : {}
  return fm.draft === true || fm.draft === "true"
}

// ---------------------------------------------------------------------------------------------------
// Parsing of what the canonical host serves.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
export function decodeXmlEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (m, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return String.fromCodePoint(cp)
    }
    if (!(e in ENTITIES)) throw new Error(`unknown XML entity ${m}`)
    return ENTITIES[e]
  })
}
/** Every <loc>, entity-decoded; each must be an https URL on HOST with no credentials or port. */
export function parseSitemap(xml) {
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => decodeXmlEntities(m[1].trim()))
  if (locs.length === 0) throw new Error("sitemap has no <loc>")
  for (const loc of locs) assertCanonicalUrl(loc)
  return new Set(locs)
}
export function assertCanonicalUrl(u) {
  let url
  try {
    url = new URL(u)
  } catch {
    throw new Error(`not a URL: ${u}`)
  }
  if (url.protocol !== "https:" || url.hostname !== HOST || url.port !== "" || url.username || url.password)
    throw new Error(`not on ${ORIGIN}: ${u}`)
  if (url.search || url.hash) throw new Error(`canonical URL carries a query or fragment: ${u}`)
}
export function parseStamp(text) {
  let s
  try {
    s = JSON.parse(text)
  } catch {
    throw new Error("deploy stamp is not JSON")
  }
  if (!s || typeof s !== "object" || Array.isArray(s)) throw new Error("deploy stamp is not an object")
  const keys = Object.keys(s).sort()
  if (keys.join() !== [...STAMP_KEYS].sort().join()) throw new Error(`deploy stamp keys are ${keys.join(",")}`)
  if (s.schema !== 1) throw new Error(`deploy stamp schema ${s.schema}`)
  if (typeof s.host !== "string" || !SHA.test(s.commit ?? "")) throw new Error("deploy stamp host/commit malformed")
  if (typeof s.branch !== "string" || s.branch === "") throw new Error("deploy stamp branch malformed")
  if (s.build !== null && !UUID.test(s.build)) throw new Error("deploy stamp build malformed")
  if (typeof s.built_at !== "string" || Number.isNaN(Date.parse(s.built_at))) throw new Error("deploy stamp built_at malformed")
  if (typeof s.clean !== "boolean") throw new Error("deploy stamp clean malformed")
  return s
}
export function keyBodyMatches(text) {
  return text === KEY || text === `${KEY}\n`
}

// ---------------------------------------------------------------------------------------------------
// Responses.

export function classifyResponse(status) {
  if (status === 200) return "accepted"
  if (status === 202) return "received-pending" // "URL received. IndexNow key validation pending."
  if (status === 429) return "rate-limited"
  if (status >= 300 && status < 500) return "rejected" // 3xx is not followed: nothing was received
  return "unknown" // 5xx and undocumented 2xx: the batch may or may not have been received
}
/** Retry-After as delta-seconds or IMF-fixdate (RFC 9110). Anything else is ignored (null). */
export function parseRetryAfter(value, nowMs) {
  if (value == null) return null
  const v = String(value).trim()
  if (/^\d+$/.test(v)) return Number(v) * 1000
  if (/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(v)) {
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return Math.max(0, t - nowMs)
  }
  return null
}
export function cooldownFor(outcome, retryAfterMs) {
  if (outcome === "rate-limited") return Math.min(Math.max(retryAfterMs ?? 0, COOLDOWN_MS), MAX_RETRY_AFTER_MS)
  if (outcome === "received-pending" || outcome === "unknown") return COOLDOWN_MS
  return 0
}
const OUTCOME_EXIT = {
  accepted: EXIT.ok,
  "received-pending": EXIT.receivedPending,
  "rate-limited": EXIT.rateLimited,
  rejected: EXIT.rejected,
  unknown: EXIT.unknown,
}
export function excerpt(text) {
  return text
    .replaceAll(KEY, "<key>")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300)
}

// ---------------------------------------------------------------------------------------------------
// git

function git(repo, args, opts = {}) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20, ...opts })
}
function gitOk(repo, args) {
  try {
    git(repo, args)
    return true
  } catch {
    return false
  }
}
const isCommit = (repo, sha) => SHA.test(sha) && gitOk(repo, ["cat-file", "-e", `${sha}^{commit}`])
const isAncestor = (repo, a, b) => gitOk(repo, ["merge-base", "--is-ancestor", a, b])
function resolveCommit(repo, rev) {
  try {
    return git(repo, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]).trim()
  } catch {
    throw new Stop(EXIT.precondition, "precondition", `not a commit in this repository: ${rev}`)
  }
}

/**
 * The notification set for (base, target]. A changed content .md is notified when it is published at
 * either end: at target the deployed sitemap decides (cross-checked against draft/ignore), at base the
 * draft flag and ignore patterns decide. So additions, edits, deletions, renames (D + A) and draft
 * transitions are covered; draft→draft, non-page files and code changes are not.
 */
export function computePlan({ repo, base, target, sitemap }) {
  const raw = git(repo, ["diff", "--name-status", "--no-renames", "-z", base, target, "--", "content/"])
  const parts = raw.split("\0").filter((p) => p !== "")
  const pages = []
  const skipped = { non_page: [], ignored: [], unpublished: [] }
  const show = (sha, file) => {
    try {
      return git(repo, ["show", `${sha}:${file}`])
    } catch (e) {
      throw new Error(`cannot read ${file} at ${sha.slice(0, 12)}: ${e.message.split("\n")[0]}`)
    }
  }
  const draftAt = (sha, file) => {
    try {
      return isDraft(show(sha, file))
    } catch (e) {
      throw new Stop(EXIT.precondition, "precondition", `frontmatter of ${file} at ${sha.slice(0, 12)}: ${e.message.split("\n")[0]}`)
    }
  }
  for (let i = 0; i < parts.length; i += 2) {
    const status = parts[i]
    const file = parts[i + 1]
    if (file === undefined || !/^[ADMT]$/.test(status)) throw new Error(`unexpected diff entry ${status} ${file}`)
    const rel = file.slice("content/".length)
    if (!rel.endsWith(".md")) {
      skipped.non_page.push(rel)
      continue
    }
    if (isIgnored(rel)) {
      skipped.ignored.push(rel)
      continue
    }
    const url = urlForContentPath(rel)
    const oldPublished = status !== "A" && !draftAt(base, file)
    const newExists = status !== "D"
    const newDraft = newExists ? draftAt(target, file) : null
    const inSitemap = sitemap.has(url)
    if (newExists && !newDraft && !inSitemap)
      throw new Stop(EXIT.precondition, "precondition", `${rel} is published at target but ${url} is not in the deployed sitemap`)
    if (inSitemap && (!newExists || newDraft))
      throw new Stop(EXIT.precondition, "precondition", `${url} is in the deployed sitemap but ${rel} is ${newExists ? "a draft" : "deleted"} at target`)
    const newPublished = inSitemap
    if (!oldPublished && !newPublished) {
      skipped.unpublished.push(rel)
      continue
    }
    pages.push({ path: rel, url, change: !oldPublished ? "added" : !newPublished ? "removed" : "modified" })
  }
  const urls = [...new Set(pages.map((p) => p.url))].sort()
  return { pages, skipped, urls }
}

export function batches(urls, size = MAX_URLS_PER_POST) {
  const out = []
  for (let i = 0; i < urls.length; i += size) out.push(urls.slice(i, i + size))
  return out
}

// ---------------------------------------------------------------------------------------------------
// HTTP

/** One request, no redirect following, bounded time; the body is cut at maxBytes (see `truncated`). */
async function request(fetchImpl, url, { method = "GET", headers = {}, body, maxBytes, timeoutMs }) {
  const res = await fetchImpl(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) })
  const chunks = []
  let size = 0
  let truncated = false
  if (res.body) {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        truncated = true
        await reader.cancel().catch(() => {})
        chunks.push(value.subarray(0, value.byteLength - (size - maxBytes)))
        break
      }
      chunks.push(value)
    }
  }
  const text = Buffer.concat(chunks).toString("utf8")
  return { status: res.status, headers: res.headers, text, truncated }
}

function cacheEvidence(h) {
  return { cf_cache_status: h.get("cf-cache-status"), age: h.get("age"), etag: h.get("etag") }
}

/** A GET whose transport failure (DNS, refused, timeout) means "cannot verify yet". A 200 body over the
 *  limit is refused too; other statuses are judged by the caller without reading the whole body. */
async function get(fetchImpl, url, opts, exit = EXIT.notReady, outcome = "not-ready") {
  let r
  try {
    r = await request(fetchImpl, url, opts)
  } catch (e) {
    throw new Stop(exit, outcome, `${url}: ${e.name === "TimeoutError" ? "timeout" : (e.cause?.code ?? e.message)}`)
  }
  if (r.status === 200 && r.truncated) throw new Stop(exit, outcome, `${url}: body exceeds ${opts.maxBytes} bytes`)
  return r
}

async function readStamp(fetchImpl, origin) {
  const url = `${origin}${STAMP_PATH}`
  const r = await get(fetchImpl, url, { headers: { "cache-control": "no-cache" }, maxBytes: 4096, timeoutMs: 20000 })
  if (r.status !== 200) throw new Stop(EXIT.notReady, "not-ready", `${url} answered ${r.status} (no deploy stamp)`)
  if (!(r.headers.get("content-type") ?? "").startsWith("application/json"))
    throw new Stop(EXIT.notReady, "not-ready", `${url} content-type ${r.headers.get("content-type")}`)
  try {
    return { stamp: parseStamp(r.text), cache: cacheEvidence(r.headers) }
  } catch (e) {
    throw new Stop(EXIT.notReady, "not-ready", `${url}: ${e.message}`)
  }
}

/**
 * stamp → sitemap → key file → stamp. Both stamp reads must agree. This narrows, but cannot exclude, a
 * deploy that lands between the reads or during the POST, or split traffic where both reads hit one
 * version: those are not detectable from outside.
 */
export async function verifyDeployment({ fetchImpl, origin }) {
  const first = await readStamp(fetchImpl, origin)
  const sitemapUrl = `${origin}/sitemap.xml`
  const sm = await get(fetchImpl, sitemapUrl, { maxBytes: 16 << 20, timeoutMs: 30000 })
  if (sm.status !== 200 || !/xml/.test(sm.headers.get("content-type") ?? ""))
    throw new Stop(EXIT.notReady, "not-ready", `${sitemapUrl} answered ${sm.status} ${sm.headers.get("content-type")}`)
  let sitemap
  try {
    sitemap = parseSitemap(sm.text)
  } catch (e) {
    throw new Stop(EXIT.precondition, "precondition", `${sitemapUrl}: ${e.message}`)
  }
  const keyUrl = `${origin}/${KEY}.txt`
  const k = await get(fetchImpl, keyUrl, { maxBytes: 1024, timeoutMs: 20000 }, EXIT.precondition, "precondition")
  const keyOk = k.status === 200 && (k.headers.get("content-type") ?? "").startsWith("text/plain") && keyBodyMatches(k.text)
  if (!keyOk) throw new Stop(EXIT.precondition, "precondition", `${keyUrl} answered ${k.status} ${k.headers.get("content-type")} without the exact key body`)
  const second = await readStamp(fetchImpl, origin)
  if (JSON.stringify(first.stamp) !== JSON.stringify(second.stamp))
    throw new Stop(EXIT.notReady, "not-ready", `deploy stamp changed during verification (${first.stamp.commit} → ${second.stamp.commit})`)
  return {
    stamp: first.stamp,
    sitemap,
    evidence: {
      stamp_url: `${ORIGIN}${STAMP_PATH}`,
      ...first.stamp,
      reads: [first.cache, second.cache],
      sitemap_locs: sitemap.size,
      key_url: `${ORIGIN}/${KEY}.txt`,
      key_status: k.status,
      key_matched: true,
    },
  }
}

async function waitForDeploy({ fetchImpl, origin, repo, sha, timeoutMs, intervalMs, sleep, log, now }) {
  const deadline = now() + timeoutMs
  for (;;) {
    let commit = null
    try {
      commit = (await readStamp(fetchImpl, origin)).stamp.commit
    } catch (e) {
      if (!(e instanceof Stop)) throw e
    }
    if (commit && (commit === sha || (isCommit(repo, commit) && isAncestor(repo, sha, commit)))) return commit
    if (now() + intervalMs > deadline)
      throw new Stop(EXIT.notReady, "not-ready", `canonical stamp is ${commit ?? "absent"}, not ${sha} or a descendant, after ${Math.round(timeoutMs / 1000)}s`)
    log(`[indexnow] waiting: canonical stamp ${commit ?? "absent"}, want ${sha.slice(0, 12)}`)
    await sleep(intervalMs)
  }
}

// ---------------------------------------------------------------------------------------------------
// State: <dir>/<stem>.json (baseline, cooldown), <stem>.attempts.jsonl (receipts), <stem>.lock, where the
// stem is the host for production and <host>.rehearsal for everything else. A run against a loopback host or
// endpoint, or with an injected fetch, is a rehearsal: its successes can never become the production baseline.

export const NAMESPACES = ["production", "rehearsal"]
/** production only for the canonical origin, the real endpoint and the real fetch together. */
export function namespaceFor({ origin = ORIGIN, endpoint = ENDPOINT, fetchImpl = globalThis.fetch } = {}) {
  return origin === ORIGIN && endpoint === ENDPOINT && fetchImpl === globalThis.fetch ? "production" : "rehearsal"
}
export function statePaths(dir, namespace = "production") {
  if (!NAMESPACES.includes(namespace)) throw new Error(`unknown state namespace ${namespace}`)
  const stem = namespace === "production" ? HOST : `${HOST}.rehearsal`
  return {
    dir,
    namespace,
    state: path.join(dir, `${stem}.json`),
    log: path.join(dir, `${stem}.attempts.jsonl`),
    lock: path.join(dir, `${stem}.lock`),
  }
}
export function defaultStateDir(env = process.env) {
  if (env.GARDEN_INDEXNOW_STATE_DIR) return env.GARDEN_INDEXNOW_STATE_DIR
  const base = env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state")
  return path.join(base, "garden-indexnow")
}
function readState(p) {
  if (!fs.existsSync(p.state)) return null
  let s
  try {
    s = JSON.parse(fs.readFileSync(p.state, "utf8"))
  } catch (e) {
    throw new Stop(EXIT.precondition, "precondition", `${p.state} is not readable JSON: ${e.message}`)
  }
  if (s.schema !== 1 || s.host !== HOST || !SHA.test(s.baseline?.commit ?? ""))
    throw new Stop(EXIT.precondition, "precondition", `${p.state} is malformed`)
  if (s.namespace !== p.namespace)
    throw new Stop(EXIT.precondition, "precondition", `${p.state} belongs to namespace ${s.namespace}, not ${p.namespace}`)
  return s
}
/** Atomic replace: write a sibling temp file, fsync, rename. */
export function writeState(p, state) {
  fs.mkdirSync(p.dir, { recursive: true, mode: 0o700 })
  const tmp = `${p.state}.${process.pid}.tmp`
  const fd = fs.openSync(tmp, "w", 0o600)
  try {
    fs.writeSync(fd, JSON.stringify(state, null, 2) + "\n")
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(tmp, p.state)
}
function appendLog(p, receipt) {
  fs.mkdirSync(p.dir, { recursive: true, mode: 0o700 })
  fs.appendFileSync(p.log, JSON.stringify(receipt) + "\n", { mode: 0o600 })
}
function takeLock(p) {
  fs.mkdirSync(p.dir, { recursive: true, mode: 0o700 })
  try {
    const fd = fs.openSync(p.lock, "wx", 0o600)
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }) + "\n")
    fs.closeSync(fd)
  } catch (e) {
    if (e.code !== "EEXIST") throw e
    const held = fs.readFileSync(p.lock, "utf8").trim()
    throw new Stop(EXIT.precondition, "locked", `${p.lock} is held (${held}); if that process is gone, remove the file`)
  }
  return () => {
    try {
      fs.rmSync(p.lock, { force: true })
    } catch (e) {
      console.error(`[indexnow] could not remove ${p.lock}: ${e.message}`)
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// Commands

function isLoopback(u) {
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(u).hostname)
  } catch {
    return false
  }
}

export async function notify(opts) {
  const {
    repo,
    stateDir,
    dryRun = false,
    base: baseFlag,
    waitFor,
    allowLarge = false,
    cap = DEFAULT_CAP,
    origin = ORIGIN,
    endpoint = ENDPOINT,
    mainRef = MAIN_REF,
    fetchImpl = fetch,
    now = () => Date.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    waitTimeoutMs = 15 * 60 * 1000,
    waitIntervalMs = 15000,
    log = (m) => console.error(m),
  } = opts
  // Overrides are all-loopback or none: a real host with a fake endpoint (or the reverse) is refused.
  if ((origin !== ORIGIN || endpoint !== ENDPOINT) && !(isLoopback(origin) && isLoopback(endpoint)))
    throw new Stop(EXIT.usage, "usage", "--origin/--endpoint are rehearsal-only: both must be loopback, or neither given")
  if (baseFlag && !dryRun) throw new Stop(EXIT.usage, "usage", "--base only shapes a --dry-run; use bootstrap or reset to set a baseline")

  const namespace = namespaceFor({ origin, endpoint, fetchImpl })
  const p = statePaths(stateDir, namespace)
  const receipt = { schema: 1, at: new Date(now()).toISOString(), mode: dryRun ? "dry-run" : "notify", namespace, host: HOST }
  let release = () => {}
  try {
    if (!dryRun) release = takeLock(p)
    const state = readState(p)
    let base
    if (baseFlag) base = resolveCommit(repo, baseFlag)
    else if (state) base = state.baseline.commit
    else throw new Stop(EXIT.precondition, "no-baseline", `no baseline in ${p.state}: run bootstrap --base <sha> (an operator decision)`)
    receipt.base = base
    receipt.base_source = baseFlag ? "flag" : "state"
    const cooling = state?.cooldown_until && Date.parse(state.cooldown_until) > now()
    if (cooling && !dryRun) throw new Stop(EXIT.cooldown, "cooldown", `cooldown until ${state.cooldown_until} (last: ${state.last?.outcome})`)
    if (cooling) receipt.cooldown_until = state.cooldown_until

    if (waitFor) {
      const want = resolveCommit(repo, waitFor)
      receipt.wait_for = want
      await waitForDeploy({ fetchImpl, origin, repo, sha: want, timeoutMs: waitTimeoutMs, intervalMs: waitIntervalMs, sleep, log, now })
    }
    const { stamp, sitemap, evidence } = await verifyDeployment({ fetchImpl, origin })
    receipt.deploy = evidence
    const target = stamp.commit
    receipt.target = target
    if (stamp.host !== HOST) throw new Stop(EXIT.precondition, "precondition", `stamp host ${stamp.host}`)
    if (stamp.branch !== "main") throw new Stop(EXIT.precondition, "precondition", `stamp branch ${stamp.branch}`)
    if (!stamp.clean) throw new Stop(EXIT.precondition, "precondition", "stamp says the build tree had tracked changes")
    if (!isCommit(repo, target)) throw new Stop(EXIT.precondition, "precondition", `deployed commit ${target} is not in this repository (git fetch origin)`)
    if (!isAncestor(repo, target, mainRef)) throw new Stop(EXIT.precondition, "precondition", `deployed commit ${target} is not on ${mainRef} (git fetch origin, or a non-main deploy)`)
    if (!isAncestor(repo, base, target))
      throw new Stop(EXIT.precondition, "precondition", `baseline ${base} is not an ancestor of deployed ${target} (rollback or rewrite: decide with reset)`)

    if (base === target) {
      receipt.outcome = "noop"
      receipt.reason = "deployed commit equals baseline"
      receipt.urls = []
      receipt.baseline_advanced = false
      return finish(receipt, EXIT.ok, dryRun ? null : p)
    }
    const plan = computePlan({ repo, base, target, sitemap })
    receipt.changes = {
      pages: plan.pages.length,
      added: plan.pages.filter((x) => x.change === "added").length,
      modified: plan.pages.filter((x) => x.change === "modified").length,
      removed: plan.pages.filter((x) => x.change === "removed").length,
      skipped: plan.skipped,
    }
    receipt.pages = plan.pages
    receipt.urls = plan.urls
    if (plan.urls.length > cap && !allowLarge)
      throw new Stop(EXIT.precondition, "too-large", `${plan.urls.length} URLs exceed the cap ${cap}; review, then rerun with --allow-large`)
    const groups = batches(plan.urls)
    receipt.batches = groups.map((g, i) => ({ n: i + 1, count: g.length, sha256: crypto.createHash("sha256").update(g.join("\n")).digest("hex") }))

    if (plan.urls.length === 0) {
      receipt.outcome = "noop"
      receipt.reason = "no notifiable URL in the range"
      if (dryRun) return finish(receipt, EXIT.ok)
      return advance(p, state, receipt, target, "noop")
    }
    if (dryRun) {
      receipt.outcome = "planned"
      receipt.endpoint = endpoint
      receipt.request_body = { host: HOST, key: "<key>", keyLocation: `${ORIGIN}/${KEY}.txt`, urlList: `<${plan.urls.length} urls>` }
      return finish(receipt, EXIT.ok)
    }

    // One attempt per batch; the first batch that is not 200 stops the run. No in-run resend.
    let outcome = "accepted"
    let retryAfterMs = null
    for (const [i, urlList] of groups.entries()) {
      const b = receipt.batches[i]
      const started = now()
      b.sent_at = new Date(started).toISOString()
      try {
        const r = await request(fetchImpl, endpoint, {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8", "user-agent": "garden-indexnow/1" },
          body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList }),
          maxBytes: 2048,
          timeoutMs: 30000,
        })
        b.http = r.status
        b.outcome = classifyResponse(r.status)
        b.retry_after = r.headers.get("retry-after")
        b.excerpt = excerpt(r.text)
        if (b.outcome === "rate-limited") retryAfterMs = parseRetryAfter(b.retry_after, now())
      } catch (e) {
        b.http = null
        b.outcome = "unknown"
        b.error = excerpt(e.name === "TimeoutError" ? "timeout" : String(e.cause?.code ?? e.message))
      }
      b.ms = now() - started
      if (b.outcome !== "accepted") {
        outcome = b.outcome
        break
      }
    }
    receipt.endpoint = endpoint
    if (outcome === "accepted") {
      receipt.outcome = "accepted"
      return advance(p, state, receipt, target, "accepted")
    }
    receipt.outcome = outcome
    receipt.baseline_advanced = false
    const wait = cooldownFor(outcome, retryAfterMs)
    if (wait > 0) receipt.cooldown_until = new Date(now() + wait).toISOString()
    try {
      writeState(p, { ...state, cooldown_until: receipt.cooldown_until ?? null, last: { at: receipt.at, outcome, target } })
      receipt.cooldown_recorded = wait > 0
    } catch (e) {
      // Baseline is untouched either way, but an unrecorded cooldown does not stop an immediate rerun.
      receipt.cooldown_recorded = false
      receipt.state_error = excerpt(e.message)
    }
    return finish(receipt, OUTCOME_EXIT[outcome], p)
  } catch (e) {
    if (!(e instanceof Stop)) throw e
    receipt.outcome = e.outcome
    receipt.error = e.message
    receipt.baseline_advanced = false
    return finish(receipt, e.exit, dryRun || e.outcome === "locked" ? null : p)
  } finally {
    release()
  }

  function advance(p, state, receipt, target, reason) {
    try {
      writeState(p, { schema: 1, namespace: p.namespace, host: HOST, baseline: { commit: target, set_at: receipt.at, reason }, cooldown_until: null, last: { at: receipt.at, outcome: reason, target } })
      receipt.baseline_advanced = true
      return finish(receipt, EXIT.ok, p)
    } catch (e) {
      // The POST was accepted; only the local record failed. A rerun resends this range once.
      receipt.baseline_advanced = false
      receipt.outcome = `${receipt.outcome}-state-write-failed`
      receipt.state_error = excerpt(e.message)
      return finish(receipt, EXIT.stateWriteFailed, p)
    }
  }
  function finish(receipt, exit, p) {
    receipt.exit = exit
    if (p) {
      try {
        appendLog(p, receipt)
      } catch (e) {
        receipt.log_error = excerpt(e.message)
      }
    }
    return { exit, receipt }
  }
}

export function bootstrap({ repo, stateDir, base, reset = false, confirmCurrent, namespace = "production", mainRef = MAIN_REF, now = () => Date.now() }) {
  const p = statePaths(stateDir, namespace)
  const receipt = { schema: 1, at: new Date(now()).toISOString(), mode: reset ? "reset" : "bootstrap", namespace, host: HOST }
  let release = () => {}
  try {
    release = takeLock(p)
    const state = readState(p)
    if (!reset && state) throw new Stop(EXIT.precondition, "precondition", `${p.state} already has baseline ${state.baseline.commit}; use reset`)
    if (reset && !state) throw new Stop(EXIT.precondition, "precondition", `no state to reset in ${p.state}; use bootstrap`)
    if (reset && confirmCurrent !== state.baseline.commit)
      throw new Stop(EXIT.precondition, "precondition", `--confirm-current must name the current baseline ${state.baseline.commit}`)
    const commit = resolveCommit(repo, base)
    if (!isAncestor(repo, commit, mainRef)) throw new Stop(EXIT.precondition, "precondition", `${commit} is not on ${mainRef}`)
    receipt.previous = state?.baseline.commit ?? null
    receipt.base = commit
    writeState(p, { schema: 1, namespace, host: HOST, baseline: { commit, set_at: receipt.at, reason: receipt.mode }, cooldown_until: state?.cooldown_until ?? null, last: state?.last ?? null })
    receipt.outcome = receipt.mode
    receipt.exit = EXIT.ok
    appendLog(p, receipt)
    return { exit: EXIT.ok, receipt }
  } catch (e) {
    if (!(e instanceof Stop)) throw e
    return { exit: e.exit, receipt: { ...receipt, outcome: e.outcome, error: e.message, exit: e.exit } }
  } finally {
    release()
  }
}

/** Build stage: public/deploy.json carries only the public commit and build identifiers. */
export function writeStamp({ repo, publicDir, env = process.env, now = () => Date.now() }) {
  const head = git(repo, ["rev-parse", "HEAD"]).trim()
  const ci = env.WORKERS_CI === "1"
  if (ci && env.WORKERS_CI_COMMIT_SHA !== head) throw new Error(`WORKERS_CI_COMMIT_SHA ${env.WORKERS_CI_COMMIT_SHA} is not HEAD ${head}`)
  const build = ci && UUID.test(env.WORKERS_CI_BUILD_UUID ?? "") ? env.WORKERS_CI_BUILD_UUID : null
  let branch = ci ? env.WORKERS_CI_BRANCH : ""
  if (!branch) branch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]).trim()
  const clean = git(repo, ["status", "--porcelain", "--untracked-files=no"]).trim() === ""
  const stamp = { schema: 1, host: HOST, commit: head, branch, build, built_at: new Date(now()).toISOString(), clean }
  parseStamp(JSON.stringify(stamp))
  fs.writeFileSync(path.join(publicDir, STAMP_PATH.slice(1)), JSON.stringify(stamp) + "\n")
  return stamp
}

// ---------------------------------------------------------------------------------------------------
// CLI

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const flags = { _: [] }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (!a.startsWith("--")) {
      flags._.push(a)
      continue
    }
    const name = a.slice(2)
    if (["dry-run", "allow-large", "rehearsal"].includes(name)) flags[name] = true
    else if (["base", "wait-for", "confirm-current", "state-dir", "origin", "endpoint", "timeout", "cap", "repo"].includes(name)) {
      if (rest[i + 1] === undefined) throw new Stop(EXIT.usage, "usage", `${a} needs a value`)
      flags[name] = rest[++i]
    } else throw new Stop(EXIT.usage, "usage", `unknown flag ${a}`)
  }
  return { cmd, flags }
}

function positiveInt(v, name) {
  if (!/^[1-9]\d*$/.test(v)) throw new Stop(EXIT.usage, "usage", `${name} must be a positive integer`)
  return Number(v)
}

async function main(argv) {
  const repoDefault = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  let cmd, flags
  try {
    ;({ cmd, flags } = parseArgs(argv))
  } catch (e) {
    console.error(`[indexnow] ${e.message}`)
    return EXIT.usage
  }
  const repo = flags.repo ?? repoDefault
  const stateDir = flags["state-dir"] ?? defaultStateDir()
  if (cmd === "stamp") {
    const stamp = writeStamp({ repo, publicDir: flags._[0] ?? "public" })
    console.log(`[indexnow] stamp ${STAMP_PATH} commit=${stamp.commit} branch=${stamp.branch} build=${stamp.build ?? "local"} clean=${stamp.clean}`)
    return EXIT.ok
  }
  let result
  if (cmd === "notify") {
    try {
      result = await notify({
        repo,
        stateDir,
        dryRun: !!flags["dry-run"],
        base: flags.base,
        waitFor: flags["wait-for"],
        allowLarge: !!flags["allow-large"],
        cap: flags.cap ? positiveInt(flags.cap, "--cap") : DEFAULT_CAP,
        origin: flags.origin ?? ORIGIN,
        endpoint: flags.endpoint ?? ENDPOINT,
        waitTimeoutMs: flags.timeout ? positiveInt(flags.timeout, "--timeout") * 1000 : undefined,
      })
    } catch (e) {
      if (!(e instanceof Stop)) throw e
      result = { exit: e.exit, receipt: { outcome: e.outcome, error: e.message } }
    }
  } else if (cmd === "bootstrap" || cmd === "reset") {
    if (!flags.base) {
      console.error(`[indexnow] ${cmd} needs --base <sha>`)
      return EXIT.usage
    }
    result = bootstrap({ repo, stateDir, base: flags.base, reset: cmd === "reset", confirmCurrent: flags["confirm-current"], namespace: flags.rehearsal ? "rehearsal" : "production" })
  } else if (cmd === "status") {
    const p = statePaths(stateDir, flags.rehearsal ? "rehearsal" : "production")
    let state
    try {
      state = readState(p)
    } catch (e) {
      console.error(`[indexnow] ${e.message}`)
      return e.exit ?? 1
    }
    const last = fs.existsSync(p.log) ? fs.readFileSync(p.log, "utf8").trim().split("\n").pop() : null
    console.log(JSON.stringify({ state_file: p.state, state, last: last ? JSON.parse(last) : null }, null, 2))
    return EXIT.ok
  } else {
    console.error("usage: indexnow-notify.mjs stamp <publicDir> | notify [--dry-run] [--wait-for <sha>] | bootstrap --base <sha> | reset --base <sha> --confirm-current <sha> | status")
    return EXIT.usage
  }
  console.log(JSON.stringify(result.receipt, null, 2))
  const r = result.receipt
  const warn = [r.state_error && `state not saved: ${r.state_error}`, r.log_error && `receipt not logged (keep this stdout): ${r.log_error}`].filter(Boolean)
  console.error(`[indexnow] ${r.namespace ?? "-"} ${r.outcome} exit=${result.exit} base=${r.base ?? "-"} target=${r.target ?? "-"} urls=${r.urls?.length ?? 0}${r.error ? ` — ${r.error}` : ""}${warn.length ? ` — ${warn.join("; ")}` : ""}`)
  return result.exit
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`[indexnow] FAILED ${e.stack ?? e}`)
      process.exit(1)
    },
  )
}
