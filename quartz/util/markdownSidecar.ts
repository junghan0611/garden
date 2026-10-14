import yaml from "js-yaml"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import { visit } from "unist-util-visit"
import type { Root } from "mdast"
import { FullSlug, transformLink } from "./path"

// Agent-facing Markdown twin of a published page, served at /<slug>.md next to /<slug>.
// Built from the committed ox-hugo export (already privacy-filtered by run.sh), not from the rendered
// tree, so the author's prose survives byte for byte. Only export plumbing is rewritten or dropped:
// Hugo shortcodes, HTML comments, org span wrappers, csl divs, heading anchors. Link and image
// destinations become absolute URLs — a copied twin has no base URL — and local paths lose their link.
// Code (fenced, indented, inline) is never touched.

export const SIDECAR_AUTHOR = "Junghan Kim"
// Frontmatter keys a sidecar may carry, in output order. Nothing else from the source is copied.
export const SIDECAR_FRONTMATTER_KEYS = [
  "title",
  "url",
  "author",
  "date",
  "lastmod",
  "tags",
  "description",
] as const

/** The sidecar slug for a page, or undefined when the page gets no .md (indexes, tag pages, 404). */
export function markdownSidecarSlug(slug?: string, filePath?: string): string | undefined {
  if (!slug || !filePath?.endsWith(".md")) return undefined
  if (slug === "index" || slug === "404" || slug.endsWith("/index")) return undefined
  if (slug.startsWith("tags/")) return undefined
  return slug
}

export interface SidecarResult {
  markdown: string
  /** Shortcodes this converter does not know. Left in place so the output gate can name them. */
  unknownShortcodes: string[]
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const RELREF = /\{\{<\s*relref\s+"([^"]+)"\s*>\}\}/g
const FIGURE = /\{\{<\s*figure\s+([\s\S]*?)\s*>\}\}/g
const FIGURE_ATTR = /(\w+)="((?:\\.|[^"\\])*)"/g
const PAIRED_SHORTCODE = /\{\{<\s*\/?(?:callout|sidenote|details)\b[^}]*>\}\}/g
const ANY_SHORTCODE = /\{\{[<%][\s\S]*?[>%]\}\}/g
const HTML_COMMENT = /<!--[\s\S]*?-->/g
const STYLE_BLOCK = /<style\b[\s\S]*?<\/style>/g
const HEADING_ANCHOR = / \{#[^}\s]+\}$/gm
const TIMESTAMP = /<span class="timestamp-wrapper"><span class="timestamp">([^<]*)<\/span><\/span>/g
const ORG_SPAN = /<span class="(?:org-[a-z-]+|underline)"[^>]*>([^<]*)<\/span>/g
const ORG_TODO = /<span class="org-todo[^"]*">[A-Z]+<\/span>\s*/g
const CSL_BODY = /<div class="csl-bib-body">\s*([\s\S]*?)\n[ \t]*<\/div>/g
const CSL_ENTRY = /<div class="csl-entry">([\s\S]*?)<\/div>/g
const EMPTY_ANCHOR = /<a id="[^"]*"><\/a>/g
const LINK = /<a href="([^"]+)">([^<]*)<\/a>/g
const ITALIC = /<i>([^<]*)<\/i>/g
const LOCAL_PATH = /^(?:\/home\/|~|file:)/

const escapeLabel = (text: string) => text.replace(/([[\]\\])/g, "\\$1")

/**
 * Where a link or image destination points once the twin stands alone: an absolute URL, or null for a
 * local path that must not become a link. Site paths resolve exactly as CrawlLinks resolves them for the
 * HTML page (transformLink, "absolute" strategy), so both surfaces point at the same place.
 */
export function resolveDestination(url: string, slug: string, origin: string): string | null {
  if (LOCAL_PATH.test(url)) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url
  if (url.startsWith("//")) return `https:${url}`
  const page = `${origin}/${slug}`
  if (url.startsWith("#")) return `${page}${url}`
  try {
    return new URL(
      transformLink(slug as FullSlug, url, { strategy: "absolute", allSlugs: [] }),
      page,
    ).href
  } catch {
    return new URL(url.replace(/^(\.\.?\/)+/, ""), `${origin}/`).href
  }
}

type Resolve = (url: string) => string | null

