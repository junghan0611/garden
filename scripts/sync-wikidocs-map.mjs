#!/usr/bin/env node
// Explicitly import the LIVE WikiDocs ledger into the garden.
// Owner-controlled sync time only — never during the Netlify build.
//
// Live set = garden2wikidocs TOC.md membership, not mapping.json as a whole.
// mapping.json still carries dead page_id values from the 500-cap cut; those
// must not enter the snapshot.

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
const CHAPTER_SLUG = {
  autholog: "tags/autholog",
  journal: "journal",
  meta: "meta",
  bib: "bib",
  notes: "notes",
  botlog: "botlog",
}

function usage() {
  console.log(
    `Usage: node scripts/sync-wikidocs-map.mjs [--from PATH] [--toc PATH] [--check]\n\n` +
      `Default source: ${DEFAULT_SOURCE}\n` +
      `Default TOC:    <source-dir>/TOC.md\n` +
      `Output:         ${OUTPUT}`,
  )
}

let sourcePath = DEFAULT_SOURCE
let tocPath
let checkOnly = false
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg === "--from") {
    sourcePath = path.resolve(process.argv[++i] ?? "")
  } else if (arg === "--toc") {
    tocPath = path.resolve(process.argv[++i] ?? "")
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

if (!tocPath) tocPath = path.join(path.dirname(sourcePath), "TOC.md")

if (!fs.existsSync(sourcePath)) {
  console.error(`[wikidocs-map] source not found: ${sourcePath}`)
  process.exit(1)
}
if (!fs.existsSync(tocPath)) {
  console.error(`[wikidocs-map] TOC not found: ${tocPath}`)
  console.error("[wikidocs-map] refuse to import mapping.json without the live TOC")
  process.exit(1)
}

const sourceText = fs.readFileSync(sourcePath, "utf8")
const tocText = fs.readFileSync(tocPath, "utf8")
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
const warnings = []
const liveIds = new Set()
const liveChapters = new Set()

for (const match of tocText.matchAll(/\((pages\/[^)]+)\)/g)) {
  const pagePath = match[1]
  const chapter = pagePath.match(/^pages\/([^/]+)\/_chapter\.md$/)
  if (chapter) {
    liveChapters.add(chapter[1])
    continue
  }
  const denote = pagePath.match(/^pages\/([^/]+)\/(\d{8}T\d{6})\.md$/)
  if (denote) {
    liveIds.add(denote[2])
    continue
  }
  failures.push(`TOC path not recognized: ${pagePath}`)
}

if (liveIds.size === 0 || liveChapters.size === 0) {
  failures.push(`TOC live set is empty: ids=${liveIds.size} chapters=${liveChapters.size}`)
}

const byDenoteId = {}
const byGardenSlug = {}
const pageIds = new Set()
const urls = new Set()

function takeUrl(label, pageId, url) {
  const urlMatch = typeof url === "string" ? url.match(WIKIDOCS_URL) : null
  if (!Number.isInteger(pageId) || pageId <= 0) {
    failures.push(`${label}: invalid page_id ${pageId}`)
    return
  }
  if (!urlMatch || Number(urlMatch[1]) !== pageId) {
    failures.push(`${label}: URL and page_id disagree`)
    return
  }
  if (pageIds.has(pageId)) failures.push(`${label}: duplicate page_id ${pageId}`)
  if (urls.has(url)) failures.push(`${label}: duplicate URL ${url}`)
  pageIds.add(pageId)
  urls.add(url)
  return url
}

for (const id of [...liveIds].sort()) {
  const value = source[id]
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${id}: in TOC but missing from mapping`)
    continue
  }

  const { folder, path: pagePath, page_id: pageId, url } = value
  if (!CONTENT_SECTIONS.has(folder)) failures.push(`${id}: invalid folder ${folder}`)
  if (pagePath !== `pages/${folder}/${id}.md`) failures.push(`${id}: path does not match folder/ID`)

  if (pageId == null || url == null) {
    warnings.push(`${id}: TOC member has no recovered page_id yet; omitted from snapshot`)
    continue
  }

  const gardenFile = path.join(ROOT, "content", folder, `${id}.md`)
  if (!fs.existsSync(gardenFile)) {
    failures.push(`${id}: source garden page not found: content/${folder}/${id}.md`)
  }

  const liveUrl = takeUrl(id, pageId, url)
  if (liveUrl) byDenoteId[id] = liveUrl
}

const chapters = source._chapters
if (!chapters || typeof chapters !== "object" || Array.isArray(chapters)) {
  failures.push("_chapters: mapping must include chapter ledger")
} else {
  for (const key of [...liveChapters].sort()) {
    const slug = CHAPTER_SLUG[key]
    if (!slug) {
      failures.push(`${key}: unknown chapter; no garden slug`)
      continue
    }
    const value = chapters[key]
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      failures.push(`${key}: in TOC but missing from mapping._chapters`)
      continue
    }
    const liveUrl = takeUrl(`chapter:${key}`, value.page_id, value.url)
    if (liveUrl) byGardenSlug[slug] = liveUrl
  }
}

if (failures.length > 0) {
  console.error(`[wikidocs-map] FAIL ${failures.length} issue(s)`)
  for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`)
  if (failures.length > 50) console.error(`... ${failures.length - 50} more`)
  process.exit(1)
}

const snapshot = {
  _meta: {
    schemaVersion: 2,
    bookUrl: "https://wikidocs.net/book/20676",
    source: "https://github.com/junghan0611/garden2wikidocs/blob/main/mapping.json",
    toc: "https://github.com/junghan0611/garden2wikidocs/blob/main/TOC.md",
    sourceSha256: crypto.createHash("sha256").update(sourceText).digest("hex"),
    tocSha256: crypto.createHash("sha256").update(tocText).digest("hex"),
    mappedNotes: Object.keys(byDenoteId).length,
    mappedSlugs: Object.keys(byGardenSlug).length,
  },
  byDenoteId,
  byGardenSlug,
}
const rendered = `${JSON.stringify(snapshot, null, 2)}\n`

if (checkOnly) {
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, "utf8") !== rendered) {
    console.error("[wikidocs-map] snapshot is stale; run without --check and review the diff")
    process.exit(1)
  }
  console.log(
    `[wikidocs-map] OK snapshot current: notes=${snapshot._meta.mappedNotes} slugs=${snapshot._meta.mappedSlugs} warnings=${warnings.length}`,
  )
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, rendered)
  console.log(
    `[wikidocs-map] wrote ${path.relative(ROOT, OUTPUT)}: notes=${snapshot._meta.mappedNotes} slugs=${snapshot._meta.mappedSlugs}`,
  )
}

for (const warning of warnings) console.log(`[wikidocs-map] warn ${warning}`)
if (warnings.length === 0) {
  console.log("[wikidocs-map] live TOC members all have recovered page_id values")
}
