#!/usr/bin/env node
// Catalog record for the autholog core set.
// Writes public/tags/autholog.jsonld from content/*.md frontmatter.
// Fields on each item must match Head.tsx #article (url, name, keywords,
// datePublished, dateModified, description). No @type on items. No new @id.
import fs from "node:fs"
import path from "node:path"

const SITE = "https://notes.junghanacs.com"
const SECTIONS = ["notes", "botlog", "meta", "bib", "journal"]
const OUT = path.join("public", "tags", "autholog.jsonld")

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

function parseDateMs(value) {
  const ms = Date.parse(cleanScalar(value))
  return Number.isFinite(ms) ? ms : 0
}

function entryFor(section, file) {
  const src = fs.readFileSync(file, "utf8")
  const fm = frontmatter(src)
  const tags = parseTags(fm.tags)
  if (!tags.includes("autholog")) return null

  const title = cleanScalar(fm.title || "")
  const date = cleanScalar(fm.date || "")
  const lastmod = cleanScalar(fm.lastmod || "")
  const description = cleanScalar(fm.description || "")
  if (!title) return null

  const stem = path.basename(file, ".md")
  const slug = `${section}/${stem}`
  const url = `${SITE}/${slug}`
  const item = {
    "@id": `${url}#article`,
    url,
    name: title,
    keywords: tags.join(", "),
  }
  if (date) item.datePublished = date
  if (lastmod || date) item.dateModified = lastmod || date
  if (description) item.description = description

  return {
    sortMs: parseDateMs(lastmod || date),
    item,
  }
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
  entries.sort((a, b) => b.sortMs - a.sortMs || a.item.url.localeCompare(b.item.url))
  return entries
}

const entries = collect()
const doc = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": `${SITE}/tags/autholog#itemlist`,
  name: "autholog",
  url: `${SITE}/tags/autholog`,
  numberOfItems: entries.length,
  itemListOrder: "https://schema.org/ItemListOrderDescending",
  isPartOf: { "@id": `${SITE}/#website` },
  itemListElement: entries.map((entry, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: entry.item,
  })),
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(doc)}\n`)
console.error(`[autholog.jsonld] ${entries.length} items → ${OUT} (${fs.statSync(OUT).size} bytes)`)
