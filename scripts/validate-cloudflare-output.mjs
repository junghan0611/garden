#!/usr/bin/env node
// Independent gate for a Cloudflare Workers build output (scripts/build-cloudflare.sh).
// Reads only public/: the _headers rules, the sitemap and the files it names. Does not import Quartz.
// Usage: node scripts/validate-cloudflare-output.mjs [publicDir] --expect-commit <sha> [--require-clean]
// Contract: docs/deploy-cloudflare.md
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import { visit } from "unist-util-visit"

export const CANONICAL = "https://notes.junghanacs.com"
const MAX_FILES = 20000 // Workers Free: static asset files per version
const MAX_FILE_BYTES = 25 * 1024 * 1024 // per static asset file
const MAX_RULES = 100
const MAX_LINE = 2000

const JSONLD = [
  "/tags/autholog.jsonld",
  "/notes.jsonld",
  "/meta.jsonld",
  "/bib.jsonld",
  "/botlog.jsonld",
  "/journal.jsonld",
]
const HOUR = "public, max-age=3600"
const MUTABLE = "public, max-age=0, must-revalidate"
const DAY = "public, max-age=86400"
const IMMUTABLE = "public, max-age=31536000, immutable"
export const LINK = '</llms.txt>; rel="service-doc"; type="text/plain", </sitemap.xml>; rel="sitemap"; type="application/xml"'
// The header contract, rule by rule. Exact values, whitespace-insensitive; the deployed gate asserts the same.
const REQUIRED = [
  ["/*", "x-frame-options", "SAMEORIGIN"],
  ["/*", "x-content-type-options", "nosniff"],
  ["/*", "referrer-policy", "strict-origin-when-cross-origin"],
  ["/*", "permissions-policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()"],
  ["/*", "link", LINK],
  ["/llms.txt", "content-type", "text/plain; charset=utf-8"],
  ["/llms.txt", "cache-control", HOUR],
  ["/robots.txt", "content-type", "text/plain; charset=utf-8"],
  ["/robots.txt", "cache-control", HOUR],
  ...JSONLD.flatMap((p) => [
    [p, "content-type", "application/ld+json; charset=utf-8"],
    [p, "cache-control", HOUR],
  ]),
  ["/sitemap.xml", "cache-control", HOUR],
  ["/static/contentIndex.json", "cache-control", MUTABLE],
  ["/deploy.json", "cache-control", MUTABLE],
  [`${CANONICAL}/deploy.json`, "x-robots-tag", "noindex"],
  ["/*.md", "content-type", "text/markdown; charset=utf-8"],
  ["/*.md", "cache-control", MUTABLE],
  [`${CANONICAL}/*.md`, "x-robots-tag", "noindex"],
  ["/*.css", "cache-control", MUTABLE],
  ["/*.js", "cache-control", MUTABLE],
  ...["/*.woff2", "/*.woff"].flatMap((p) => [
    [p, "cache-control", IMMUTABLE],
    [p, "access-control-allow-origin", "*"],
  ]),
  ...["/*.png", "/*.jpg", "/*.svg", "/*.webp", "/*.gif"].map((p) => [p, "cache-control", DAY]),
  ["https://:host.junghanacs.workers.dev/*", "x-robots-tag", "noindex"],
  [`${CANONICAL}/*`, "strict-transport-security", "max-age=31536000; includeSubDomains; preload"],
]

/** Parse a _headers file into [{ pattern, headers: [[name, value]], line }]. */
export function parseHeaders(text) {
  const rules = []
  const errors = []
  let current = null
  text.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\r$/, "")
    if (line.length > MAX_LINE) errors.push(`_headers:${i + 1} longer than ${MAX_LINE} characters`)
    if (line.trim() === "" || line.trimStart().startsWith("#")) return
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [], line: i + 1 }
      rules.push(current)
      return
    }
    const m = line.trim().match(/^([A-Za-z0-9-]+):\s*(.*)$/)
    if (!current || !m) {
      errors.push(`_headers:${i + 1} is not a header line: ${line.trim()}`)
      return
    }
    current.headers.push([m[1].toLowerCase(), m[2].trim()])
  })
  return { rules, errors }
}

