#!/usr/bin/env node
// Independent check of category-record sidecars against public HTML #article
// nodes and content/ membership. Does not import the generator's build path.
import fs from "node:fs"
import path from "node:path"

const SITE = "https://notes.junghanacs.com"
const PUBLIC_DIR = process.argv[2] ?? "public"
const SECTIONS = ["notes", "botlog", "meta", "bib", "journal"]
const DENOTE_MD = /^\d{8}T\d{6}.*\.md$/
const ARTICLE_FIELDS = ["@id", "url", "name", "keywords", "datePublished", "dateModified", "description"]

const RECORDS = [
  {
    name: "autholog",
    kind: "tag",
    tag: "autholog",
    file: path.join(PUBLIC_DIR, "tags", "autholog.jsonld"),
    pageUrl: `${SITE}/tags/autholog`,
    listId: `${SITE}/tags/autholog#itemlist`,
    dateType: "modified",
  },
  {
    name: "notes",
    kind: "section",
    section: "notes",
    file: path.join(PUBLIC_DIR, "notes.jsonld"),
    pageUrl: `${SITE}/notes/`,
    listId: `${SITE}/notes/#itemlist`,
    dateType: "modified",
  },
  {
    name: "meta",
    kind: "section",
    section: "meta",
    file: path.join(PUBLIC_DIR, "meta.jsonld"),
    pageUrl: `${SITE}/meta/`,
    listId: `${SITE}/meta/#itemlist`,
    dateType: "modified",
  },
  {
    name: "bib",
    kind: "section",
    section: "bib",
    file: path.join(PUBLIC_DIR, "bib.jsonld"),
    pageUrl: `${SITE}/bib/`,
    listId: `${SITE}/bib/#itemlist`,
    dateType: "modified",
  },
  {
    name: "botlog",
    kind: "section",
    section: "botlog",
    file: path.join(PUBLIC_DIR, "botlog.jsonld"),
    pageUrl: `${SITE}/botlog/`,
    listId: `${SITE}/botlog/#itemlist`,
    dateType: "modified",
  },
  {
    name: "journal",
    kind: "section",
    section: "journal",
    file: path.join(PUBLIC_DIR, "journal.jsonld"),
    pageUrl: `${SITE}/journal/`,
    listId: `${SITE}/journal/#itemlist`,
    dateType: "created",
  },
]

const failures = []
const fail = (message) => failures.push(message)
const receipt = []

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

function yamlScalar(value = "") {
  const raw = value.trim()
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\")
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1)
  }
  return raw
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
      .map((s) => yamlScalar(s.trim()))
      .filter(Boolean)
  }
  return raw
    .split(/[\s,]+/)
    .map((s) => yamlScalar(s))
    .filter(Boolean)
}

function parseDateMs(value) {
  const ms = Date.parse(yamlScalar(value))
  return Number.isFinite(ms) ? ms : 0
}

function listingDateMs(date, lastmod, dateType) {
  if (dateType === "created") return parseDateMs(date)
  return parseDateMs(lastmod || date)
}

