#!/usr/bin/env node
// Response gate for a deployed garden: what the host sends, not the files that should produce it.
// Usage: node scripts/verify-deployed.mjs <origin> [publicDir]
//   e.g. node scripts/verify-deployed.mjs https://0123abcd-junghanacs-garden.junghanacs.workers.dev public
// With publicDir, fetched bodies of the machine entry points must equal the local build byte for byte.
// Contract: docs/deploy-cloudflare.md. Complements scripts/validate-cloudflare-output.mjs (build output).
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { LINK } from "./validate-cloudflare-output.mjs"

const origin = process.argv[2]?.replace(/\/$/, "")
if (!origin) {
  console.error("usage: node scripts/verify-deployed.mjs <origin> [publicDir]")
  process.exit(2)
}
const publicDir = process.argv[3]
const canonical = new URL(origin).hostname === "notes.junghanacs.com"
const failures = []
const fail = (m) => failures.push(m)
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex")
const squash = (v) => (v ?? "").replace(/\s+/g, "").toLowerCase()

// One response per request (path + navigation flag): sample selection, header checks and body hashes
// all read the same response.
const NAVIGATE = { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document" }
const responses = new Map()
const get = (p, nav = false) => {
  const key = `${nav ? "nav " : ""}${p}`
  if (!responses.has(key)) responses.set(key, fetchOnce(p, nav))
  return responses.get(key)
}
async function fetchOnce(p, nav) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${origin}${p}`, {
        redirect: "manual",
        headers: nav ? NAVIGATE : {},
        signal: AbortSignal.timeout(20000),
      })
      return { r, body: Buffer.from(await r.arrayBuffer()) }
    } catch (e) {
      lastError = e
    }
  }
  fail(`${p} fetch failed: ${lastError?.cause?.code ?? lastError?.message}`)
  return null
}

const SECURITY = [
  ["x-frame-options", "SAMEORIGIN"],
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()"],
  ["link", LINK],
]
const CACHE_MUTABLE = "public,max-age=0,must-revalidate"
const CACHE_HOUR = "public,max-age=3600"
const TEXT = "text/plain;charset=utf-8"
const LDJSON = "application/ld+json;charset=utf-8"
const JSONLD = ["/tags/autholog.jsonld", "/notes.jsonld", "/meta.jsonld", "/bib.jsonld", "/botlog.jsonld", "/journal.jsonld"]

// Sample one Denote page per section from the deployed sitemap (canonical URLs, rewritten to origin).
const sitemap = await get("/sitemap.xml")
const locs = sitemap ? [...sitemap.body.toString("utf8").matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]) : []
const samples = []
for (const section of ["notes", "meta", "bib", "journal", "botlog"]) {
  const loc = locs.find((l) => new RegExp(`/${section}/\\d{8}T\\d{6}$`).test(l))
  if (loc) samples.push(new URL(loc).pathname)
  else fail(`sitemap has no uppercase Denote URL in /${section}/`)
}

// Old lowercase-t Denote URLs: 301 to the existing uppercase page, answered by the Worker, both as a
// plain fetch and as a browser navigation (Sec-Fetch-Mode: navigate). GLG's canary is /journal/20260921t000000.
const lower = (p) => p.replace(/(\d{8})T(\d{6})/, "$1t$2")
const CANARY = "/journal/20260921T000000"
const both = (c) => [c, { ...c, nav: true }]
const WORKER_404 = { status: 404, type: "text/html", route: "miss", same: true, file: "404.html" }
const checks = [
  { path: "/", type: "text/html", same: true },
  ...[CANARY, ...samples].map((p) => ({ path: p, type: "text/html", same: true })),
  ...[CANARY, ...samples].flatMap((p) => both({ path: lower(p), status: 301, location: p, route: "lowercase-301", empty: true })),
  ...both({ path: `${lower(CANARY)}/`, status: 301, location: CANARY, route: "lowercase-301" }),
  ...both({ path: `${lower(CANARY)}?a=1&b=two`, status: 301, location: `${CANARY}?a=1&b=two`, route: "lowercase-301" }),
  ...both({ path: "/journal/19990101t000000", ...WORKER_404 }),
  ...both({ path: "/verify-deployed-missing/", ...WORKER_404 }),
  { path: "/static/Profile.jpg", ...WORKER_404 },
  ...["/notes/", "/meta/", "/bib/", "/journal/", "/botlog/", "/tags/", "/tags/autholog"].map((p) => ({ path: p, type: "text/html" })),
  { path: "/notes", status: 307, location: "/notes/" },
  { path: "/robots.txt", type: TEXT, cache: CACHE_HOUR, same: true },
  { path: "/llms.txt", type: TEXT, cache: CACHE_HOUR, same: true },
  { path: "/sitemap.xml", cache: CACHE_HOUR, same: true },
  ...JSONLD.map((p) => ({ path: p, type: LDJSON, cache: CACHE_HOUR, same: true, json: true })),
  { path: "/static/contentIndex.json", cache: CACHE_MUTABLE, same: true, json: true },
  { path: "/index.css", cache: CACHE_MUTABLE, same: true },
  { path: "/prescript.js", cache: CACHE_MUTABLE, same: true },
  { path: "/postscript.js", cache: CACHE_MUTABLE, same: true },
  { path: "/static/profile.jpg", cache: "public,max-age=86400" },
]
// A font the stylesheet actually loads.
const css = await get("/index.css")
const font = css?.body.toString("utf8").match(/url\(["']?([^"')]+\.woff2)["']?\)/)?.[1]
if (font) checks.push({ path: new URL(font, `${origin}/index.css`).pathname, cache: "public,max-age=31536000,immutable", cors: true })
else fail("index.css names no .woff2")

for (const check of checks) {
  const res = await get(check.path, check.nav)
  if (!res) continue
  const { r, body } = res
  const h = (n) => r.headers.get(n)
  const where = `${check.nav ? "[navigate] " : ""}${check.path}`
  if (r.status !== (check.status ?? 200)) {
    fail(`${where} answered ${r.status}, expected ${check.status ?? 200}`)
    continue
  }
  if (check.location && h("location") !== check.location) fail(`${where} location ${h("location")}, expected ${check.location}`)
  // x-garden-route marks a Worker response; an asset response must not carry it (sampled evidence only).
  if ((h("x-garden-route") ?? undefined) !== check.route) fail(`${where} x-garden-route is ${h("x-garden-route")}, expected ${check.route}`)
  if (check.empty && body.length) fail(`${where} 301 has a ${body.length}-byte body`)
  if (check.type && !squash(h("content-type")).startsWith(squash(check.type))) fail(`${where} content-type ${h("content-type")}, expected ${check.type}`)
  // fetch joins repeated header lines with ", " — a directive named twice means two rules matched.
  const directives = (h("cache-control") ?? "").split(",").map((d) => d.trim().split("=")[0].toLowerCase()).filter(Boolean)
  if (new Set(directives).size !== directives.length) fail(`${where} cache-control repeats a directive: ${h("cache-control")}`)
  if (check.cache && squash(h("cache-control")) !== check.cache) fail(`${where} cache-control ${h("cache-control")}, expected ${check.cache}`)
  if (check.cors && h("access-control-allow-origin") !== "*") fail(`${where} access-control-allow-origin ${h("access-control-allow-origin")}`)
  for (const [name, value] of SECURITY) if (squash(h(name)) !== squash(value)) fail(`${where} ${name} is ${h(name)}`)
  const robots = (h("x-robots-tag") ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
  if (canonical) {
    if (robots.length) fail(`${where} carries X-Robots-Tag on the canonical host: ${h("x-robots-tag")}`)
    if (squash(h("strict-transport-security")) !== "max-age=31536000;includesubdomains;preload")
      fail(`${where} strict-transport-security ${h("strict-transport-security")}`)
  } else if (!robots.includes("noindex")) fail(`${where} is indexable on a non-canonical host`)
  if (check.json) {
    try {
      JSON.parse(body.toString("utf8"))
    } catch {
      fail(`${where} is not JSON`)
    }
  }
  if (check.same && publicDir) {
    const rel = check.file ?? (check.path.endsWith("/") ? `${check.path}index.html` : path.extname(check.path) ? check.path : `${check.path}.html`)
    const local = fs.readFileSync(path.join(publicDir, rel))
    if (sha(local) !== sha(body)) fail(`${where} body differs from ${publicDir}${check.path}`)
  }
}

if (failures.length) {
  for (const f of failures) console.error(`[verify-deployed] FAIL ${f}`)
  process.exit(1)
}
console.log(`[verify-deployed] OK ${origin} checks=${checks.length}${publicDir ? ` bodies=${publicDir}` : ""}`)
