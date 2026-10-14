import test from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { VFile } from "vfile"
import { MarkdownSidecar } from "./markdownSidecar"

// Serve-mode lifecycle: a twin appears with its page, disappears when the page turns draft, and stays
// gone after the source is deleted. Uses a throwaway content/output pair, no Quartz build.
test("publish → draft → delete leaves no stale twin", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "md-sidecar-"))
  const source = path.join(dir, "content", "notes", "20250101T000000.md")
  fs.mkdirSync(path.dirname(source), { recursive: true })
  fs.writeFileSync(source, '---\ntitle: "t"\n---\n\n본문\n')
  const output = path.join(dir, "public")
  const twin = path.join(output, "notes", "20250101T000000.md")
  const ctx = {
    argv: { output },
    cfg: { configuration: { baseUrl: "notes.junghanacs.com" } },
  } as any
  const file = new VFile({ path: source })
  file.data.slug = "notes/20250101T000000" as any
  file.data.filePath = source as any
  const published = [[{ type: "root", children: [] }, file]] as any
  const event = (type: string) => [{ type, path: "notes/20250101T000000.md", file }] as any
  const drain = async (gen: any) => {
    for await (const _ of gen);
  }

  await drain(MarkdownSidecar().emit(ctx, published, {} as any))
  assert.ok(
    fs
      .readFileSync(twin, "utf8")
      .includes('url: "https://notes.junghanacs.com/notes/20250101T000000"'),
  )

  await drain(MarkdownSidecar().partialEmit!(ctx, [], {} as any, event("change")))
  assert.ok(!fs.existsSync(twin), "a page that turned draft keeps no twin")

  await drain(MarkdownSidecar().partialEmit!(ctx, published, {} as any, event("change")))
  assert.ok(fs.existsSync(twin), "republishing brings it back")

  fs.rmSync(source)
  await drain(MarkdownSidecar().partialEmit!(ctx, [], {} as any, event("delete")))
  assert.ok(!fs.existsSync(twin), "a deleted page keeps no twin")
})
