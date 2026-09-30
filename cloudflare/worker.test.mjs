// node --test cloudflare/worker.test.mjs
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import worker from "./worker.mjs"
import { canonicalPath, COMMON_HEADERS, HSTS } from "./garden-route.mjs"
import { parseHeaders } from "../scripts/validate-cloudflare-output.mjs"

const PREVIEW = "https://0123abcd-junghanacs-garden.junghanacs.workers.dev"
const CANONICAL = "https://notes.junghanacs.com"
const EXISTING = new Set(["/journal/20260921T000000", "/notes/20211117T190700", "/meta/20240918T175053", "/bib/20220914T120900", "/botlog/20250101T000000"])

/** Fake asset binding: 200 for known pages, the 404 page otherwise; records every call. */
function assets({ status } = {}) {
  const calls = []
  return {
    calls,
    async fetch(input, init) {
      const req = input instanceof Request ? input : new Request(input, init)
      const p = new URL(req.url).pathname
      calls.push({ method: req.method, url: req.url })
      if (status) return new Response("boom", { status })
      if (EXISTING.has(p)) return new Response(req.method === "HEAD" ? null : "<html>page</html>", { status: 200, headers: { "Content-Type": "text/html" } })
      return new Response(req.method === "HEAD" ? null : "<html>404 page</html>", {
        status: 404,
        headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=0, must-revalidate", "X-Robots-Tag": "noindex" },
      })
    },
  }
}
const run = (url, init, env = assets()) => worker.fetch(new Request(url, init), { ASSETS: env }).then((r) => ({ r, env }))

test("canonicalPath: only the Denote t, only the five sections, slash dropped", () => {
  assert.equal(canonicalPath("/journal/20260921t000000"), "/journal/20260921T000000")
  assert.equal(canonicalPath("/journal/20260921t000000/"), "/journal/20260921T000000")
  for (const s of ["notes", "meta", "bib", "botlog"]) assert.equal(canonicalPath(`/${s}/20211117t190700`), `/${s}/20211117T190700`)
  for (const p of [
    "/journal/20260921T000000", // already canonical
    "/Journal/20260921t000000", // other casing untouched, not guessed
    "/tags/20260921t000000",
    "/journal/20260921t000000x",
    "/journal/20260921t000000.html",
    "/journal/20260921t00000",
    "//evil.example/journal/20260921t000000",
    "/journal/20260921t000000%2F..",
    "/journal/20260921t000000//",
  ])
    assert.equal(canonicalPath(p), null, p)
})

test("existing lowercase page → 301 to the relative canonical path, query kept", async () => {
  const { r, env } = await run(`${PREVIEW}/journal/20260921t000000?a=1&b=two`)
  assert.equal(r.status, 301)
  assert.equal(r.headers.get("location"), "/journal/20260921T000000?a=1&b=two")
  assert.equal(r.headers.get("x-garden-route"), "lowercase-301")
  assert.equal(await r.text(), "")
  // Existence probe: HEAD, no query, asked of the binding.
  assert.deepEqual(env.calls, [{ method: "HEAD", url: `${PREVIEW}/journal/20260921T000000` }])
})

test("trailing slash goes straight to the canonical page (no 307 hop)", async () => {
  const { r } = await run(`${PREVIEW}/notes/20211117t190700/`)
  assert.equal(r.status, 301)
  assert.equal(r.headers.get("location"), "/notes/20211117T190700")
})

test("HEAD gets the same 301 without a body", async () => {
  const { r } = await run(`${PREVIEW}/bib/20220914t120900`, { method: "HEAD" })
  assert.equal(r.status, 301)
  assert.equal(r.headers.get("location"), "/bib/20220914T120900")
})

test("a lowercase id with no page falls through to the 404 page unchanged", async () => {
  const { r, env } = await run(`${PREVIEW}/journal/19990101t000000`)
  assert.equal(r.status, 404)
  assert.equal(await r.text(), "<html>404 page</html>")
  assert.equal(r.headers.get("content-type"), "text/html")
  assert.equal(r.headers.get("cache-control"), "public, max-age=0, must-revalidate")
  assert.equal(r.headers.get("x-robots-tag"), "noindex") // set, not appended
  assert.equal(r.headers.get("x-garden-route"), "miss")
  assert.deepEqual(env.calls.map((c) => c.method), ["HEAD", "GET"])
})

test("other misses pass straight through: asset typo, unknown path, POST keeps the binding's status", async () => {
  for (const p of ["/static/Profile.jpg", "/nope/", "/Journal/20260921t000000"]) {
    const { r, env } = await run(`${PREVIEW}${p}`)
    assert.equal(r.status, 404, p)
    assert.equal(env.calls.length, 1, p)
  }
  const env = assets()
  env.fetch = async () => new Response(null, { status: 405 })
  const { r } = await run(`${PREVIEW}/journal/20260921t000000`, { method: "POST", body: "x" }, env)
  assert.equal(r.status, 405)
  assert.equal(r.headers.get("x-garden-route"), "miss")
})

test("an asset lookup failure is not swallowed into a redirect", async () => {
  const { r } = await run(`${PREVIEW}/journal/20260921t000000`, {}, assets({ status: 500 }))
  assert.equal(r.status, 502)
  assert.equal(r.headers.get("x-garden-route"), "lookup-error")
})

test("headers: common set everywhere, noindex on workers.dev only, HSTS on the canonical host only", async () => {
  const preview = (await run(`${PREVIEW}/journal/20260921t000000`)).r
  const canonical = (await run(`${CANONICAL}/journal/20260921t000000`)).r
  for (const r of [preview, canonical])
    for (const [name, value] of Object.entries(COMMON_HEADERS)) assert.equal(r.headers.get(name), value, name)
  assert.equal(preview.headers.get("x-robots-tag"), "noindex")
  assert.equal(preview.headers.get("strict-transport-security"), null)
  assert.equal(canonical.headers.get("x-robots-tag"), null)
  assert.equal(canonical.headers.get("strict-transport-security"), HSTS)
  assert.equal(canonical.headers.get("location"), "/journal/20260921T000000")
})

test("worker.mjs exports only the handler (workerd rejects other named exports)", async () => {
  const mod = await import("./worker.mjs")
  assert.deepEqual(Object.keys(mod), ["default"])
  assert.equal(typeof mod.default.fetch, "function")
})

test("Worker header values equal cloudflare/_headers", () => {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "_headers")
  const { rules } = parseHeaders(fs.readFileSync(file, "utf8"))
  const rule = (p) => Object.fromEntries(rules.find((r) => r.pattern === p).headers)
  const all = rule("/*")
  for (const [name, value] of Object.entries(COMMON_HEADERS)) assert.equal(all[name.toLowerCase()], value, name)
  assert.equal(Object.keys(all).length, Object.keys(COMMON_HEADERS).length)
  assert.equal(rule("https://notes.junghanacs.com/*")["strict-transport-security"], HSTS)
  assert.equal(rule("https://:host.junghanacs.workers.dev/*")["x-robots-tag"], "noindex")
})
