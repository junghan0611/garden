import test, { describe } from "node:test"
import assert from "node:assert"
import { markdownSidecarSlug, toAgentMarkdown } from "./markdownSidecar"

const ORIGIN = "https://notes.junghanacs.com"
const SLUG = "notes/20250101T000000"
// Sanitized fixture: the shapes ox-hugo export actually produces, with placeholder text.
const page = (body: string, extraFrontmatter = "") =>
  [
    "---",
    'title: "노트 제목"',
    'description: "한 줄 설명"',
    "date: 2025-01-01T10:00:00+09:00",
    "lastmod: 2025-02-01T00:00:00+09:00",
    'tags: ["bib", "education"]',
    'categories: ["Noname"]',
    "draft: false",
    extraFrontmatter,
    "---",
    "",
    body,
  ].join("\n")
const convert = (body: string, extra = "") => toAgentMarkdown(page(body, extra), SLUG, ORIGIN)

describe("markdownSidecarSlug", () => {
  test("content pages get a twin; indexes, tag pages, 404 and non-md do not", () => {
    assert.strictEqual(markdownSidecarSlug(SLUG, `content/${SLUG}.md`), SLUG)
    assert.strictEqual(markdownSidecarSlug("index", "content/index.md"), undefined)
    assert.strictEqual(markdownSidecarSlug("notes/index", "content/notes/index.md"), undefined)
    assert.strictEqual(markdownSidecarSlug("tags/emacs", "content/tags/emacs.md"), undefined)
    assert.strictEqual(markdownSidecarSlug("404", undefined), undefined)
    assert.strictEqual(markdownSidecarSlug(SLUG, undefined), undefined)
  })
})

describe("toAgentMarkdown frontmatter", () => {
  test("only allowlisted keys, canonical url, public author", () => {
    const { markdown } = convert("본문", 'aliases: ["x"]\nsecret_field: "y"')
    const fm = markdown.split("\n---\n")[0]
    assert.deepStrictEqual(
      fm
        .split("\n")
        .slice(1)
        .map((l) => l.split(":")[0]),
      ["title", "url", "author", "date", "lastmod", "tags", "description"],
    )
    assert.ok(fm.includes(`url: "${ORIGIN}/${SLUG}"`))
    assert.ok(fm.includes('date: "2025-01-01T10:00:00+09:00"'))
    assert.ok(
      !markdown.includes("Noname") &&
        !markdown.includes("secret_field") &&
        !markdown.includes("draft"),
    )
  })
})

