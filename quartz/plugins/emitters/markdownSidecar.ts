import fs from "fs"
import path from "path"
import { VFile } from "vfile"
import { BuildCtx } from "../../util/ctx"
import { FilePath, FullSlug, joinSegments, slugifyFilePath } from "../../util/path"
import { markdownSidecarSlug, toAgentMarkdown } from "../../util/markdownSidecar"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

// Emits /<slug>.md for every published page that markdownSidecarSlug accepts — the same predicate
// ContentMeta and Head use for their links, so a link never points at a file that was not written.
// Input is the published set Quartz hands emitters (drafts and ignorePatterns already filtered out).

async function emitSidecar(ctx: BuildCtx, file: VFile): Promise<FilePath | undefined> {
  const slug = markdownSidecarSlug(file.data.slug, file.data.filePath)
  if (!slug) return undefined
  const raw = await fs.promises.readFile(file.data.filePath!, "utf8")
  const origin = `https://${ctx.cfg.configuration.baseUrl}`
  const { markdown, unknownShortcodes } = toAgentMarkdown(raw, slug, origin)
  if (unknownShortcodes.length > 0) {
    console.warn(`[markdown-sidecar] ${slug}: unknown shortcode ${unknownShortcodes.join(", ")}`)
  }
  return write({ ctx, slug: slug as FullSlug, ext: ".md", content: markdown })
}

export const MarkdownSidecar: QuartzEmitterPlugin = () => ({
  name: "MarkdownSidecar",
  async *emit(ctx, content) {
    for (const [_tree, file] of content) {
      const written = await emitSidecar(ctx, file)
      if (written) yield written
    }
  },
  async *partialEmit(ctx, content, _resources, changeEvents) {
    // Change events carry the file even when it is now a draft, so publication is read from `content`.
    const published = new Set(content.map(([_tree, file]) => file.data.slug))
    for (const changeEvent of changeEvents) {
      if (path.extname(changeEvent.path) !== ".md") continue
      const file = changeEvent.file
      if (changeEvent.type === "delete" || !file || !published.has(file.data.slug)) {
        // A deleted or now-unpublished page must not leave its old twin behind in serve mode.
        const dest = joinSegments(ctx.argv.output, slugifyFilePath(changeEvent.path) + ".md")
        await fs.promises.rm(dest, { force: true })
        continue
      }
      const written = await emitSidecar(ctx, file)
      if (written) yield written
    }
  },
})