/** Compile a rule pattern into a matcher over { host, path }. Absolute rules carry a host pattern. */
export function compilePattern(pattern) {
  let host = null
  let pathPattern = pattern
  const abs = pattern.match(/^https:\/\/([^/]+)(\/.*)$/)
  if (abs) {
    host = abs[1]
    pathPattern = abs[2]
  } else if (!pattern.startsWith("/")) {
    throw new Error(`rule must start with / or https://: ${pattern}`)
  }
  if ((pattern.match(/\*/g) ?? []).length > 1) throw new Error(`more than one splat: ${pattern}`)
  const toRegex = (s, delimiter) =>
    s
      .split(/(\*|:[A-Za-z]\w*)/)
      .map((part) => {
        if (part === "*") return ".*"
        if (/^:[A-Za-z]\w*$/.test(part)) return `[^${delimiter}]+`
        return part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      })
      .join("")
  const hostRe = host === null ? null : new RegExp(`^${toRegex(host, "./")}$`)
  const pathRe = new RegExp(`^${toRegex(pathPattern, "/")}$`)
  return { host, matches: (h, p) => (hostRe === null || hostRe.test(h)) && pathRe.test(p) }
}

/** URL paths a file is served at, following Workers' default html_handling (auto-trailing-slash). */
export function servedPaths(rel) {
  const p = "/" + rel.split(path.sep).join("/")
  if (p === "/index.html") return ["/"]
  if (p.endsWith("/index.html")) return [p.slice(0, -"index.html".length)]
  if (p.endsWith(".html")) return [p.slice(0, -".html".length)]
  return [p]
}

const twinParser = unified().use(remarkParse).use(remarkGfm).freeze()
// Markdown twins (quartz/util/markdownSidecar.ts). Only these frontmatter keys may leave the source.
export const SIDECAR_KEYS = ["title", "url", "author", "date", "lastmod", "tags", "description"]

/**
 * A twin's body, read with a CommonMark parser (not Quartz's): its prose lines with every code span and
 * block (fenced, indented, inline) blanked out, and every link/image/definition destination.
 */
export function readTwinBody(markdown) {
  const tree = twinParser.parse(markdown)
  const offsets = []
  const destinations = []
  visit(tree, (node) => {
    if ((node.type === "code" || node.type === "inlineCode") && node.position)
      offsets.push([node.position.start.offset, node.position.end.offset])
    if (node.type === "link" || node.type === "image" || node.type === "definition") destinations.push(node.url)
  })
  // Blank code in UTF-16 offsets, keeping newlines so line numbers survive.
  let prose = markdown
  for (const [start, end] of offsets.sort((a, b) => b[0] - a[0]))
    prose = prose.slice(0, start) + prose.slice(start, end).replace(/[^\n]/g, " ") + prose.slice(end)
  return { lines: prose.split("\n"), destinations }
}

/** Problems in one twin: frontmatter outside the allowlist, a wrong url, export plumbing left in prose,
 *  a destination that is not absolute, a local path. */
