import { QuartzTransformerPlugin } from "../types"
import { Root } from "mdast"
import { visit } from "unist-util-visit"
import { toString } from "mdast-util-to-string"
import Slugger from "github-slugger"

export interface Options {
  // Both bounds are markdown heading numbers, not "levels": minDepth 2 / maxDepth 3
  // means H2 and H3 are listed while H1 and H4+ are not.
  minDepth: 1 | 2 | 3 | 4 | 5 | 6
  maxDepth: 1 | 2 | 3 | 4 | 5 | 6
  minEntries: number
  showByDefault: boolean
  collapseByDefault: boolean
}

const defaultOptions: Options = {
  minDepth: 1,
  maxDepth: 3,
  minEntries: 1,
  showByDefault: true,
  collapseByDefault: false,
}

interface TocEntry {
  depth: number
  text: string
  slug: string // this is just the anchor (#some-slug), not the canonical slug
}

const slugAnchor = new Slugger()
export const TableOfContents: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "TableOfContents",
    markdownPlugins() {
      return [
        () => {
          return async (tree: Root, file) => {
            const display = file.data.frontmatter?.enableToc ?? opts.showByDefault
            if (display) {
              slugAnchor.reset()
              const toc: TocEntry[] = []
              let highestDepth: number = opts.maxDepth
              visit(tree, "heading", (node) => {
                if (node.depth >= opts.minDepth && node.depth <= opts.maxDepth) {
                  const text = toString(node)
                    .replace(
                      /<span class="timestamp-wrapper"><span class="timestamp">.*?<\/span><\/span>\s*/g,
                      "",
                    )
                    .replace(
                      /<span class="gptel-role gptel-(?:user|assistant)">@(?:user|assistant)<\/span>\s*/g,
                      "",
                    )
                    .replace(
                      /<span class="org-hashtag">(#[^<]+)<\/span>/g,
                      "$1",
                    )
                    .replace(
                      /<span class="org-mention">(@[^<]+)<\/span>/g,
                      "$1",
                    )
                  highestDepth = Math.min(highestDepth, node.depth)
                  // Use predefined anchor ID if available (e.g. from ox-hugo {#id})
                  const customId = (node.data?.hProperties as Record<string, unknown>)?.id as string | undefined
                  toc.push({
                    depth: node.depth,
                    text,
                    slug: customId ?? slugAnchor.slug(text),
                  })
                }
              })

              if (toc.length > 0 && toc.length > opts.minEntries) {
                file.data.toc = toc.map((entry) => ({
                  ...entry,
                  depth: entry.depth - highestDepth,
                }))
                file.data.collapseToc = opts.collapseByDefault
              }
            }
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    toc: TocEntry[]
    collapseToc: boolean
  }
}
