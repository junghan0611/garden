// node --test scripts/indexnow-notify.test.mjs — every request goes to an injected fetch or a loopback
// server; nothing here reaches the canonical host or an IndexNow endpoint. Fixtures are throwaway repos.
// Slug/ignore parity with Quartz itself: npx tsx --test scripts/indexnow-notify.parity.test.mjs
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import {
  COOLDOWN_MS,
  DEFAULT_CAP,
  EXIT,
  HOST,
  IGNORE_PATTERNS,
  KEY,
  ORIGIN,
  batches,
  bootstrap,
  classifyResponse,
  computePlan,
  cooldownFor,
  decodeXmlEntities,
  excerpt,
  isDraft,
  isIgnored,
  keyBodyMatches,
  namespaceFor,
  notify,
  parseRetryAfter,
  parseSitemap,
  parseStamp,
  readKey,
  statePaths,
  urlForContentPath,
  writeStamp,
} from "./indexnow-notify.mjs"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, "indexnow-notify.mjs")
const tmp = (p = "indexnow-") => fs.mkdtempSync(path.join(os.tmpdir(), p))
const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" }).trim()
const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
  fs.writeFileSync(path.join(dir, rel), text)
}
const page = (title, { draft, body = "body" } = {}) =>
  `---\ntitle: "${title}"\n${draft === undefined ? "" : `draft: ${draft}\n`}---\n\n${body}\n`
const U = (p) => `${ORIGIN}/${p}`
const NOW = Date.parse("2026-11-04T05:00:00Z")

/** Base commit A and deploy commit B covering every change class; origin/main = B. */
function fixture() {
  const dir = tmp("indexnow-repo-")
  git(dir, "init", "-q", "-b", "main")
  write(dir, "content/index.md", page("home"))
  write(dir, "content/talks/index.md", page("talks"))
  write(dir, "content/notes/20250101T000000.md", page("modified"))
  write(dir, "content/notes/20250102T000000.md", page("deleted"))
  write(dir, "content/notes/20250103T000000.md", page("renamed"))
  write(dir, "content/notes/20250105T000000.md", page("draft to published", { draft: true }))
  write(dir, "content/notes/20250106T000000.md", page("published to draft"))
  write(dir, "content/notes/20250107T000000.md", page("draft to draft", { draft: '"true"' }))
  write(dir, "content/notes/20250109T000000.md", page("unchanged"))
  write(dir, "quartz/x.ts", "1\n")
  git(dir, "add", "-A")
  git(dir, "commit", "-q", "-m", "A")
  const A = git(dir, "rev-parse", "HEAD")
  write(dir, "content/index.md", page("home", { body: "v2" }))
  write(dir, "content/notes/20250101T000000.md", page("modified", { body: "v2" }))
  fs.rmSync(path.join(dir, "content/notes/20250102T000000.md"))
  git(dir, "mv", "content/notes/20250103T000000.md", "content/notes/20250104T000000.md")
  write(dir, "content/notes/20250105T000000.md", page("draft to published", { draft: false }))
  write(dir, "content/notes/20250106T000000.md", page("published to draft", { draft: true }))
  write(dir, "content/notes/20250107T000000.md", page("draft to draft", { draft: "true", body: "v2" }))
  write(dir, "content/notes/20250108T000000.md", page("new draft", { draft: true }))
  write(dir, "content/images/x.png", "png")
  write(dir, "content/tmp/x.md", page("ignored"))
  write(dir, "quartz/x.ts", "2\n")
  git(dir, "add", "-A")
  git(dir, "commit", "-q", "-m", "B")
  const B = git(dir, "rev-parse", "HEAD")
  git(dir, "update-ref", "refs/remotes/origin/main", B)
  return { dir, A, B }
}
const PUBLISHED_AT_B = [
  `${ORIGIN}/`,
  U("talks/"),
  U("notes/20250101T000000"),
  U("notes/20250104T000000"),
  U("notes/20250105T000000"),
  U("notes/20250109T000000"),
]
const EXPECTED_URLS = [
  `${ORIGIN}/`,
  U("notes/20250101T000000"),
  U("notes/20250102T000000"),
  U("notes/20250103T000000"),
  U("notes/20250104T000000"),
  U("notes/20250105T000000"),
  U("notes/20250106T000000"),
]
const sitemapXml = (locs) =>
  `<?xml version="1.0"?><urlset>${locs.map((l) => `<url>\n    <loc>${l.replaceAll("&", "&amp;")}</loc>\n  </url>`).join("")}</urlset>`
const stampFor = (commit, extra = {}) => ({
  schema: 1,
  host: HOST,
  commit,
  branch: "main",
  build: null,
  built_at: "2026-11-04T04:00:00.000Z",
  clean: true,
  ...extra,
})

