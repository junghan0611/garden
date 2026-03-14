import { QuartzTransformerPlugin } from "../types"
import { Root } from "mdast"
import { visit } from "unist-util-visit"
import rehypeRaw from "rehype-raw"
import { PluggableList } from "unified"

export interface Options {
  /** Replace {{ relref }} with quartz wikilinks []() */
  wikilinks: boolean
  /** Remove pre-defined anchor (see https://ox-hugo.scripter.co/doc/anchors/) */
  removePredefinedAnchor: boolean
  /** Remove hugo shortcode syntax */
  removeHugoShortcode: boolean
  /** Replace <figure/> with ![]() */
  replaceFigureWithMdImg: boolean
  /** Replace csl-entry */
  replaceCslEntry: boolean
  /** Replace org latex fragments with $ and $$ */
  replaceOrgLatex: boolean
  /** Remove org-mode TODO/DONE/NEXT keywords from headings */
  removeOrgTodo: boolean
}

const defaultOptions: Options = {
  wikilinks: true,
  removePredefinedAnchor: true,
  removeHugoShortcode: true,
  replaceFigureWithMdImg: true,
  replaceOrgLatex: true,
  replaceCslEntry: true,
  removeOrgTodo: true,
}

const relrefRegex = new RegExp(/\[([^\]]+)\]\(\{\{< relref "([^"]+)" >\}\}\)/, "g")
const predefinedHeadingIdRegex = new RegExp(/(.*) {#(?:.*)}/, "g")
// org-mode TODO keywords: <span class="org-todo todo TODO">TODO</span>
const orgTodoRegex = new RegExp(/<span class="org-todo[^"]*">[A-Z]+<\/span>\s*/g)
const hugoShortcodeRegex = new RegExp(/{{(.*)}}/, "g")
// const figureTagRegex = new RegExp(/< ?figure src="(.*)" ?>/, "g")
const figureTagRegex = new RegExp(/< ?figure src="([^"]+)"/g)
const cslEntryRegex = new RegExp(/<div class="csl-entry">(.*?)<\/div>/g);

// \\\\\( -> matches \\(
// (.+?) -> Lazy match for capturing the equation
// \\\\\) -> matches \\)
const inlineLatexRegex = new RegExp(/\\\\\((.+?)\\\\\)/, "g")
// (?:\\begin{equation}|\\\\\(|\\\\\[) -> start of equation
// ([\s\S]*?) -> Matches the block equation
// (?:\\\\\]|\\\\\)|\\end{equation}) -> end of equation
const blockLatexRegex = new RegExp(
  /(?:\\begin{equation}|\\\\\(|\\\\\[)([\s\S]*?)(?:\\\\\]|\\\\\)|\\end{equation})/,
  "g",
)
// \$\$[\s\S]*?\$\$ -> Matches block equations
// \$.*?\$ -> Matches inline equations
const quartzLatexRegex = new RegExp(/\$\$[\s\S]*?\$\$|\$.*?\$/, "g")

/**
 * ox-hugo is an org exporter backend that exports org files to hugo-compatible
 * markdown in an opinionated way. This plugin adds some tweaks to the generated
 * markdown to make it compatible with quartz but the list of changes applied it
 * is not exhaustive.
 * */
export const OxHugoFlavouredMarkdown: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "OxHugoFlavouredMarkdown",
    textTransform(_ctx, src) {
      if (opts.wikilinks) {
        src = src.toString()
        src = src.replaceAll(relrefRegex, (_value, ...capture) => {
          const [text, link] = capture
          return `[${text}](${link})`
        })
      }

      // removePredefinedAnchor is now handled in markdownPlugins
      // to preserve {#id} as heading's actual HTML id

      if (opts.removeOrgTodo) {
        src = src.toString()
        src = src.replaceAll(orgTodoRegex, "")
      }

      if (opts.removeHugoShortcode) {
        src = src.toString()
        src = src.replaceAll(hugoShortcodeRegex, (_value, ...capture) => {
          const [scContent] = capture
          return scContent
        })
      }

      if (opts.replaceFigureWithMdImg) {
        src = src.toString()
        src = src.replaceAll(figureTagRegex, (_value, ...capture) => {
          const [src] = capture
          // return `![](${src})`
          // Default 640px width, controlled by CSS max-width in custom.scss
          return `![[${src}|640]]`
        })
      }

      if (opts.replaceCslEntry) {
        src = src.toString()
        src = src.replaceAll(cslEntryRegex, (value, ...capture) => {
          const [cslContent] = capture
          return `${cslContent}\n`
        })
      }

      if (opts.replaceOrgLatex) {
        src = src.toString()
        src = src.replaceAll(inlineLatexRegex, (_value, ...capture) => {
          const [eqn] = capture
          return `$${eqn}$`
        })
        src = src.replaceAll(blockLatexRegex, (_value, ...capture) => {
          const [eqn] = capture
          return `$$${eqn}$$`
        })

        // ox-hugo escapes _ as \_
        src = src.replaceAll(quartzLatexRegex, (value) => {
          return value.replaceAll("\\_", "_")
        })
      }
      return src
    },
    markdownPlugins() {
      const plugins: PluggableList = []

      if (opts.removePredefinedAnchor) {
        plugins.push(() => {
          return (tree: Root, _file) => {
            visit(tree, "heading", (node) => {
              const lastChild = node.children[node.children.length - 1]
              if (lastChild && lastChild.type === "text") {
                const match = lastChild.value.match(/ \{#(.+)\}$/)
                if (match) {
                  lastChild.value = lastChild.value.replace(/ \{#.+\}$/, "")
                  node.data = node.data || {}
                  node.data.hProperties = {
                    ...(node.data.hProperties as Record<string, unknown> || {}),
                    id: match[1],
                  }
                }
              }
            })
          }
        })
      }

      return plugins
    },
    htmlPlugins() {
      const plugins: PluggableList = [rehypeRaw]
      return plugins
    },
  }
}