export function sidecarProblems(markdown, pageUrl) {
  const problems = []
  const fm = markdown.match(/^---\n([\s\S]*?)\n---\n/)
  if (!fm) return ["no frontmatter"]
  for (const line of fm[1].split("\n")) {
    const key = line.match(/^([A-Za-z_]+):/)?.[1]
    if (!key || !SIDECAR_KEYS.includes(key)) problems.push(`frontmatter line not allowed: ${line.slice(0, 60)}`)
  }
  if (!fm[1].split("\n").includes(`url: ${JSON.stringify(pageUrl)}`)) problems.push(`url is not ${pageUrl}`)
  const { lines, destinations } = readTwinBody(markdown.slice(fm[0].length))
  lines.forEach((line, i) => {
    if (line.includes("<!--")) problems.push(`HTML comment outside code at body line ${i + 1}`)
    if (/\{\{[<%]/.test(line)) problems.push(`Hugo shortcode outside code at body line ${i + 1}`)
    if (/(?:href|src)="(?:file:|~|\/home\/)/.test(line)) problems.push(`local path in HTML at body line ${i + 1}`)
  })
  for (const url of destinations)
    if (!/^(https?:|mailto:)/i.test(url)) problems.push(`destination is not absolute: ${url.slice(0, 60)}`)
  return problems
}

// Deploy stamp (scripts/indexnow-notify.mjs stamp): exactly these public identifiers, nothing else, and
// the commit the caller independently says was built (build-cloudflare.sh: git rev-parse HEAD). clean is
// required only with requireClean (Workers Builds); a local dirty build can pass this gate, which is why the
// OK line prints clean=, and the notifier refuses clean=false regardless.
const STAMP_KEYS = ["schema", "host", "commit", "branch", "build", "built_at", "clean"]
export function stampProblems(publicDir, { expectCommit, requireClean = false } = {}) {
  const file = path.join(publicDir, "deploy.json")
  if (!fs.existsSync(file)) return ["deploy.json missing"]
  let s
  try {
    s = JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return ["deploy.json is not JSON"]
  }
  const problems = []
  if (JSON.stringify(Object.keys(s ?? {})) !== JSON.stringify(STAMP_KEYS)) problems.push(`deploy.json keys are ${Object.keys(s ?? {})}`)
  if (s?.schema !== 1) problems.push("deploy.json schema is not 1")
  if (`https://${s?.host}` !== CANONICAL) problems.push(`deploy.json host is ${s?.host}`)
  if (!/^[0-9a-f]{40}$/.test(s?.commit ?? "")) problems.push("deploy.json commit is not a full SHA")
  if (typeof s?.branch !== "string" || s.branch === "") problems.push("deploy.json branch missing")
  if (s?.build !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s?.build ?? ""))
    problems.push("deploy.json build is neither null nor a build UUID")
  if (Number.isNaN(Date.parse(s?.built_at))) problems.push("deploy.json built_at is not a date")
  if (typeof s?.clean !== "boolean") problems.push("deploy.json clean is not a boolean")
  if (!/^[0-9a-f]{40}$/.test(expectCommit ?? "")) problems.push("no expected build commit given (--expect-commit <40-hex sha>)")
  else if (s?.commit !== expectCommit) problems.push(`deploy.json commit ${s?.commit} is not the built commit ${expectCommit}`)
  if (requireClean && s?.clean !== true) problems.push("deploy.json clean is not true (required for a CI build)")
  return problems
}

function listFiles(dir) {
  const out = []
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(full)
    }
  }
  walk(dir)
  return out
}