/** An injected fetch that plays the canonical host and the endpoint. */
function fakeNet({ stamps, sitemap = PUBLISHED_AT_B, key, post = () => ({ status: 200 }) }) {
  const calls = []
  const posts = []
  let stampReads = 0
  const fetchImpl = async (url, init) => {
    calls.push(`${init.method ?? "GET"} ${url}`)
    assert.equal(init.redirect, "manual")
    assert.ok(init.signal, "every request is time-bounded")
    if (url === "https://api.indexnow.org/indexnow") {
      posts.push({ headers: init.headers, body: JSON.parse(init.body) })
      const r = post(posts.length)
      if (r instanceof Error) throw r
      return new Response(r.body ?? "", { status: r.status, headers: r.headers ?? {} })
    }
    if (url === `${ORIGIN}/deploy.json`) {
      const s = stamps[Math.min(stampReads++, stamps.length - 1)]
      if (s === null) return new Response(`<html>${"x".repeat(6000)}</html>`, { status: 404, headers: { "content-type": "text/html" } })
      return new Response(JSON.stringify(s), { status: 200, headers: { "content-type": "application/json" } })
    }
    if (url === `${ORIGIN}/sitemap.xml`)
      return new Response(sitemapXml(sitemap), { status: 200, headers: { "content-type": "application/xml" } })
    if (url === `${ORIGIN}/${KEY}.txt`) {
      const k = key ?? { status: 200, type: "text/plain", body: `${KEY}\n` }
      return new Response(k.body, { status: k.status, headers: { "content-type": k.type, ...(k.headers ?? {}) } })
    }
    throw new Error(`unexpected request ${url}`)
  }
  return { fetchImpl, calls, posts }
}
const quiet = () => {}
// An injected fetch always makes a rehearsal, so these runs read and write the rehearsal namespace.
const NS = "rehearsal"
function ready({ withState = true } = {}) {
  const fx = fixture()
  const stateDir = tmp("indexnow-state-")
  if (withState) assert.equal(bootstrap({ repo: fx.dir, stateDir, base: fx.A, namespace: NS }).exit, EXIT.ok)
  return { ...fx, stateDir, p: statePaths(stateDir, NS) }
}
const state = (p) => JSON.parse(fs.readFileSync(p.state, "utf8"))
const logLines = (p) => (fs.existsSync(p.log) ? fs.readFileSync(p.log, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [])
const run = (fx, net, opts = {}) =>
  notify({ repo: fx.dir, stateDir: fx.stateDir, fetchImpl: net.fetchImpl, now: () => NOW, log: quiet, ...opts })

// ---------------------------------------------------------------------------------------------------
// URL mapping, drafts, parsing

test("content path → canonical URL keeps the Denote uppercase T and Quartz slug rules", () => {
  assert.equal(urlForContentPath("notes/20250727T094722.md"), U("notes/20250727T094722"))
  assert.equal(urlForContentPath("journal/20251103T000000.md"), U("journal/20251103T000000"))
  assert.equal(urlForContentPath("index.md"), `${ORIGIN}/`)
  assert.equal(urlForContentPath("talks/index.md"), U("talks/"))
  assert.equal(urlForContentPath("talks/_index.md"), U("talks/"))
  assert.equal(urlForContentPath("notes/a b&c%d?e#f.md"), U("notes/a-b-and-c-percentdef"))
  assert.equal(urlForContentPath("notes/심학 십도.md"), U(encodeURI("notes/심학-십도")))
  assert.equal(urlForContentPath("notes/v1.2.md"), U("notes/v1.2"))
})

test("ignore patterns are top-level names under content/", () => {
  for (const name of IGNORE_PATTERNS) assert.ok(isIgnored(`${name}/x.md`))
  assert.ok(!isIgnored("notes/tmp/x.md"))
  assert.ok(isIgnored("notes/.hidden.md") && isIgnored(".foo/x.md"))
  assert.ok(!isIgnored("notes/20250101T000000.md"))
})

test("draft flag follows Quartz FrontMatter (JSON schema YAML) + RemoveDrafts", () => {
  assert.equal(isDraft(page("x", { draft: true })), true)
  assert.equal(isDraft(page("x", { draft: '"true"' })), true)
  assert.equal(isDraft(page("x", { draft: "True" })), true)
  assert.equal(isDraft(page("x", { draft: '"True"' })), false)
  assert.equal(isDraft(page("x", { draft: "yes" })), false)
  assert.equal(isDraft(page("x", { draft: false })), false)
  assert.equal(isDraft(page("x")), false)
  assert.equal(isDraft("no frontmatter\ndraft: true\n"), false)
  assert.equal(isDraft("\uFEFF---\ndraft: true\n---\n"), true)
  assert.equal(isDraft("+++\ndraft = true\n+++\n"), false)
  assert.equal(isDraft("---\ndraft: true\n"), false, "unclosed frontmatter is ignored by Quartz")
  assert.throws(() => isDraft("---\ndraft: [unclosed\n---\n"))
})

test("sitemap: entities decoded, every loc must be https on the canonical host", () => {
  const set = parseSitemap(sitemapXml([U("notes/a&b"), `${ORIGIN}/`]))
  assert.ok(set.has(U("notes/a&b")))
  assert.equal(decodeXmlEntities("a&#38;b&#x26;c&lt;"), "a&b&c<")
  assert.throws(() => decodeXmlEntities("&nbsp;"))
  for (const bad of [
    "http://notes.junghanacs.com/x",
    "https://notes.junghanacs.com.evil.example/x",
    "https://evil.example/notes.junghanacs.com/x",
    "https://u:p@notes.junghanacs.com/x",
    "https://notes.junghanacs.com:8443/x",
    "https://notes.junghanacs.com/x?q=1",
  ])
    assert.throws(() => parseSitemap(sitemapXml([bad])), undefined, bad)
  assert.throws(() => parseSitemap("<urlset></urlset>"))
})

test("stamp: exact key set and formats", () => {
  const sha = "a".repeat(40)
  assert.deepEqual(parseStamp(JSON.stringify(stampFor(sha))), stampFor(sha))
  assert.ok(parseStamp(JSON.stringify(stampFor(sha, { build: "0123abcd-0123-4567-89ab-0123456789ab" }))))
  assert.throws(() => parseStamp(JSON.stringify({ ...stampFor(sha), device: "x" })))
  assert.throws(() => parseStamp(JSON.stringify(stampFor("A".repeat(40)))))
  assert.throws(() => parseStamp(JSON.stringify(stampFor(sha, { build: "build-1" }))))
  assert.throws(() => parseStamp(JSON.stringify(stampFor(sha, { clean: "yes" }))))
  assert.throws(() => parseStamp("<!doctype html>"))
})

test("key body must be exactly the key (an SPA/HTML 200 never passes)", () => {
  assert.ok(keyBodyMatches(KEY))
  assert.ok(keyBodyMatches(`${KEY}\n`))
  for (const bad of [`${KEY}\r\n`, ` ${KEY}`, `${KEY}\n\n`, `<html>${KEY}</html>`, ""]) assert.ok(!keyBodyMatches(bad))
})

test("responses: 200 accepted, 202 pending, 429 rate-limited, 4xx/3xx rejected, rest unknown", () => {
  assert.equal(classifyResponse(200), "accepted")
  assert.equal(classifyResponse(202), "received-pending")
  assert.equal(classifyResponse(429), "rate-limited")
  for (const s of [301, 400, 403, 422]) assert.equal(classifyResponse(s), "rejected")
  for (const s of [204, 500, 503]) assert.equal(classifyResponse(s), "unknown")
})

test("Retry-After: delta-seconds and IMF-fixdate only; cooldown floors at 10 minutes, caps at 24 hours", () => {
  assert.equal(parseRetryAfter("120", NOW), 120000)
  assert.equal(parseRetryAfter(new Date(NOW + 1800e3).toUTCString(), NOW), 1800e3)
  for (const bad of ["soon", "-5", "1.5", "Wednesday, 04-Nov-26 05:30:00 GMT", ""]) assert.equal(parseRetryAfter(bad, NOW), null, bad)
  assert.equal(parseRetryAfter(null, NOW), null)
  assert.equal(cooldownFor("rate-limited", 60e3), COOLDOWN_MS)
  assert.equal(cooldownFor("rate-limited", 3600e3), 3600e3)
  assert.equal(cooldownFor("rate-limited", 9e9), 24 * 3600e3)
  assert.equal(cooldownFor("received-pending"), COOLDOWN_MS)
  assert.equal(cooldownFor("unknown"), COOLDOWN_MS)
  assert.equal(cooldownFor("rejected"), 0)
})

test("excerpt strips control/bidi characters, redacts the key, truncates", () => {
  const e = excerpt(`ok\u0000\u001b[31m\u202e${KEY}\n${"x".repeat(400)}`)
  assert.ok(!/[\u0000-\u001f\u202e]/.test(e))
  assert.ok(e.includes("<key>") && !e.includes(KEY))
  assert.equal(e.length, 300)
})

test("batches split at the 10,000-URL protocol limit", () => {
  const urls = Array.from({ length: 10001 }, (_, i) => U(`notes/${i}`))
  assert.deepEqual(batches(urls).map((b) => b.length), [10000, 1])
})

test("one key source: post-build.sh writes the file the notifier reads; ignore patterns match quartz.config.ts", () => {
  const postBuild = fs.readFileSync(path.join(HERE, "post-build.sh"), "utf8")
  assert.equal(postBuild.match(/^INDEXNOW_KEY="([^"]+)"$/m)?.[1], KEY)
  assert.ok(postBuild.includes('echo "$INDEXNOW_KEY" > "public/${INDEXNOW_KEY}.txt"'))
  const bad = path.join(tmp(), "post-build.sh")
  fs.writeFileSync(bad, 'INDEXNOW_KEY="short"\n')
  assert.throws(() => readKey(bad), /not found/)
  const config = fs.readFileSync(path.join(HERE, "..", "quartz.config.ts"), "utf8")
  const ignore = JSON.parse(config.match(/ignorePatterns:\s*(\[[^\]]*\])/)[1])
  assert.deepEqual(ignore, IGNORE_PATTERNS)
  assert.match(KEY, /^[A-Za-z0-9-]{8,128}$/)
})

