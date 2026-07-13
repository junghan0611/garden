#!/usr/bin/env node
// Validate the JSON-LD contract emitted by Quartz Head.tsx.
// Scope: this is not a full schema.org validator. It guards the garden-specific
// invariants we can verify from the generated public/*.html output.

import fs from "node:fs"
import path from "node:path"

const PUBLIC_DIR = process.argv[2] ?? "public"
const ORIGIN = "https://notes.junghanacs.com"
const EXPECTED_TYPES = {
  notes: "Article",
  botlog: "TechArticle",
  bib: "CreativeWork",
  journal: "CreativeWork",
  meta: ["Article", "DefinedTerm"],
}
const CONTENT_SECTIONS = new Set(Object.keys(EXPECTED_TYPES))

const failures = []
const stats = {
  html: 0,
  ldBlocks: 0,
  contentNodes: 0,
  bySection: {},
  nodeTypes: {},
  contentTypes: {},
}

function fail(file, message) {
  failures.push(`${file}: ${message}`)
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    if (entry.isFile() && full.endsWith(".html")) return [full]
    return []
  })
}

function arrayEq(a, b) {
  return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i])
}

function typeKey(type) {
  return Array.isArray(type) ? type.join("+") : String(type)
}

function expectType(actual, expected) {
  return Array.isArray(expected) ? arrayEq(actual, expected) : actual === expected
}

function graphNodes(json) {
  const graph = json?.["@graph"]
  return Array.isArray(graph) ? graph : []
}

function extractJsonLdBlocks(html) {
  const blocks = []
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  let match
  while ((match = re.exec(html))) blocks.push(match[1])
  return blocks
}

function validateHome(file, graph, html) {
  const person = graph.find((node) => node["@type"] === "Person")
  const website = graph.find((node) => node["@type"] === "WebSite")
  const profile = graph.find((node) => node["@type"] === "ProfilePage")

  if (!person) fail(file, "missing Person node")
  if (!website) fail(file, "missing WebSite node")
  if (!profile) fail(file, "missing ProfilePage node")

  if (person) {
    if (person["@id"] !== `${ORIGIN}/#person`) fail(file, "Person @id changed")
    if (person.image !== `${ORIGIN}/static/profile.jpg`) fail(file, "Person.image changed")
    if (!Array.isArray(person.sameAs) || !person.sameAs.includes("https://junghanacs.com/")) {
      fail(file, "Person.sameAs missing GLG-approved reciprocal home domain")
    }
  }

  if (website) {
    if (website["@id"] !== `${ORIGIN}/#website`) fail(file, "WebSite @id changed")
    if (website.url !== ORIGIN) fail(file, "WebSite.url must be origin")
  }

  if (profile) {
    if (profile.url !== ORIGIN) fail(file, "ProfilePage.url must be origin")
    if (profile.mainEntity?.["@id"] !== `${ORIGIN}/#person`) fail(file, "ProfilePage.mainEntity must point to #person")
    if (profile.primaryImageOfPage?.url !== `${ORIGIN}/static/profile.jpg`) {
      fail(file, "ProfilePage.primaryImageOfPage.url changed")
    }
  }

  const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1]
  const twitterUrl = html.match(/<meta property="twitter:url" content="([^"]+)"/)?.[1]
  if (ogUrl !== ORIGIN) fail(file, `home og:url must be origin, got ${ogUrl}`)
  if (twitterUrl !== ORIGIN) fail(file, `home twitter:url must be origin, got ${twitterUrl}`)
}