export function validate(publicDir, { expectCommit, requireClean = false } = {}) {
  const failures = []
  const fail = (m) => failures.push(m)
  const norm = (v) => v.replace(/\s+/g, " ").trim()

  // Files: count and size limits. _headers is parsed by Workers, not served.
  const files = listFiles(publicDir).filter((f) => path.relative(publicDir, f) !== "_headers")
  if (files.length > MAX_FILES) fail(`${files.length} files exceed ${MAX_FILES}`)
  for (const f of files) {
    const size = fs.statSync(f).size
    if (size > MAX_FILE_BYTES) fail(`${path.relative(publicDir, f)} is ${size} bytes (> 25 MiB)`)
  }

  // _headers: syntax, limits, required values, and no header name set by two rules that match one path.
  const headersFile = path.join(publicDir, "_headers")
  if (!fs.existsSync(headersFile)) return { failures: ["public/_headers missing"], files: files.length }
  const { rules, errors } = parseHeaders(fs.readFileSync(headersFile, "utf8"))
  errors.forEach(fail)
  if (rules.length > MAX_RULES) fail(`${rules.length} header rules exceed ${MAX_RULES}`)
  const seen = new Set()
  const compiled = []
  for (const rule of rules) {
    if (seen.has(rule.pattern)) fail(`_headers:${rule.line} repeats rule ${rule.pattern}`)
    seen.add(rule.pattern)
    const names = rule.headers.map(([n]) => n)
    if (new Set(names).size !== names.length) fail(`_headers:${rule.line} names a header twice`)
    try {
      compiled.push({ rule, ...compilePattern(rule.pattern) })
    } catch (e) {
      fail(`_headers:${rule.line} ${e.message}`)
    }
  }
  for (const [pattern, name, value] of REQUIRED) {
    const rule = rules.find((r) => r.pattern === pattern)
    const got = rule?.headers.find(([n]) => n === name)?.[1]
    if (got === undefined || norm(got) !== norm(value)) fail(`_headers ${pattern} ${name} is ${got}, expected ${value}`)
  }
  // Overlap is checked on every real file path, on each host class a request can arrive at.
  const hosts = ["notes.junghanacs.com", "junghanacs-garden.junghanacs.workers.dev", "0123abcd-junghanacs-garden.junghanacs.workers.dev"]
  const paths = [...new Set(files.flatMap((f) => servedPaths(path.relative(publicDir, f))))]
  const reported = new Set()
  for (const host of hosts) {
    for (const p of paths) {
      const owners = new Map()
      for (const { rule, matches } of compiled) {
        if (!matches(host, p)) continue
        for (const [name] of rule.headers) {
          const prior = owners.get(name)
          const key = `${name}|${prior}|${rule.pattern}`
          if (prior && !reported.has(key)) {
            reported.add(key)
            fail(`${host}${p}: ${name} set by both ${prior} and ${rule.pattern} (Cloudflare joins them)`)
          }
          owners.set(name, rule.pattern)
        }
      }
    }
  }
  for (const p of JSONLD) if (!fs.existsSync(path.join(publicDir, p))) fail(`${p} missing`)
  stampProblems(publicDir, { expectCommit, requireClean }).forEach(fail)
  let stamp = null
  try {
    stamp = JSON.parse(fs.readFileSync(path.join(publicDir, "deploy.json"), "utf8"))
  } catch {}

  // Markdown twins: a page that advertises one links it in <head> and in the body, and the file exists;
  // every .md belongs to such a page; each twin passes sidecarProblems.
  const advertised = new Set()
  for (const f of files.filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(f, "utf8")
    const tag = html.match(/<link\b[^>]*type="text\/markdown"[^>]*>/)?.[0]
    if (!tag) continue
    const [page] = servedPaths(path.relative(publicDir, f))
    const twin = `${page}.md`
    advertised.add(twin)
    if (!tag.includes(`href="${CANONICAL}${twin}"`)) fail(`${page}: <link rel=alternate> is ${tag}, expected ${CANONICAL}${twin}`)
    if (!html.includes(`href="${twin}"`)) fail(`${page}: no body link to ${twin}`)
    if (!fs.existsSync(path.join(publicDir, twin))) fail(`${page}: advertises ${twin}, which is not in this output`)
  }
  let twins = 0
  for (const f of files.filter((f) => f.endsWith(".md"))) {
    twins++
    const twin = "/" + path.relative(publicDir, f).split(path.sep).join("/")
    if (!advertised.has(twin)) fail(`${twin}: no page advertises this Markdown twin`)
    const page = twin.slice(0, -".md".length)
    for (const problem of sidecarProblems(fs.readFileSync(f, "utf8"), `${CANONICAL}${page}`).slice(0, 3))
      fail(`${twin}: ${problem}`)
  }

  // Sitemap: canonical host, Denote uppercase T, and every <loc> served by a file in this output.
  const sitemapFile = path.join(publicDir, "sitemap.xml")
  let locs = []
  if (!fs.existsSync(sitemapFile)) fail("sitemap.xml missing")
  else {
    locs = [...fs.readFileSync(sitemapFile, "utf8").matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])
    if (locs.length === 0) fail("sitemap.xml has no <loc>")
    const served = new Set(paths)
    for (const loc of locs) {
      if (!loc.startsWith(`${CANONICAL}/`)) {
        fail(`sitemap <loc> not on ${CANONICAL}: ${loc}`)
        continue
      }
      const p = decodeURI(loc.slice(CANONICAL.length))
      if (/\d{8}t\d{6}/.test(p)) fail(`sitemap <loc> has a lowercase Denote id: ${loc}`)
      if (!served.has(p)) fail(`sitemap <loc> has no file in this output: ${loc}`)
      // Every published Denote page has a twin — so a build that drops the emitter and the Head link
      // together cannot pass with zero twins.
      if (/^\/(notes|meta|bib|botlog|journal)\/\d{8}T\d{6}$/.test(p) && !advertised.has(`${p}.md`))
        fail(`${p} advertises no Markdown twin`)
    }
  }
  return { failures, files: files.length, rules: rules.length, locs: locs.length, twins, stamp }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const flag = (name) => {
    const i = args.indexOf(name)
    return i === -1 ? undefined : args.splice(i, 2)[1]
  }
  const expectCommit = flag("--expect-commit")
  const requireClean = args.includes("--require-clean")
  if (requireClean) args.splice(args.indexOf("--require-clean"), 1)
  const dir = args[0] ?? "public"
  const { failures, files, rules, locs, twins, stamp } = validate(dir, { expectCommit, requireClean })
  if (failures.length) {
    for (const f of failures.slice(0, 50)) console.error(`[cloudflare-output] FAIL ${f}`)
    if (failures.length > 50) console.error(`[cloudflare-output] … ${failures.length - 50} more`)
    process.exit(1)
  }
  console.log(
    `[cloudflare-output] OK files=${files} rules=${rules} sitemap=${locs} markdown=${twins} stamp=${stamp.commit.slice(0, 12)} clean=${stamp.clean}`,
  )
}