// ---------------------------------------------------------------------------------------------------
// Change set

test("plan covers add, modify, delete, rename, draft transitions, home; skips draft→draft, non-page, ignored", () => {
  const { dir, A, B } = fixture()
  const plan = computePlan({ repo: dir, base: A, target: B, sitemap: new Set(PUBLISHED_AT_B) })
  assert.deepEqual(plan.urls, EXPECTED_URLS)
  const by = Object.fromEntries(plan.pages.map((p) => [p.path, p.change]))
  assert.deepEqual(by, {
    "index.md": "modified",
    "notes/20250101T000000.md": "modified",
    "notes/20250102T000000.md": "removed",
    "notes/20250103T000000.md": "removed",
    "notes/20250104T000000.md": "added",
    "notes/20250105T000000.md": "added",
    "notes/20250106T000000.md": "removed",
  })
  assert.deepEqual(plan.skipped, {
    non_page: ["images/x.png"],
    ignored: ["tmp/x.md"],
    unpublished: ["notes/20250107T000000.md", "notes/20250108T000000.md"],
  })
})

test("plan fails closed when the deployed sitemap and the commit disagree", () => {
  const { dir, A, B } = fixture()
  const missing = new Set(PUBLISHED_AT_B.filter((u) => u !== U("notes/20250104T000000")))
  assert.throws(() => computePlan({ repo: dir, base: A, target: B, sitemap: missing }), /not in the deployed sitemap/)
  const extra = new Set([...PUBLISHED_AT_B, U("notes/20250106T000000")])
  assert.throws(() => computePlan({ repo: dir, base: A, target: B, sitemap: extra }), /is a draft at target/)
})

