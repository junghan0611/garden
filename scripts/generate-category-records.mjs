#!/usr/bin/env node
// Category records: schema.org ItemList sidecars for autholog + five folders.
// Representation URL is the .jsonld file. Collection @id is the human HTML
// page + #itemlist. Item nodes reuse existing #article ids; no @type on items.
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const SITE = "https://notes.junghanacs.com"
const SECTIONS = ["notes", "botlog", "meta", "bib", "journal"]
const DENOTE_MD = /^\d{8}T\d{6}.*\.md$/

export const RECORDS = [
  {
    name: "autholog",
    kind: "tag",
    tag: "autholog",
    out: path.join("public", "tags", "autholog.jsonld"),
    pageUrl: `${SITE}/tags/autholog`,
    listId: `${SITE}/tags/autholog#itemlist`,
    dateType: "modified",
  },
  {
    name: "notes",
    kind: "section",
    section: "notes",
    out: path.join("public", "notes.jsonld"),
    pageUrl: `${SITE}/notes/`,
    listId: `${SITE}/notes/#itemlist`,
    dateType: "modified",
  },
  {
    name: "meta",
    kind: "section",
    section: "meta",
    out: path.join("public", "meta.jsonld"),
    pageUrl: `${SITE}/meta/`,
    listId: `${SITE}/meta/#itemlist`,
    dateType: "modified",
  },
  {
    name: "bib",
    kind: "section",
    section: "bib",
    out: path.join("public", "bib.jsonld"),
    pageUrl: `${SITE}/bib/`,
    listId: `${SITE}/bib/#itemlist`,
    dateType: "modified",
  },
  {
    name: "botlog",
    kind: "section",
    section: "botlog",
    out: path.join("public", "botlog.jsonld"),
    pageUrl: `${SITE}/botlog/`,
    listId: `${SITE}/botlog/#itemlist`,
    dateType: "modified",
  },
  {
    name: "journal",
    kind: "section",
    section: "journal",
    out: path.join("public", "journal.jsonld"),
    pageUrl: `${SITE}/journal/`,
    listId: `${SITE}/journal/#itemlist`,
    dateType: "created",
  },
]

export function frontmatter(src) {
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

export function yamlScalar(value = "") {
  const raw = value.trim()
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\")
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1)
  }
  return raw
}

export function parseTags(value = "") {
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
      .map((s) => yamlScalar(s.trim()))
      .filter(Boolean)
  }
  return raw
    .split(/[\s,]+/)
    .map((s) => yamlScalar(s))
    .filter(Boolean)
}

export function parseDateMs(value) {
  const ms = Date.parse(yamlScalar(value))
  return Number.isFinite(ms) ? ms : 0
}

export function listingDateMs(date, lastmod, dateType) {
  if (dateType === "created") return parseDateMs(date)
  return parseDateMs(lastmod || date)
}

export function compareEntries(a, b, dateType) {
  const aMs = listingDateMs(a.date, a.lastmod, dateType)
  const bMs = listingDateMs(b.date, b.lastmod, dateType)
  const aDated = aMs > 0
  const bDated = bMs > 0
  if (aDated && bDated && aMs !== bMs) return bMs - aMs
  if (aDated && !bDated) return -1
  if (!aDated && bDated) return 1
  const aTitle = (a.title || "").toLowerCase()
  const bTitle = (b.title || "").toLowerCase()
  return aTitle.localeCompare(bTitle)
}

export function readDenoteEntry(section, file) {
  const src = fs.readFileSync(file, "utf8")
  const fm = frontmatter(src)
  const title = yamlScalar(fm.title || "")
  if (!title) return null
  const tags = parseTags(fm.tags)
  const date = yamlScalar(fm.date || "")
  const lastmod = yamlScalar(fm.lastmod || "")
  const description = yamlScalar(fm.description || "")
  const stem = path.basename(file, ".md")
  const slug = `${section}/${stem}`
  const url = `${SITE}/${slug}`
  return { section, stem, slug, url, title, tags, date, lastmod, description }
}

export function collectSection(section) {
  const dir = path.join("content", section)
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const name of fs.readdirSync(dir)) {
    if (!DENOTE_MD.test(name)) continue
    const entry = readDenoteEntry(section, path.join(dir, name))
    if (entry) out.push(entry)
  }
  return out
}

export function membersFor(record) {
  if (record.kind === "tag") {
    const all = SECTIONS.flatMap(collectSection)
    return all.filter((entry) => entry.tags.includes(record.tag))
  }
  return collectSection(record.section)
}

function itemFromEntry(entry) {
  const item = {
    "@id": `${entry.url}#article`,
    url: entry.url,
    name: entry.title,
  }
  if (entry.tags.length) item.keywords = entry.tags.join(", ")
  if (entry.date) item.datePublished = entry.date
  if (entry.lastmod || entry.date) item.dateModified = entry.lastmod || entry.date
  if (entry.description) item.description = entry.description
  return item
}

export function buildRecord(record) {
  const members = membersFor(record).slice().sort((a, b) => compareEntries(a, b, record.dateType))
  const doc = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": record.listId,
    name: record.name,
    url: record.pageUrl,
    numberOfItems: members.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    isPartOf: { "@id": `${SITE}/#website` },
    itemListElement: members.map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: itemFromEntry(entry),
    })),
  }
  return { doc, members }
}

function writeRecord(record) {
  const { doc, members } = buildRecord(record)
  fs.mkdirSync(path.dirname(record.out), { recursive: true })
  fs.writeFileSync(record.out, `${JSON.stringify(doc)}\n`)
  const bytes = fs.statSync(record.out).size
  console.error(`[category-record] ${record.name} ${members.length} items → ${record.out} (${bytes} bytes)`)
  return { name: record.name, items: members.length, bytes, out: record.out }
}

const isMain =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  for (const record of RECORDS) writeRecord(record)
}