function compareEntries(a, b, dateType) {
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

function readDenoteEntry(section, file) {
  const src = fs.readFileSync(file, "utf8")
  const fm = frontmatter(src)
  const title = yamlScalar(fm.title || "")
  if (!title) return null
  const tags = parseTags(fm.tags)
  const date = yamlScalar(fm.date || "")
  const lastmod = yamlScalar(fm.lastmod || "")
  const stem = path.basename(file, ".md")
  const slug = `${section}/${stem}`
  return {
    section,
    slug,
    url: `${SITE}/${slug}`,
    title,
    tags,
    date,
    lastmod,
  }
}

function collectSection(section) {
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

function expectedMembers(record) {
  if (record.kind === "tag") {
    return SECTIONS.flatMap(collectSection).filter((entry) => entry.tags.includes(record.tag))
  }
  return collectSection(record.section)
}

function extractArticle(htmlPath) {
  if (!fs.existsSync(htmlPath)) return { error: `missing HTML ${htmlPath}` }
  const html = fs.readFileSync(htmlPath, "utf8")
  const blocks = []
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  let match
  while ((match = re.exec(html))) blocks.push(match[1])
  for (const block of blocks) {
    let json
    try {
      json = JSON.parse(block)
    } catch {
      continue
    }
    const graph = Array.isArray(json?.["@graph"]) ? json["@graph"] : []
    const article = graph.find((node) => node?.["@id"]?.endsWith("#article"))
    if (article) return { article }
  }
  return { error: `no #article in ${htmlPath}` }
}

function htmlPathForUrl(url) {
  const prefix = `${SITE}/`
  if (!url.startsWith(prefix)) return null
  return path.join(PUBLIC_DIR, `${url.slice(prefix.length)}.html`)
}

function checkRecord(record) {
  if (!fs.existsSync(record.file)) {
    fail(`${record.name}: missing ${record.file}`)
    return
  }
  const bytes = fs.statSync(record.file).size
  let doc
  try {
    doc = JSON.parse(fs.readFileSync(record.file, "utf8"))
  } catch (error) {
    fail(`${record.name}: invalid JSON (${error.message})`)
    return
  }

  if (doc["@type"] !== "ItemList") fail(`${record.name}: @type must be ItemList`)
  if (doc["@id"] !== record.listId) fail(`${record.name}: @id ${doc["@id"]} != ${record.listId}`)
  if (doc.url !== record.pageUrl) fail(`${record.name}: url ${doc.url} != ${record.pageUrl}`)

  const elements = doc.itemListElement
  if (!Array.isArray(elements)) {
    fail(`${record.name}: itemListElement missing`)
    return
  }
  if (doc.numberOfItems !== elements.length) {
    fail(`${record.name}: numberOfItems ${doc.numberOfItems} != length ${elements.length}`)
  }

  const expected = expectedMembers(record).slice().sort((a, b) => compareEntries(a, b, record.dateType))
  const expectedUrls = expected.map((entry) => entry.url)
  const actualUrls = elements.map((el) => el?.item?.url)
  if (actualUrls.length !== expectedUrls.length) {
    fail(`${record.name}: membership size ${actualUrls.length} != expected ${expectedUrls.length}`)
  }
  const extra = actualUrls.filter((url) => !expectedUrls.includes(url))
  const missing = expectedUrls.filter((url) => !actualUrls.includes(url))
  if (extra.length) fail(`${record.name}: unexpected urls ${extra.slice(0, 5).join(", ")}`)
  if (missing.length) fail(`${record.name}: missing urls ${missing.slice(0, 5).join(", ")}`)

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    if (el?.["@type"] !== "ListItem") fail(`${record.name}[${i}]: @type must be ListItem`)
    if (el?.position !== i + 1) fail(`${record.name}[${i}]: position ${el?.position} != ${i + 1}`)
    const item = el?.item
    if (!item) {
      fail(`${record.name}[${i}]: missing item`)
      continue
    }
    if (Object.hasOwn(item, "@type")) fail(`${record.name}[${i}]: item must not have @type`)
    if (!item["@id"]?.endsWith("#article")) fail(`${record.name}[${i}]: @id must end with #article`)
    if (expectedUrls[i] && item.url !== expectedUrls[i]) {
      fail(`${record.name}[${i}]: order ${item.url} != expected ${expectedUrls[i]}`)
    }

    const htmlPath = htmlPathForUrl(item.url)
    if (!htmlPath) {
      fail(`${record.name}[${i}]: url not on site ${item.url}`)
      continue
    }
    const { article, error } = extractArticle(htmlPath)
    if (error) {
      fail(`${record.name}[${i}]: ${error}`)
      continue
    }
    for (const field of ARTICLE_FIELDS) {
      const got = item[field]
      const want = article[field]
      if (got !== want) {
        fail(`${record.name}[${i}]: ${field} sidecar=${JSON.stringify(got)} html=${JSON.stringify(want)}`)
      }
    }
  }

  receipt.push(`${record.name} items=${elements.length} bytes=${bytes} file=${record.file}`)
}

for (const record of RECORDS) checkRecord(record)

if (failures.length > 0) {
  console.error(`[category-records] FAIL ${failures.length} issue(s)`)
  for (const message of failures.slice(0, 40)) console.error(`- ${message}`)
  if (failures.length > 40) console.error(`... ${failures.length - 40} more`)
  process.exit(1)
}

console.log(`[category-records] OK ${receipt.join(" | ")}`)