test("plan fails closed on unreadable frontmatter at the baseline (never 'unpublished')", () => {
  const dir = tmp("indexnow-repo-")
  git(dir, "init", "-q", "-b", "main")
  write(dir, "content/notes/20250101T000000.md", "---\ntitle: [broken\n---\n")
  git(dir, "add", "-A")
  git(dir, "commit", "-q", "-m", "A")
  const A = git(dir, "rev-parse", "HEAD")
  fs.rmSync(path.join(dir, "content/notes/20250101T000000.md"))
  git(dir, "commit", "-q", "-am", "B")
  const B = git(dir, "rev-parse", "HEAD")
  assert.throws(() => computePlan({ repo: dir, base: A, target: B, sitemap: new Set([`${ORIGIN}/`]) }), /frontmatter/)
})

// ---------------------------------------------------------------------------------------------------
// notify: sends, outcomes and the baseline

test("200: one POST with the exact body, baseline advances to the deployed commit, receipt logged", async () => {
  const fx = ready()
  const net = fakeNet({ stamps: [stampFor(fx.B)] })
  const { exit, receipt } = await run(fx, net)
  assert.equal(exit, EXIT.ok)
  assert.equal(net.posts.length, 1)
  assert.deepEqual(net.posts[0].body, { host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList: EXPECTED_URLS })
  assert.equal(net.posts[0].headers["content-type"], "application/json; charset=utf-8")
  assert.deepEqual(net.calls.slice(0, 4), [
    `GET ${ORIGIN}/deploy.json`,
    `GET ${ORIGIN}/sitemap.xml`,
    `GET ${ORIGIN}/${KEY}.txt`,
    `GET ${ORIGIN}/deploy.json`,
  ])
  assert.equal(receipt.outcome, "accepted")
  assert.equal(receipt.base, fx.A)
  assert.equal(receipt.target, fx.B)
  assert.equal(receipt.batches[0].http, 200)
  assert.equal(receipt.deploy.commit, fx.B)
  assert.equal(state(fx.p).baseline.commit, fx.B)
  assert.equal(state(fx.p).baseline.reason, "accepted")
  const last = logLines(fx.p).at(-1)
  assert.equal(last.outcome, "accepted")
  assert.deepEqual(last.urls, EXPECTED_URLS)
  assert.ok(!fs.existsSync(fx.p.lock))
})

test("202: received-pending, baseline kept, cooldown blocks an immediate resend, later resend is the same range", async () => {
  const fx = ready()
  let status = 202
  const net = fakeNet({ stamps: [stampFor(fx.B)], post: () => ({ status }) })
  const first = await run(fx, net)
  assert.equal(first.exit, EXIT.receivedPending)
  assert.equal(first.receipt.outcome, "received-pending")
  assert.equal(state(fx.p).baseline.commit, fx.A)
  assert.equal(state(fx.p).cooldown_until, new Date(NOW + COOLDOWN_MS).toISOString())
  const blocked = await run(fx, net)
  assert.equal(blocked.exit, EXIT.cooldown)
  assert.equal(net.posts.length, 1, "no POST during cooldown")
  status = 200
  const later = await run(fx, net, { now: () => NOW + COOLDOWN_MS + 1 })
  assert.equal(later.exit, EXIT.ok)
  assert.deepEqual(net.posts[1].body.urlList, net.posts[0].body.urlList)
  assert.equal(state(fx.p).baseline.commit, fx.B)
  assert.equal(state(fx.p).cooldown_until, null)
})

