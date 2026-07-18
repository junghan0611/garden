import { JSX } from "preact"
import style from "./styles/articleOutline.scss"

interface TocEntry {
  depth: number
  text: string
  slug: string
}

interface TocNode {
  entry: TocEntry
  children: TocNode[]
}

// Build a tree from the flat depth-annotated toc. A stack keeps sibling and
// parent relationships correct even when a document starts with H3 and only
// introduces an H2 later, or skips a heading depth.
function buildTree(entries: TocEntry[]): TocNode[] {
  const roots: TocNode[] = []
  const stack: Array<{ depth: number; node: TocNode }> = []

  for (const entry of entries) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= entry.depth) {
      stack.pop()
    }

    const node: TocNode = { entry, children: [] }
    const parent = stack[stack.length - 1]?.node
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
    stack.push({ depth: entry.depth, node })
  }

  return roots
}

function renderList(nodes: TocNode[]): JSX.Element {
  return (
    <ol>
      {nodes.map(({ entry, children }) => (
        <li key={entry.slug}>
          {/* No `data-for`: in-view highlighting belongs to the sidebar TOC, which
              scrolls with the reader. This block is a one-time overview. */}
          <a href={`#${entry.slug}`}>{entry.text}</a>
          {children.length > 0 && renderList(children)}
        </li>
      ))}
    </ol>
  )
}

// Entry count above which the outline ships collapsed. WikiDocs never folds, so
// the bar is set high deliberately: only the genuine outliers fold. Distribution
// over the 2,219 notes that get an outline (H2-H3): median 8, p90 27, p99 90,
// max 163, so at 40 about 94% keep the always-open WikiDocs shape. Most of what
// folds is journal — weekly notes list a date H2 per day plus an H3 per entry.
const COLLAPSE_ABOVE = 40

// Not `class="toc"` on purpose: toc.inline.ts's setup loop does `return` (not
// `continue`) when an element lacks `.toc-header`, so reusing that class would
// kill the sidebar TOC toggle.
export default function ArticleOutline({ toc }: { toc: TocEntry[] }) {
  const list = renderList(buildTree(toc))
  if (toc.length <= COLLAPSE_ABOVE) {
    return (
      <nav class="article-outline" aria-label="목차">
        {list}
      </nav>
    )
  }
  // Native <details>: folding without a line of JavaScript.
  return (
    <nav class="article-outline" aria-label="목차">
      <details>
        <summary>목차 ({toc.length})</summary>
        {list}
      </details>
    </nav>
  )
}

export const articleOutlineStyle = style