function validateContent(file, graph) {
  const rel = path.relative(PUBLIC_DIR, file)
  const [section, basename] = rel.split(path.sep)
  const id = basename?.replace(/\.html$/, "")

  if (!CONTENT_SECTIONS.has(section)) {
    fail(file, `unexpected Denote JSON-LD section: ${section}`)
    return
  }

  stats.contentNodes++
  stats.bySection[section] = (stats.bySection[section] ?? 0) + 1

  const contentNodes = graph.filter((node) => node["@id"]?.endsWith("#article"))
  if (contentNodes.length !== 1) {
    fail(file, `expected exactly 1 content #article node, got ${contentNodes.length}`)
    return
  }
  const content = contentNodes[0]
  const expectedType = EXPECTED_TYPES[section]
  if (!expectType(content["@type"], expectedType)) {
    fail(file, `wrong @type for ${section}: got ${JSON.stringify(content["@type"])} expected ${JSON.stringify(expectedType)}`)
  }

  const key = typeKey(content["@type"])
  stats.contentTypes[key] = (stats.contentTypes[key] ?? 0) + 1

  const expectedUrl = `${ORIGIN}/${section}/${id}`
  if (content["@id"] !== `${expectedUrl}#article`) fail(file, "content @id changed")
  if (content.url !== expectedUrl) fail(file, "content.url changed")
  if (content.mainEntityOfPage !== expectedUrl) fail(file, "content.mainEntityOfPage changed")
  if (content.author?.["@id"] !== `${ORIGIN}/#person`) fail(file, "content.author must point to #person")
  if (content.publisher?.["@id"] !== `${ORIGIN}/#person`) fail(file, "content.publisher must point to #person")
  if (content.isPartOf?.["@id"] !== `${ORIGIN}/#website`) fail(file, "content.isPartOf must point to #website")
  if ("breadcrumb" in content) fail(file, "content node must not carry breadcrumb property; keep BreadcrumbList standalone")
  if (!content.isBasedOn?.startsWith("https://github.com/junghan0611/garden/blob/main/content/")) {
    fail(file, "content.isBasedOn missing GitHub source URL")
  }

  const blogNodes = graph.filter((node) => node["@type"] === "Blog" || node["@id"] === `${ORIGIN}/#blog`)
  if (blogNodes.length > 0) fail(file, "Blog node must not be emitted; garden content is part of #website")

  const crumbs = graph.filter((node) => node["@type"] === "BreadcrumbList")
  if (crumbs.length !== 1) {
    fail(file, `expected exactly 1 standalone BreadcrumbList, got ${crumbs.length}`)
  } else {
    const crumb = crumbs[0]
    const items = crumb.itemListElement ?? []
    if (crumb["@id"] !== `${expectedUrl}#breadcrumb`) fail(file, "BreadcrumbList @id changed")
    if (!arrayEq(items.map((item) => item.position), [1, 2, 3])) fail(file, "BreadcrumbList positions must be 1,2,3")
    if (!arrayEq(items.map((item) => item.item), [ORIGIN, `${ORIGIN}/${section}/`, expectedUrl])) {
      fail(file, "BreadcrumbList items must be Home → section → page")
    }
  }
}

if (!fs.existsSync(PUBLIC_DIR)) {
  console.error(`[jsonld] public directory not found: ${PUBLIC_DIR}`)
  process.exit(1)
}

const files = walk(PUBLIC_DIR)
stats.html = files.length

for (const section of CONTENT_SECTIONS) {
  if (!fs.existsSync(path.join(PUBLIC_DIR, section, "index.html"))) {
    fail(`${PUBLIC_DIR}/${section}/index.html`, "missing section index for breadcrumb target")
  }
}

for (const file of files) {
  const html = fs.readFileSync(file, "utf8")
  const blocks = extractJsonLdBlocks(html)
  stats.ldBlocks += blocks.length

  for (const block of blocks) {
    let json
    try {
      json = JSON.parse(block)
    } catch (error) {
      fail(file, `invalid JSON-LD: ${error.message}`)
      continue
    }

    const graph = graphNodes(json)
    if (!graph.length) {
      fail(file, "JSON-LD must contain @graph")
      continue
    }

    for (const node of graph) {
      const key = typeKey(node["@type"])
      if (key !== "undefined") stats.nodeTypes[key] = (stats.nodeTypes[key] ?? 0) + 1
    }

    const content = graph.find((node) => node["@id"]?.endsWith("#article"))
    if (path.relative(PUBLIC_DIR, file) === "index.html") validateHome(file, graph, html)
    if (content) validateContent(file, graph)
  }
}

if (stats.ldBlocks === 0) fail(PUBLIC_DIR, "no JSON-LD blocks found")

if (failures.length > 0) {
  console.error(`[jsonld] FAIL ${failures.length} issue(s)`) 
  for (const message of failures.slice(0, 50)) console.error(`- ${message}`)
  if (failures.length > 50) console.error(`... ${failures.length - 50} more`)
  console.error(JSON.stringify(stats, null, 2))
  process.exit(1)
}

console.log(`[jsonld] OK html=${stats.html} ld=${stats.ldBlocks} content=${stats.contentNodes}`)
console.log(`[jsonld] sections=${JSON.stringify(stats.bySection)}`)
console.log(`[jsonld] contentTypes=${JSON.stringify(stats.contentTypes)}`)