test("429: Retry-After (seconds or date) sets the cooldown; baseline kept; no in-run resend", async () => {
  for (const retryAfter of ["1800", new Date(NOW + 1800e3).toUTCString()]) {
    const fx = ready()
    const net = fakeNet({ stamps: [stampFor(fx.B)], post: () => ({ status: 429, headers: { "retry-after": retryAfter } }) })
    const { exit, receipt } = await run(fx, net)
    assert.equal(exit, EXIT.rateLimited)
    assert.equal(net.posts.length, 1)
    assert.equal(receipt.cooldown_until, new Date(NOW + 1800e3).toISOString())
    assert.equal(state(fx.p).baseline.commit, fx.A)
  }
})

test("400/403/422: rejected, no cooldown, baseline kept; reflected body is sanitized", async () => {
  for (const status of [400, 403, 422]) {
    const fx = ready()
    const net = fakeNet({ stamps: [stampFor(fx.B)], post: () => ({ status, body: `bad key ${KEY}\u001b[0m` }) })
    const { exit, receipt } = await run(fx, net)
    assert.equal(exit, EXIT.rejected, String(status))
    assert.equal(receipt.cooldown_until, undefined)
    assert.equal(receipt.batches[0].excerpt, "bad key <key> [0m")
    assert.equal(state(fx.p).baseline.commit, fx.A)
  }
})

test("5xx and transport errors are 'unknown' (maybe received), not failure-as-success; one attempt only", async () => {
  for (const post of [() => ({ status: 503 }), () => Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } })]) {
    const fx = ready()
    const net = fakeNet({ stamps: [stampFor(fx.B)], post })
    const { exit, receipt } = await run(fx, net)
    assert.equal(exit, EXIT.unknown)
    assert.equal(net.posts.length, 1)
    assert.equal(receipt.outcome, "unknown")
    assert.equal(receipt.baseline_advanced, false)
    assert.equal(state(fx.p).baseline.commit, fx.A)
    assert.ok(state(fx.p).cooldown_until)
  }
})

test("deploy unchanged (failed or not-yet deploy): canonical stamp equals baseline → noop, no POST", async () => {
  const fx = ready()
  const net = fakeNet({ stamps: [stampFor(fx.A)] })
  const { exit, receipt } = await run(fx, net)
  assert.equal(exit, EXIT.ok)
  assert.equal(receipt.outcome, "noop")
  assert.equal(net.posts.length, 0)
  assert.equal(state(fx.p).baseline.commit, fx.A)
})

test("no stamp on the canonical host (404 page larger than the stamp limit) → not-ready, no POST", async () => {
  const fx = ready()
  const net = fakeNet({ stamps: [null] })
  const { exit, receipt } = await run(fx, net)
  assert.equal(exit, EXIT.notReady)
  assert.match(receipt.error, /answered 404/)
  assert.equal(net.posts.length, 0)
})

test("an oversized 200 body is refused, not parsed", async () => {
  const fx = ready()
  const net = fakeNet({ stamps: [stampFor(fx.B)], key: { status: 200, type: "text/plain", body: KEY + " ".repeat(2000) } })
  const { exit, receipt } = await run(fx, net)
  assert.equal(exit, EXIT.precondition)
  assert.match(receipt.error, /exceeds 1024 bytes/)
  assert.equal(net.posts.length, 0)
})

test("preview/local stamps are refused: non-main branch, dirty tree, commit not on origin/main", async () => {
  const fx = ready()
  git(fx.dir, "update-ref", "refs/remotes/origin/main", fx.A)
  for (const [stamp, re] of [
    [stampFor(fx.B, { branch: "feat/x" }), /branch/],
    [stampFor(fx.B, { clean: false }), /tracked changes/],
    [stampFor(fx.B), /not on refs\/remotes\/origin\/main/],
    [stampFor("f".repeat(40)), /not in this repository/],
  ]) {
    const net = fakeNet({ stamps: [stamp] })
    const { exit, receipt } = await run(fx, net)
    assert.equal(exit, EXIT.precondition)
    assert.match(receipt.error, re)
    assert.equal(net.posts.length, 0)
  }
  assert.equal(state(fx.p).baseline.commit, fx.A)
})

test("key file: SPA HTML 200, wrong body, redirect, 404 all block the POST", async () => {
  const fx = ready()
  for (const key of [
    { status: 200, type: "text/html", body: "<!doctype html><title>garden</title>" },
    { status: 200, type: "text/plain", body: "something else\n" },
    { status: 301, type: "text/plain", body: "", headers: { location: "/" } },
    { status: 404, type: "text/html", body: "Not Found" },
  ]) {
    const net = fakeNet({ stamps: [stampFor(fx.B)], key })
    const { exit, receipt } = await run(fx, net)
    assert.equal(exit, EXIT.precondition, JSON.stringify(key))
    assert.match(receipt.error, /exact key body/)
    assert.equal(net.posts.length, 0)
  }
})

test("stamp changing between the two reads → not-ready, no POST", async () => {
  const fx = ready()
  const net = fakeNet({ stamps: [stampFor(fx.B), stampFor(fx.B, { built_at: "2026-11-04T04:05:00.000Z" })] })
  const { exit } = await run(fx, net)
  assert.equal(exit, EXIT.notReady)
  assert.equal(net.posts.length, 0)
})

