// node --test scripts/validate-cloudflare-output.test.mjs
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { CANONICAL, compilePattern, servedPaths, validate } from "./validate-cloudflare-output.mjs"

const HEADERS = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cloudflare", "_headers"),
  "utf8",
)
const NOTE = "notes/20250101T000000"

function fixture({ headers = HEADERS, locs = ["/", `/${NOTE}`, "/notes/"] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-output-"))
  const put = (rel, body = "x") => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), body)
  }
  for (const rel of ["index.html", `${NOTE}.html`, "notes/index.html", "404.html", "index.css", "postscript.js"])
    put(rel)
  for (const rel of ["llms.txt", "robots.txt", "static/contentIndex.json", "static/fonts/a.woff2"]) put(rel)
  for (const rel of ["tags/autholog", "notes", "meta", "bib", "botlog", "journal"]) put(`${rel}.jsonld`, "{}")
  put("sitemap.xml", `<urlset>${locs.map((l) => `<url><loc>${CANONICAL}${l}</loc></url>`).join("")}</urlset>`)
  put("_headers", headers)
  return dir
}

test("the tracked _headers and a well-formed output pass", () => {
  assert.deepEqual(validate(fixture()).failures, [])
})

test("a lowercase Denote id in the sitemap fails twice: case and missing file", () => {
  const { failures } = validate(fixture({ locs: ["/notes/20250101t000000"] }))
  assert.ok(failures.some((f) => f.includes("lowercase Denote id")))
  assert.ok(failures.some((f) => f.includes("no file in this output")))
})

test("a sitemap entry on another host fails", () => {
  const dir = fixture()
  fs.writeFileSync(path.join(dir, "sitemap.xml"), "<loc>https://example.com/</loc>")
  assert.ok(validate(dir).failures.some((f) => f.includes("not on")))
})

test("two rules setting one header name on the same path fail (Cloudflare joins them)", () => {
  const { failures } = validate(fixture({ headers: `${HEADERS}\n/static/*\n  Cache-Control: public, max-age=60\n` }))
  assert.ok(failures.some((f) => f.includes("cache-control set by both")))
})

test("a missing workers.dev noindex rule fails", () => {
  const headers = HEADERS.replace(/https:\/\/:host\.junghanacs\.workers\.dev\/\*\n  X-Robots-Tag: noindex\n/, "")
  assert.notEqual(headers, HEADERS)
  assert.ok(validate(fixture({ headers })).failures.some((f) => f.includes("x-robots-tag")))
})

test("a repeated rule path fails", () => {
  const { failures } = validate(fixture({ headers: `${HEADERS}\n/llms.txt\n  X-Test: 1\n` }))
  assert.ok(failures.some((f) => f.includes("repeats rule /llms.txt")))
})

const dropLine = (re) => {
  const headers = HEADERS.replace(re, "")
  assert.notEqual(headers, HEADERS, `fixture edit did not apply: ${re}`)
  return headers
}

for (const [name, re, expect] of [
  ["nosniff", /^  X-Content-Type-Options: nosniff\n/m, "x-content-type-options"],
  ["the Link header", /^  Link: .*\n/m, "link"],
  ["Permissions-Policy", /^  Permissions-Policy: .*\n/m, "permissions-policy"],
  ["the font CORS header", /^  Access-Control-Allow-Origin: \*\n/m, "access-control-allow-origin"],
  ["the llms.txt charset", /(?<=^\/llms\.txt\n)  Content-Type: .*\n/m, "content-type"],
]) {
  test(`deleting ${name} fails`, () => {
    assert.ok(validate(fixture({ headers: dropLine(re) })).failures.some((f) => f.includes(expect)))
  })
}

test("a changed contract value fails", () => {
  const headers = HEADERS.replace("public, max-age=86400", "public, max-age=60")
  assert.ok(validate(fixture({ headers })).failures.some((f) => f.includes("/*.png cache-control")))
})

test("one rule naming a header twice fails", () => {
  const headers = HEADERS.replace("/llms.txt\n", "/llms.txt\n  Cache-Control: no-store\n")
  assert.ok(validate(fixture({ headers })).failures.some((f) => f.includes("names a header twice")))
})

test("a line over 2,000 characters fails", () => {
  const { failures } = validate(fixture({ headers: `${HEADERS}\n/long\n  X-Long: ${"a".repeat(2000)}\n` }))
  assert.ok(failures.some((f) => f.includes("longer than 2000")))
})

test("more than 100 rules fail", () => {
  const extra = Array.from({ length: 100 }, (_, i) => `/extra-${i}\n  X-Extra: 1\n`).join("\n")
  assert.ok(validate(fixture({ headers: `${HEADERS}\n${extra}` })).failures.some((f) => f.includes("exceed 100")))
})

test("a file over 25 MiB fails", () => {
  const dir = fixture()
  const big = path.join(dir, "big.bin")
  fs.writeFileSync(big, "")
  fs.truncateSync(big, 25 * 1024 * 1024 + 1) // sparse: size counts, disk does not
  assert.ok(validate(dir).failures.some((f) => f.includes("big.bin") && f.includes("25 MiB")))
})

test("patterns: extension splat, host placeholder, one splat only", () => {
  assert.ok(compilePattern("/*.woff2").matches("h", "/static/fonts/a.woff2"))
  assert.ok(!compilePattern("/*.woff2").matches("h", "/static/fonts/a.woff"))
  const dev = compilePattern("https://:host.junghanacs.workers.dev/*")
  assert.ok(dev.matches("0123abcd-junghanacs-garden.junghanacs.workers.dev", "/"))
  assert.ok(!dev.matches("notes.junghanacs.com", "/"))
  assert.throws(() => compilePattern("/*/*.js"))
})

test("served paths follow auto-trailing-slash", () => {
  assert.deepEqual(servedPaths("index.html"), ["/"])
  assert.deepEqual(servedPaths("notes/index.html"), ["/notes/"])
  assert.deepEqual(servedPaths(`${NOTE}.html`), [`/${NOTE}`])
  assert.deepEqual(servedPaths("notes.jsonld"), ["/notes.jsonld"])
})
