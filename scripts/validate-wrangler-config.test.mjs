// node --test scripts/validate-wrangler-config.test.mjs
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { validateConfig } from "./validate-wrangler-config.mjs"

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const REAL = fs.readFileSync(path.join(REPO, "wrangler.jsonc"), "utf8")

/** Write a config next to a copy of the Worker so `main` resolves like in the repo. */
function check(text, { worker = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wrangler-cfg-"))
  if (worker) {
    fs.mkdirSync(path.join(dir, "cloudflare"))
    fs.copyFileSync(path.join(REPO, "cloudflare", "worker.mjs"), path.join(dir, "cloudflare", "worker.mjs"))
  }
  fs.writeFileSync(path.join(dir, "wrangler.jsonc"), text)
  return validateConfig(path.join(dir, "wrangler.jsonc"))
}
const edit = (from, to) => {
  const text = REAL.replace(from, to)
  assert.notEqual(text, REAL, `fixture edit did not apply: ${from}`)
  return text
}

test("the tracked wrangler.jsonc passes", () => {
  assert.deepEqual(check(REAL), [])
})

test("comments and URL-looking strings do not confuse the parser", () => {
  const text = edit('"name": "junghanacs-garden",', '"name": "junghanacs-garden", // not a route: "routes": ["https://x//y"]\n  /* "run_worker_first": true */')
  assert.deepEqual(check(text), [])
})

for (const [name, from, to, expect] of [
  ["adding routes", '"workers_dev": true,', '"routes": [{ "pattern": "notes.junghanacs.com", "custom_domain": true }],\n  "workers_dev": true,', "routes present"],
  ["run_worker_first true", '"binding": "ASSETS",', '"binding": "ASSETS",\n    "run_worker_first": true,', "run_worker_first"],
  ["run_worker_first patterns", '"binding": "ASSETS",', '"binding": "ASSETS",\n    "run_worker_first": ["/*"],', "run_worker_first"],
  ["dropping the navigation flag", '["assets_navigation_has_no_effect"]', "[]", "assets_navigation_has_no_effect"],
  ["dropping the ASSETS binding", '"binding": "ASSETS",', "", "assets.binding"],
  ["changing not_found_handling", '"404-page"', '"single-page-application"', "not_found_handling"],
  ["dropping main", '"main": "cloudflare/worker.mjs",', "", "main is undefined"],
]) {
  test(`${name} fails`, () => {
    const failures = check(edit(from, to))
    assert.ok(failures.some((f) => f.includes(expect)), JSON.stringify(failures))
  })
}

test("a main that does not exist fails", () => {
  assert.ok(check(REAL, { worker: false }).some((f) => f.includes("does not exist")))
})

test("invalid JSONC fails with a parse error", () => {
  assert.equal(check("{ \"name\": ").length, 1)
})