describe("toAgentMarkdown body", () => {
  test("relref becomes an absolute page URL, anchors kept", () => {
    const { markdown } = convert(
      '[a]({{< relref "/notes/20240101T000000.md" >}}) [b]({{< relref "/journal/20250101T000000.md#h-2025-01-01" >}})',
    )
    assert.ok(markdown.includes(`[a](${ORIGIN}/notes/20240101T000000)`))
    assert.ok(markdown.includes(`[b](${ORIGIN}/journal/20250101T000000#h-2025-01-01)`))
  })

  test("figure becomes an image; caption number dropped; local paths never become URLs", () => {
    const { markdown } = convert(
      [
        '{{< figure src="/images/a.png" caption="<span class=\\"figure-number\\">Figure 1: </span>circle" width="100%" >}}',
        '{{< figure src="/home/user/pic.png" >}}',
      ].join("\n\n"),
    )
    assert.ok(markdown.includes(`![circle](${ORIGIN}/images/a.png)`))
    assert.ok(!markdown.includes("/home/user"))
  })

  test("HTML comments go, including an unclosed one that hides a fence from the page", () => {
    const { markdown } = convert(
      [
        "앞 <!-- inline --> 뒤",
        "<!--list-separator-->",
        "",
        "<!-- from: /home/x",
        "```org",
        "숨김",
        "```",
      ].join("\n"),
    )
    assert.ok(markdown.includes("앞  뒤"))
    assert.ok(
      !markdown.includes("<!--") && !markdown.includes("숨김") && !markdown.includes("/home/x"),
    )
  })

  test("code is copied verbatim, plumbing inside it included", () => {
    const fenced =
      '```html\n<!-- keep -->\n{{< relref "/notes/a.md" >}}\n<span class="timestamp">t</span>\n```'
    const { markdown } = convert(`${fenced}\n\n\`<!-- inline keep -->\``)
    assert.ok(markdown.includes(fenced))
    assert.ok(markdown.includes("`<!-- inline keep -->`"))
  })

  test("org wrappers unwrap to their text; TODO keywords and heading anchors go", () => {
    const { markdown } = convert(
      [
        '## <span class="org-todo todo TODO">TODO</span> 할 일 {#할-일}',
        '-   <span class="timestamp-wrapper"><span class="timestamp">[2025-01-01 Wed 10:00]</span></span> <span class="org-mention">@junghan</span> <span class="org-hashtag">#tag</span>',
      ].join("\n\n"),
    )
    assert.ok(markdown.includes("## 할 일\n"))
    assert.ok(markdown.includes("-   [2025-01-01 Wed 10:00] @junghan #tag"))
    assert.ok(!markdown.includes("<span"))
  })

  test("csl bibliography becomes a list with plain links", () => {
    const { markdown } = convert(
      [
        "## BIBLIOGRAPHY",
        "",
        '<div class="csl-bib-body">',
        '  <div class="csl-entry"><a id="citeproc_bib_item_1"></a>Author. 2025. “Title.” <a href="https://example.com/a">https://example.com/a</a>.</div>',
        '  <div class="csl-entry"><a id="citeproc_bib_item_2"></a>Other. <i>Book</i>. <a href="https://example.com/b">site</a>.</div>',
        "</div>",
      ].join("\n"),
    )
    assert.ok(markdown.includes("- Author. 2025. “Title.” <https://example.com/a>."))
    assert.ok(markdown.includes("- Other. *Book*. [site](https://example.com/b)."))
    assert.ok(!markdown.includes("<div") && !markdown.includes("citeproc"))
  })

  test("paired shortcodes unwrap; unknown ones are reported and left in place", () => {
    const { markdown, unknownShortcodes } = convert(
      '{{< callout emoji="🔮" >}}\n안쪽\n{{< /callout >}}\n\n{{< newthing x="1" >}}',
    )
    assert.ok(markdown.includes("안쪽") && !markdown.includes("callout"))
    assert.deepStrictEqual(unknownShortcodes, ['{{< newthing x="1" >}}'])
  })
})

// Cases from the 2026-10-14 implementation review (sanitized; each reproduced a defect first).
describe("review cases", () => {
  test("indented code is code: copied verbatim, plumbing included", () => {
    const code = '    <!-- literal code -->\n    {{< relref "/notes/a.md" >}}'
    const { markdown } = convert(`문단\n\n${code}\n\n끝`)
    assert.ok(markdown.includes(code))
  })

  test("relative and in-page destinations become absolute, as the HTML page resolves them", () => {
    const { markdown } = convert(
      "[x](../bib/20250101T000000.md) ![y](images/a.png) [z](#section)\n\n```\n[c](../keep.md)\n```",
    )
    assert.ok(markdown.includes(`[x](${ORIGIN}/bib/20250101T000000)`))
    assert.ok(markdown.includes(`![y](${ORIGIN}/images/a.png)`))
    assert.ok(markdown.includes(`[z](${ORIGIN}/${SLUG}#section)`))
    assert.ok(markdown.includes("[c](../keep.md)"))
  })

  test("local destinations keep the label and lose the link", () => {
    const { markdown } = convert(
      '[x](~/repos/example/docs/a.md) <a href="file:///home/user/a">y</a> ![z](/home/user/p.png)',
    )
    assert.ok(markdown.includes("x y z"))
    assert.ok(!/~\/repos|file:|\/home\//.test(markdown))
  })

  test("protocol-relative sources keep their host; brackets in captions are escaped", () => {
    const { markdown } = convert('{{< figure src="//example.org/a.png" caption="a [b]" >}}')
    assert.ok(markdown.includes("![a \\[b\\]](https://example.org/a.png)"))
  })

  test("a comment inside an HTML block goes, the rest of the block stays", () => {
    const { markdown } = convert("<div>before<!-- hidden -->after</div>")
    assert.ok(markdown.includes("<div>beforeafter</div>"))
  })
})
