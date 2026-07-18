#!/usr/bin/env node
// Explicitly import the stable WikiDocs page ledger into the garden.
// This runs at owner-controlled sync time, never during the Netlify build.

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_SOURCE = path.join(path.dirname(ROOT), "garden2wikidocs", "mapping.json")
const OUTPUT = path.join(ROOT, "quartz", "data", "wikidocs-mirror.json")
const CONTENT_SECTIONS = new Set(["journal", "meta", "bib", "notes", "botlog"])
const DENOTE_ID = /^\d{8}T\d{6}$/
const WIKIDOCS_URL = /^https:\/\/wikidocs\.net\/(\d+)$/

function usage() {
  console.log(
    `Usage: node scripts/sync-wikidocs-map.mjs [--from PATH] [--check]\n\n` +
      `Default source: ${DEFAULT_SOURCE}\n` +
      `Output:         ${OUTPUT}`,
  )
}

let sourcePath = DEFAULT_SOURCE
let checkOnly = false
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg === "--from") {
    sourcePath = path.resolve(process.argv[++i] ?? "")
  } else if (arg === "--check") {
    checkOnly = true
  } else if (arg === "--help" || arg === "-h") {
    usage()
    process.exit(0)
  } else {
    console.error(`Unknown argument: ${arg}`)
    usage()
    process.exit(2)
  }
}

if (!fs.existsSync(sourcePath)) {
  console.error(`[wikidocs-map] source not found: ${sourcePath}`)
  process.exit(1)
}

const sourceText = fs.readFileSync(sourcePath, "utf8")
let source
try {
  source = JSON.parse(sourceText)
} catch (error) {
  console.error(`[wikidocs-map] invalid JSON: ${error.message}`)
  process.exit(1)
}

if (!source || typeof source !== "object" || Array.isArray(source)) {
  console.error("[wikidocs-map] mapping root must be an object")
  process.exit(1)
}

const failures = []
const byDenoteId = {}
const pageIds = new Set()
const urls = new Set()

for (const [id, value] of Object.entries(source).sort(([a], [b]) => a.localeCompare(b))) {
  if (id === "_chapters") continue
  if (!DENOTE_ID.test(id)) {
    failures.push(`${id}: invalid Denote ID`)
    continue
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${id}: mapping value must be an object`)
    continue
  }

  const { folder, path: pagePath, page_id: pageId, url } = value
  if (!CONTENT_SECTIONS.has(folder)) failures.push(`${id}: invalid folder ${folder}`)
  if (pagePath !== `pages/${folder}/${id}.md`) failures.push(`${id}: path does not match folder/ID`)
  if (!Number.isInteger(pageId) || pageId <= 0) failures.push(`${id}: invalid page_id ${pageId}`)

  const urlMatch = typeof url === "string" ? url.match(WIKIDOCS_URL) : null
  if (!urlMatch || Number(urlMatch[1]) !== pageId) failures.push(`${id}: URL and page_id disagree`)
  if (pageIds.has(pageId)) failures.push(`${id}: duplicate page_id ${pageId}`)
  if (urls.has(url)) failures.push(`${id}: duplicate URL ${url}`)
  pageIds.add(pageId)
  urls.add(url)

  const gardenFile = path.join(ROOT, "content", folder, `${id}.md`)
  if (!fs.existsSync(gardenFile))
    failures.push(`${id}: source garden page not found: content/${folder}/${id}.md`)

  if (urlMatch && Number(urlMatch[1]) === pageId) byDenoteId[id] = url
}

if (failures.length > 0) {
  console.error(`[wikidocs-map] FAIL ${failures.length} issue(s)`)
  for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`)
  if (failures.length > 50) console.error(`... ${failures.length - 50} more`)
  process.exit(1)
}

const gardenIds = new Set()
for (const section of CONTENT_SECTIONS) {
  const dir = path.join(ROOT, "content", section)
  for (const name of fs.readdirSync(dir)) {
    const id = name.replace(/\.md$/, "")
    if (name.endsWith(".md") && DENOTE_ID.test(id)) gardenIds.add(id)
  }
}
const unmapped = [...gardenIds].filter((id) => !(id in byDenoteId)).sort()

const snapshot = {
  _meta: {
    schemaVersion: 1,
    bookUrl: "https://wikidocs.net/book/20676",
    source: "https://github.com/junghan0611/garden2wikidocs/blob/main/mapping.json",
    sourceSha256: crypto.createHash("sha256").update(sourceText).digest("hex"),
    mappedNotes: Object.keys(byDenoteId).length,
  },
  byDenoteId,
}
const rendered = `${JSON.stringify(snapshot, null, 2)}\n`

if (checkOnly) {
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, "utf8") !== rendered) {
    console.error("[wikidocs-map] snapshot is stale; run without --check and review the diff")
    process.exit(1)
  }
  console.log(
    `[wikidocs-map] OK snapshot current: mapped=${snapshot._meta.mappedNotes} unmapped=${unmapped.length}`,
  )
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, rendered)
  console.log(
    `[wikidocs-map] wrote ${path.relative(ROOT, OUTPUT)}: mapped=${snapshot._meta.mappedNotes} unmapped=${unmapped.length}`,
  )
}

if (unmapped.length > 0) {
  console.log(
    `[wikidocs-map] unmapped garden notes are allowed: ${unmapped.slice(0, 10).join(", ")}`,
  )
}