test("off-host sitemap loc → precondition, no POST", async () => {
  const fx = ready()
  const net = fakeNet({ stamps: [stampFor(fx.B)], sitemap: [...PUBLISHED_AT_B, "https://evil.example/x"] })
  assert.equal((await run(fx, net)).exit, EXIT.precondition)
  assert.equal(net.posts.length, 0)
})

test("code-only range: no notifiable URL → noop, baseline advances, no POST", async () => {
  const fx = ready()
  write(fx.dir, "quartz/x.ts", "3\n")
  git(fx.dir, "commit", "-q", "-am", "C")
  const C = git(fx.dir, "rev-parse", "HEAD")
  git(fx.dir, "update-ref", "refs/remotes/origin/main", C)
  assert.equal(bootstrap({ repo: fx.dir, stateDir: fx.stateDir, namespace: NS, base: fx.B, reset: true, confirmCurrent: fx.A }).exit, EXIT.ok)
  const net = fakeNet({ stamps: [stampFor(C)] })
  const { exit, receipt } = await run(fx, net)
  assert.equal(exit, EXIT.ok)
  assert.equal(receipt.outcome, "noop")
  assert.equal(net.posts.length, 0)
  assert.equal(state(fx.p).baseline.commit, C)
})

test("cap: more URLs than the cap is refused without --allow-large", async () => {
  const fx = ready()
  const net = fakeNet({ stamps: [stampFor(fx.B)] })
  const { exit, receipt } = await run(fx, net, { cap: 3 })
  assert.equal(exit, EXIT.precondition)
  assert.equal(receipt.outcome, "too-large")
  assert.equal(net.posts.length, 0)
  assert.equal((await run(fx, net, { cap: 3, allowLarge: true })).exit, EXIT.ok)
  assert.equal(DEFAULT_CAP, 1000)
})

test("rollback/rewrite: baseline not an ancestor of the deployed commit → refused", async () => {
  const fx = ready()
  bootstrap({ repo: fx.dir, stateDir: fx.stateDir, namespace: NS, base: fx.B, reset: true, confirmCurrent: fx.A })
  const net = fakeNet({ stamps: [stampFor(fx.A)] })
  const { exit, receipt } = await run(fx, net)
  assert.equal(exit, EXIT.precondition)
  assert.match(receipt.error, /not an ancestor/)
})

test("--wait-for polls until the canonical stamp reaches the commit; timeout sends nothing", async () => {
  const fx = ready()
  const net = fakeNet({ stamps: [stampFor(fx.A), stampFor(fx.A), stampFor(fx.B)] })
  const slept = []
  const ok = await run(fx, net, { waitFor: fx.B, sleep: async (ms) => slept.push(ms), waitIntervalMs: 1000 })
  assert.equal(ok.exit, EXIT.ok)
  assert.equal(ok.receipt.wait_for, fx.B)
  assert.equal(ok.receipt.target, fx.B)
  assert.equal(slept.length, 2)

  const fx2 = ready()
  const net2 = fakeNet({ stamps: [stampFor(fx2.A)] })
  let t = NOW
  const late = await notify({
    repo: fx2.dir,
    stateDir: fx2.stateDir,
    fetchImpl: net2.fetchImpl,
    log: quiet,
    waitFor: fx2.B,
    waitTimeoutMs: 3000,
    waitIntervalMs: 1000,
    sleep: async (ms) => {
      t += ms
    },
    now: () => t,
  })
  assert.equal(late.exit, EXIT.notReady)
  assert.match(late.receipt.error, /after 3s/)
  assert.equal(net2.posts.length, 0)
  assert.equal(state(fx2.p).baseline.commit, fx2.A)
})

test("no baseline: refuses to send (no implicit full-garden submission)", async () => {
  const fx = ready({ withState: false })
  const net = fakeNet({ stamps: [stampFor(fx.B)] })
  const { exit, receipt } = await run(fx, net)
  assert.equal(exit, EXIT.precondition)
  assert.equal(receipt.outcome, "no-baseline")
  assert.equal(net.calls.length, 0)
})

test("bootstrap refuses an existing state; reset needs the current baseline named; --base only for dry-run", async () => {
  const fx = ready()
  assert.equal(bootstrap({ repo: fx.dir, stateDir: fx.stateDir, namespace: NS, base: fx.B }).exit, EXIT.precondition)
  assert.equal(bootstrap({ repo: fx.dir, stateDir: fx.stateDir, namespace: NS, base: fx.B, reset: true, confirmCurrent: fx.B }).exit, EXIT.precondition)
  assert.equal(state(fx.p).baseline.commit, fx.A)
  const net = fakeNet({ stamps: [stampFor(fx.B)] })
  await assert.rejects(run(fx, net, { base: fx.A }), (e) => e.exit === EXIT.usage)
  const r = bootstrap({ repo: fx.dir, stateDir: fx.stateDir, namespace: NS, base: fx.B, reset: true, confirmCurrent: fx.A })
  assert.equal(r.exit, EXIT.ok)
  assert.equal(r.receipt.previous, fx.A)
  assert.deepEqual(logLines(fx.p).map((l) => l.mode), ["bootstrap", "reset"])
})