function figure(attrs: string, resolve: Resolve): string {
  const values = new Map<string, string>()
  for (const [, key, value] of attrs.matchAll(FIGURE_ATTR))
    values.set(key, value.replace(/\\(.)/g, "$1"))
  const src = values.get("src")
  const alt = (values.get("caption") ?? "")
    .replace(/<span class="figure-number">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim()
  const target = src ? resolve(src) : null
  return target === null ? alt : `![${escapeLabel(alt)}](${target})`
}

function cleanProse(text: string, resolve: Resolve, unknown: Set<string>): string {
  let s = text.replace(HTML_COMMENT, "").replace(STYLE_BLOCK, "")
  // Destinations this converter writes itself are resolved here; author-written Markdown links are
  // left to rewriteDestinations, which needs a parse.
  s = s.replace(RELREF, (m, target: string) => resolve(target) ?? m)
  s = s.replace(FIGURE, (_m, attrs: string) => figure(attrs, resolve))
  s = s.replace(PAIRED_SHORTCODE, "")
  for (const [m] of s.matchAll(ANY_SHORTCODE)) unknown.add(m.slice(0, 60))
  s = s.replace(HEADING_ANCHOR, "")
  s = s.replace(TIMESTAMP, "$1").replace(ORG_TODO, "").replace(ORG_SPAN, "$1")
  s = s.replace(CSL_BODY, (_m, inner: string) =>
    [...inner.matchAll(CSL_ENTRY)].map(([, entry]) => `- ${entry.trim()}`).join("\n"),
  )
  s = s.replace(CSL_ENTRY, "$1")
  s = s.replace(EMPTY_ANCHOR, "")
  s = s.replace(LINK, (_m, href: string, label: string) => {
    const target = resolve(href)
    if (target === null) return label
    return label === href && /^https?:\/\//.test(href)
      ? `<${href}>`
      : `[${escapeLabel(label)}](${target})`
  })
  s = s.replace(ITALIC, "*$1*")
  return s.replace(/\n{3,}/g, "\n\n")
}

type Range = { start: number; end: number; kind: "code" | "comment" }

// One frozen processor shared by every page instead of a new one per parse.
const processor = unified().use(remarkParse).use(remarkGfm).freeze()
const parse = (markdown: string) => processor.parse(markdown) as Root

/**
 * Source ranges prose cleanup must treat specially. Code — fenced, indented or inline — is copied
 * verbatim. An HTML node holding a comment is dropped up to its close, or to the node's end when the
 * comment never closes, which is how CommonMark hides everything after it from the rendered page.
 */
function specialRanges(body: string): Range[] {
  const ranges: Range[] = []
  visit(parse(body), (node) => {
    if (!node.position) return
    const start = node.position.start.offset!
    const end = node.position.end.offset!
    if (node.type === "inlineCode" || node.type === "code")
      ranges.push({ start, end, kind: "code" })
    else if (node.type === "html" && node.value.includes("<!--"))
      ranges.push({ start, end, kind: "comment" })
  })
  return ranges.sort((a, b) => a.start - b.start)
}

// Cheap pre-check: a destination that is not already absolute may exist (in prose or code — code is
// harmless, the parse ignores it). Most pages have none once relref/figure/<a> are resolved, and
// skipping the second parse halves the emitter's time.
const NON_ABSOLUTE_HINT =
  /\]\(\s*<?(?!https?:\/\/|mailto:)|^ {0,3}\[[^\]\n]+\]:\s*<?(?!https?:\/\/|mailto:)/m

const INLINE_DESTINATION =
  /\]\(\s*(<[^>\n]*>|[^\s<][^\s]*?)(\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*\)$/
const DEFINITION_DESTINATION = /^(\s*\[[^\]]*\]:\s*)(<[^>\n]*>|\S+)/

/**
 * Make every link, image and definition destination absolute, found through the parsed tree so text
 * that merely looks like a link — and anything inside code — is left alone. A local destination keeps
 * its label and loses the link.
 */
function rewriteDestinations(markdown: string, slug: string, origin: string): string {
  const edits: Array<{ start: number; end: number; text: string }> = []
  visit(parse(markdown), (node) => {
    if (node.type !== "link" && node.type !== "image" && node.type !== "definition") return
    if (!node.position || /^(https?:|mailto:)/i.test(node.url)) return
    const start = node.position.start.offset!
    const end = node.position.end.offset!
    const source = markdown.slice(start, end)
    const target = resolveDestination(node.url, slug, origin)
    if (node.type === "definition") {
      const m = source.match(DEFINITION_DESTINATION)
      if (!m) return
      const text = target === null ? "" : `${m[1]}<${target}>${source.slice(m[0].length)}`
      edits.push({ start, end, text })
      return
    }
    const m = source.match(INLINE_DESTINATION)
    if (!m) return
    const labelEnd = source.length - m[0].length
    if (target === null) {
      edits.push({ start, end, text: source.slice(node.type === "image" ? 2 : 1, labelEnd) })
      return
    }
    const destStart = start + labelEnd + m[0].indexOf(m[1])
    edits.push({ start: destStart, end: destStart + m[1].length, text: target })
  })
  let out = markdown
  for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, start) + text + out.slice(end)
  }
  return out
}

function frontmatter(data: Record<string, unknown>, slug: string, origin: string): string {
  const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined)
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((t): t is string => typeof t === "string")
    : []
  const fields: Record<(typeof SIDECAR_FRONTMATTER_KEYS)[number], unknown> = {
    title: str(data.title) ?? slug,
    url: `${origin}/${slug}`,
    author: SIDECAR_AUTHOR,
    date: str(data.date),
    lastmod: str(data.lastmod),
    tags: tags.length ? tags : undefined,
    description: str(data.description),
  }
  const lines = SIDECAR_FRONTMATTER_KEYS.filter((k) => fields[k] !== undefined).map(
    (k) => `${k}: ${JSON.stringify(fields[k])}`,
  )
  return `---\n${lines.join("\n")}\n---\n`
}

/** Convert one ox-hugo export into its agent-facing Markdown. `origin` is e.g. https://notes.junghanacs.com */
export function toAgentMarkdown(raw: string, slug: string, origin: string): SidecarResult {
  const match = raw.match(FRONTMATTER)
  const data = match
    ? ((yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>) ?? {})
    : {}
  const body = match ? raw.slice(match[0].length) : raw

  const unknown = new Set<string>()
  const resolve: Resolve = (url) => resolveDestination(url, slug, origin)
  let out = ""
  let cursor = 0
  for (const { start, end, kind } of specialRanges(body)) {
    if (start < cursor) continue
    out += cleanProse(body.slice(cursor, start), resolve, unknown)
    const text = body.slice(start, end)
    out +=
      kind === "code"
        ? text
        : cleanProse(text.replace(/<!--[\s\S]*?(?:-->|$)/g, ""), resolve, unknown)
    cursor = end
  }
  out += cleanProse(body.slice(cursor), resolve, unknown)

  return {
    markdown: `${frontmatter(data, slug, origin)}\n${(NON_ABSOLUTE_HINT.test(out) ? rewriteDestinations(out, slug, origin) : out).trim()}\n`,
    unknownShortcodes: [...unknown],
  }
}
