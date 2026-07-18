import { ComponentChildren } from "preact"
import { Root, RootContent } from "hast"
import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import ArticleOutline, { articleOutlineStyle } from "../ArticleOutline"

// Where the in-article outline goes, per GLG's rule: after the note's own
// `[!abstract] 이 노트에 대하여` opening, never above it. Returns -1 when no
// outline should render.
//
// This runs at render time rather than in an htmlPlugin on purpose. A
// transformer-inserted outline would leak every heading into
// `<meta name="description">` (Description does `toString(tree)`) and CrawlLinks
// would tag the anchors `a.internal`, which makes popover.inline.ts attach a
// hover preview to each one.
function outlineInsertIndex(children: RootContent[]): number {
  const isElement = (node: RootContent, test: (tagName: string) => boolean) =>
    node.type === "element" && test(node.tagName)

  const classesOf = (node: RootContent): string[] => {
    const props = (node as any).properties ?? {}
    const className = props.className ?? props.class ?? []
    return Array.isArray(className) ? className.map(String) : String(className).split(/\s+/)
  }

  // Some notes still carry an ox-hugo-generated `div.ox-hugo-toc` at the very top of
  // the body (2 left; the rest were cleared). Adding ours would show the same headings
  // twice, so those notes keep the one the export already put there.
  if (children.some((node) => classesOf(node).includes("ox-hugo-toc"))) return -1

  const abstractIdx = children.findIndex((node) => {
    if (!isElement(node, (t) => t === "blockquote")) return false
    const props = (node as any).properties ?? {}
    // ofm.ts sets both; check the class list too since hProperties keys pass
    // through unchanged and are easy to rename upstream.
    return props["data-callout"] === "abstract" || classesOf(node).includes("abstract")
  })
  if (abstractIdx >= 0) return abstractIdx + 1

  // 6 of 837 notes have no abstract callout — fall back to before the first heading.
  return children.findIndex((node) => isElement(node, (t) => /^h[1-6]$/.test(t)))
}

const Content: QuartzComponent = ({ fileData, tree }: QuartzComponentProps) => {
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["h-entry", "popover-hint", ...classes].join(" ")

  const root = tree as Root
  const toc = fileData.toc
  // The homepage has 11 headings, so `toc` alone is not a sufficient gate.
  const wantsOutline = toc && toc.length > 0 && fileData.slug !== "index"
  const splitIdx = wantsOutline ? outlineInsertIndex(root.children) : -1

  if (splitIdx < 0) {
    const content = htmlToJsx(fileData.filePath!, tree) as ComponentChildren
    return (
      <article class={classString}>
        <div class="e-content">{content}</div>
      </article>
    )
  }

  // Split rather than mutate: `tree` is shared with emitters that run later.
  const before = htmlToJsx(fileData.filePath!, {
    ...root,
    children: root.children.slice(0, splitIdx),
  }) as ComponentChildren
  const after = htmlToJsx(fileData.filePath!, {
    ...root,
    children: root.children.slice(splitIdx),
  }) as ComponentChildren

  return (
    <article class={classString}>
      <div class="e-content">
        {before}
        <ArticleOutline toc={toc!} />
        {after}
      </div>
    </article>
  )
}

Content.css = articleOutlineStyle

export default (() => Content) satisfies QuartzComponentConstructor
