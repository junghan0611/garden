#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const SITE = "https://notes.junghanacs.com"
const SECTIONS = ["botlog", "notes", "meta", "bib"]
const PER_SECTION_LIMIT = 5
const HIGHLIGHT_LIMIT = 8

const sectionBoostDays = {
  botlog: 5,
  notes: 4,
  bib: 1,
  meta: 0,
}

const day = 24 * 60 * 60 * 1000

function frontmatter(src) {
  if (!src.startsWith("---\n")) return {}
  const end = src.indexOf("\n---", 4)
  if (end === -1) return {}
  const fm = src.slice(4, end)
  const out = {}
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].trim()
  }
  return out
}

function cleanScalar(value = "") {
  return value.replace(/^['"]|['"]$/g, "").trim()
}

function parseTags(value = "") {
  const raw = value.trim()
  if (!raw) return []
  if (raw.startsWith("[")) {
    try {
      return JSON.parse(raw.replace(/'/g, '"')).map(String)
    } catch {}
    return raw
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((s) => cleanScalar(s.trim()))
      .filter(Boolean)
  }
  return raw
    .split(/[\s,]+/)
    .map((s) => cleanScalar(s))
    .filter(Boolean)
}

function parseDate(value) {
  const ms = Date.parse(cleanScalar(value))
  return Number.isFinite(ms) ? ms : 0
}

function excerpt(value = "") {
  const text = cleanScalar(value).replace(/\s+/g, " ")
  return text.length > 180 ? `${text.slice(0, 177)}…` : text
}

function entryFor(section, file) {
  const src = fs.readFileSync(file, "utf8")
  const fm = frontmatter(src)
  const title = cleanScalar(fm.title || fm.today || "")
  const updatedRaw = cleanScalar(fm.lastmod || fm.date || "")
  const updatedMs = parseDate(updatedRaw)
  if (!title || !updatedMs) return null

  const tags = parseTags(fm.tags)
  const stem = path.basename(file, ".md")
  const slug = `${section}/${stem}`
  const url = `${SITE}/${slug}`
  const description = excerpt(fm.description || "")
  const tagSet = new Set(tags.map((t) => t.toLowerCase()))

  let score = updatedMs + (sectionBoostDays[section] ?? 0) * day
  if (tagSet.has("autholog")) score += 21 * day
  if (tagSet.has("llmlog")) score += 14 * day
  if (tagSet.has("ai") || tagSet.has("agent") || tagSet.has("harness")) score += 3 * day
  if (/^@힣/.test(title)) score += 14 * day
  if (/힣|GLG|GLGMAN|Authology|어쏠로지|Being-to-Being|존재 대 존재/.test(`${title} ${description}`)) {
    score += 7 * day
  }

  return { section, title, updatedRaw, updatedMs, tags, slug, url, description, score }
}

function collect() {
  const entries = []
  for (const section of SECTIONS) {
    const dir = path.join("content", section)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      if (!/^\d{8}T\d{6}.*\.md$/.test(name)) continue
      const entry = entryFor(section, path.join(dir, name))
      if (entry) entries.push(entry)
    }
  }
  return entries
}

function renderItem(entry, { withDescription = false } = {}) {
  const date = entry.updatedRaw.slice(0, 10)
  const tagHint = entry.tags.length ? `; tags: ${entry.tags.slice(0, 6).join(", ")}` : ""
  const lines = [`- [${entry.section}] ${entry.title}: ${entry.url}`]
  lines.push(`  - updated: ${date}${tagHint}`)
  if (withDescription && entry.description) lines.push(`  - ${entry.description}`)
  return lines.join("\n")
}

const entries = collect()
const bySection = new Map()
for (const section of SECTIONS) {
  bySection.set(
    section,
    entries
      .filter((entry) => entry.section === section)
      .sort((a, b) => b.updatedMs - a.updatedMs || a.title.localeCompare(b.title, "ko"))
      .slice(0, PER_SECTION_LIMIT),
  )
}

const highlighted = [...entries]
  .sort((a, b) => b.score - a.score || b.updatedMs - a.updatedMs)
  .slice(0, HIGHLIGHT_LIMIT)

console.log("## Recent Updates (context-weighted, auto-generated at build time)")
console.log("")
console.log("> Selection uses frontmatter `lastmod` first, then `date`. The highlighted list boosts high-signal garden-native entries such as `autholog`, `@힣` notes, botlog, AI/agent/harness notes, and identity/Authology/Being-to-Being vocabulary.")
console.log("")
console.log("### highlighted")
for (const entry of highlighted) console.log(renderItem(entry, { withDescription: true }))
console.log("")

for (const section of SECTIONS) {
  console.log(`### ${section}`)
  for (const entry of bySection.get(section) ?? []) console.log(renderItem(entry))
  console.log("")
}

console.log(`Last updated: ${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}`)