test("dry-run: plans from --base without a state, sends nothing, writes nothing", async () => {
  const fx = ready({ withState: false })
  const net = fakeNet({ stamps: [stampFor(fx.B)] })
  const { exit, receipt } = await run(fx, net, { dryRun: true, base: fx.A })
  assert.equal(exit, EXIT.ok)
  assert.equal(receipt.outcome, "planned")
  assert.deepEqual(receipt.urls, EXPECTED_URLS)
  assert.equal(receipt.request_body.key, "<key>")
  assert.equal(net.posts.length, 0)
  assert.ok(!fs.existsSync(fx.p.state) && !fs.existsSync(fx.p.log))
})

test("lock: a concurrent run is refused and the holder's lock is left alone", async () => {
  const fx = ready()
  fs.writeFileSync(fx.p.lock, '{"pid":1}\n')
  const net = fakeNet({ stamps: [stampFor(fx.B)] })
  const { exit, receipt } = await run(fx, net)
  assert.equal(exit, EXIT.precondition)
  assert.equal(receipt.outcome, "locked")
  assert.ok(fs.existsSync(fx.p.lock))
  assert.equal(net.calls.length, 0)
})

test("200 then state write failure → distinct exit: sent, baseline not recorded, rerun may resend", async (t) => {
  if (process.getuid?.() === 0) return t.skip("root ignores directory permissions")
  const fx = ready()
  const net = fakeNet({
    stamps: [stampFor(fx.B)],
    post: () => {
      fs.chmodSync(fx.stateDir, 0o500)
      return { status: 200 }
    },
  })
  try {
    const { exit, receipt } = await run(fx, net)
    assert.equal(exit, EXIT.stateWriteFailed)
    assert.equal(receipt.outcome, "accepted-state-write-failed")
    assert.equal(receipt.baseline_advanced, false)
    assert.equal(receipt.batches[0].http, 200)
  } finally {
    fs.chmodSync(fx.stateDir, 0o700)
  }
  assert.equal(state(fx.p).baseline.commit, fx.A)
})

test("overrides: --origin needs loopback origin and endpoint; --endpoint must be loopback", async () => {
  const fx = ready()
  const net = fakeNet({ stamps: [stampFor(fx.B)] })
  await assert.rejects(run(fx, net, { origin: "http://127.0.0.1:9" }), (e) => e.exit === EXIT.usage)
  await assert.rejects(run(fx, net, { endpoint: "https://www.bing.com/indexnow" }), (e) => e.exit === EXIT.usage)
  // Real host with a fake endpoint: would have recorded a success no search engine received.
  await assert.rejects(run(fx, net, { endpoint: "http://127.0.0.1:9/indexnow" }), (e) => e.exit === EXIT.usage)
  await assert.rejects(run(fx, net, { origin: "http://127.0.0.1:9", endpoint: "https://api.indexnow.org/indexnow" }), (e) => e.exit === EXIT.usage)
  assert.equal(net.calls.length, 0)
  await assert.rejects(run(fx, net, { origin: "https://evil.example", endpoint: "http://127.0.0.1:9/x" }), (e) => e.exit === EXIT.usage)
})

// ---------------------------------------------------------------------------------------------------
// stamp writer and the CLI end to end (loopback server)

test("stamp: CI ids only, must match HEAD; local build has no build id", () => {
  const { dir, B } = fixture()
  const pub = tmp("indexnow-public-")
  const uuid = "0123abcd-0123-4567-89ab-0123456789ab"
  const s = writeStamp({ repo: dir, publicDir: pub, env: { WORKERS_CI: "1", WORKERS_CI_COMMIT_SHA: B, WORKERS_CI_BRANCH: "main", WORKERS_CI_BUILD_UUID: uuid, HOME: "/secret" } })
  const onDisk = JSON.parse(fs.readFileSync(path.join(pub, "deploy.json"), "utf8"))
  assert.deepEqual(onDisk, s)
  assert.deepEqual(Object.keys(onDisk), ["schema", "host", "commit", "branch", "build", "built_at", "clean"])
  assert.equal(onDisk.commit, B)
  assert.equal(onDisk.build, uuid)
  assert.equal(onDisk.clean, true)
  assert.throws(() => writeStamp({ repo: dir, publicDir: pub, env: { WORKERS_CI: "1", WORKERS_CI_COMMIT_SHA: "0".repeat(40) } }))
  write(dir, "quartz/x.ts", "dirty\n")
  const local = writeStamp({ repo: dir, publicDir: pub, env: {} })
  assert.equal(local.build, null)
  assert.equal(local.branch, "main")
  assert.equal(local.clean, false)
})

function serve(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler)
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }))
  })
}
function cli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { env: { ...process.env, ...env } })
    let out = ""
    let err = ""
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (err += d))
    child.on("close", (code) => resolve({ code, out, err }))
  })
}

