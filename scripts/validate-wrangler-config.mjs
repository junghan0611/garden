#!/usr/bin/env node
// Config-input gate for wrangler.jsonc — a different evidence axis from validate-cloudflare-output.mjs,
// which reads the built public/. Parses JSONC with TypeScript's config parser (comments and strings safe).
// Usage: node scripts/validate-wrangler-config.mjs [wrangler.jsonc]
// Contract: docs/deploy-cloudflare.md
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

export const CANONICAL_ROUTE = { pattern: "notes.junghanacs.com", custom_domain: true }

export function parseJsonc(file, text) {
  const { config, error } = ts.parseConfigFileTextToJson(file, text)
  if (error) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(error.messageText, "\n")}`)
  return config
}

export function validateConfig(file) {
  const failures = []
  const fail = (m) => failures.push(m)
  let c
  try {
    c = parseJsonc(file, fs.readFileSync(file, "utf8"))
  } catch (e) {
    return [e.message]
  }
  const expect = (label, got, want) => {
    if (got !== want) fail(`${label} is ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`)
  }
  expect("name", c.name, "junghanacs-garden")
  expect("workers_dev", c.workers_dev, true)
  expect("preview_urls", c.preview_urls, true)
  // Exactly one route: the canonical host as a Custom Domain. No other host, no path route, no zone route.
  if ("route" in c) fail("route (singular) present: use the single routes entry")
  const routes = c.routes
  if (!Array.isArray(routes) || routes.length !== 1) fail(`routes must be exactly [${JSON.stringify(CANONICAL_ROUTE)}], got ${JSON.stringify(routes)}`)
  else if (JSON.stringify(routes[0]) !== JSON.stringify(CANONICAL_ROUTE)) fail(`routes[0] is ${JSON.stringify(routes[0])}, expected ${JSON.stringify(CANONICAL_ROUTE)}`)
  expect("main", c.main, "cloudflare/worker.mjs")
  if (typeof c.main === "string" && !fs.existsSync(path.resolve(path.dirname(file), c.main))) fail(`main ${c.main} does not exist`)
  if (!Array.isArray(c.compatibility_flags) || !c.compatibility_flags.includes("assets_navigation_has_no_effect"))
    fail("compatibility_flags lacks assets_navigation_has_no_effect: browser navigations would skip the Worker")
  if (c.compatibility_flags?.includes("assets_navigation_prefers_asset_serving")) fail("assets_navigation_prefers_asset_serving contradicts the contract")
  const a = c.assets ?? {}
  expect("assets.directory", a.directory, "./public")
  expect("assets.binding", a.binding, "ASSETS")
  expect("assets.not_found_handling", a.not_found_handling, "404-page")
  // Asset-first: a Worker invocation for every static request would bill every hit and 429 past the free limit.
  if (a.run_worker_first !== undefined && a.run_worker_first !== false) fail(`assets.run_worker_first is ${JSON.stringify(a.run_worker_first)}`)
  if (a.html_handling !== undefined && a.html_handling !== "auto-trailing-slash") fail(`assets.html_handling is ${a.html_handling}`)
  return failures
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? "wrangler.jsonc"
  const failures = validateConfig(file)
  if (failures.length) {
    for (const f of failures) console.error(`[wrangler-config] FAIL ${f}`)
    process.exit(1)
  }
  console.log(`[wrangler-config] OK ${file}`)
}