test("CLI end to end against a loopback host and endpoint", async () => {
  const fx = ready()
  const posts = []
  const { server, base } = await serve((req, res) => {
    let body = ""
    req.on("data", (d) => (body += d))
    req.on("end", () => {
      if (req.method === "POST" && req.url === "/indexnow") {
        posts.push(JSON.parse(body))
        res.writeHead(200).end()
      } else if (req.url === "/deploy.json") {
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(stampFor(fx.B)))
      } else if (req.url === "/sitemap.xml") {
        res.writeHead(200, { "content-type": "application/xml" }).end(sitemapXml(PUBLISHED_AT_B))
      } else if (req.url === `/${KEY}.txt`) {
        res.writeHead(200, { "content-type": "text/plain" }).end(`${KEY}\n`)
      } else res.writeHead(404).end()
    })
  })
  try {
    const args = ["notify", "--repo", fx.dir, "--state-dir", fx.stateDir, "--origin", base, "--endpoint", `${base}/indexnow`]
    const dry = await cli([...args, "--dry-run"])
    assert.equal(dry.code, EXIT.ok, dry.err)
    assert.equal(JSON.parse(dry.out).outcome, "planned")
    assert.equal(posts.length, 0)
    const real = await cli(args)
    assert.equal(real.code, EXIT.ok, real.err)
    assert.equal(JSON.parse(real.out).outcome, "accepted")
    assert.deepEqual(posts[0].urlList, EXPECTED_URLS)
    assert.equal(posts[0].host, HOST)
    const again = await cli(args)
    assert.equal(again.code, EXIT.ok)
    assert.equal(JSON.parse(again.out).outcome, "noop")
    assert.equal(posts.length, 1)
    assert.equal(JSON.parse(real.out).namespace, "rehearsal")
    const status = await cli(["status", "--rehearsal", "--state-dir", fx.stateDir])
    assert.equal(JSON.parse(status.out).state.baseline.commit, fx.B)
    const prod = await cli(["status", "--state-dir", fx.stateDir])
    assert.equal(JSON.parse(prod.out).state, null, "a loopback success never reaches the production state")
    assert.equal((await cli(["notify", "--state-dir", fx.stateDir, "--origin", base])).code, EXIT.usage)
    assert.equal((await cli(["notify", "--bogus"])).code, EXIT.usage)
  } finally {
    server.close()
  }
})

test("namespace: production only for the canonical origin, the real endpoint and the real fetch", () => {
  assert.equal(namespaceFor(), "production")
  assert.equal(namespaceFor({ fetchImpl: async () => new Response("") }), "rehearsal")
  assert.equal(namespaceFor({ endpoint: "http://127.0.0.1:9/indexnow" }), "rehearsal")
  assert.equal(namespaceFor({ origin: "http://127.0.0.1:9" }), "rehearsal")
  const a = statePaths("/s", "production")
  const b = statePaths("/s", "rehearsal")
  for (const k of ["state", "log", "lock"]) assert.notEqual(a[k], b[k])
  assert.throws(() => statePaths("/s", "staging"))
})

test("a rehearsal success leaves the production baseline untouched", async () => {
  const fx = ready({ withState: false })
  const prod = statePaths(fx.stateDir, "production")
  assert.equal(bootstrap({ repo: fx.dir, stateDir: fx.stateDir, base: fx.A }).exit, EXIT.ok)
  const before = fs.readFileSync(prod.state, "utf8")
  const net = fakeNet({ stamps: [stampFor(fx.B)] })
  const none = await run(fx, net)
  assert.equal(none.receipt.outcome, "no-baseline", "the rehearsal namespace has its own (empty) state")
  assert.equal(bootstrap({ repo: fx.dir, stateDir: fx.stateDir, base: fx.A, namespace: NS }).exit, EXIT.ok)
  const ok = await run(fx, net)
  assert.equal(ok.exit, EXIT.ok)
  assert.equal(ok.receipt.namespace, "rehearsal")
  assert.equal(state(fx.p).baseline.commit, fx.B)
  assert.equal(fs.readFileSync(prod.state, "utf8"), before)
  assert.ok(!logLines(prod).some((l) => l.mode === "notify"))
})

test("a state file from the other namespace is refused, not adopted", async () => {
  const fx = ready()
  const prod = statePaths(fx.stateDir, "production")
  fs.copyFileSync(fx.p.state, prod.state)
  const r = bootstrap({ repo: fx.dir, stateDir: fx.stateDir, base: fx.B, reset: true, confirmCurrent: fx.A })
  assert.equal(r.exit, EXIT.precondition)
  assert.match(r.receipt.error, /belongs to namespace rehearsal/)
})

test("cooldown not saved after a non-200 is reported (no cooldown guarantee), baseline still kept", async (t) => {
  if (process.getuid?.() === 0) return t.skip("root ignores directory permissions")
  const fx = ready()
  const net = fakeNet({
    stamps: [stampFor(fx.B)],
    post: () => {
      fs.chmodSync(fx.stateDir, 0o500)
      return { status: 202 }
    },
  })
  try {
    const { exit, receipt } = await run(fx, net)
    assert.equal(exit, EXIT.receivedPending)
    assert.equal(receipt.cooldown_recorded, false)
    assert.ok(receipt.state_error)
  } finally {
    fs.chmodSync(fx.stateDir, 0o700)
  }
  assert.equal(state(fx.p).baseline.commit, fx.A)
  assert.equal(state(fx.p).cooldown_until ?? null, null)
})
