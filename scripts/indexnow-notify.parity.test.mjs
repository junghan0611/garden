// npx tsx --test scripts/indexnow-notify.parity.test.mjs — the notifier's copied slug and ignore logic
// against Quartz's own quartz/util/path.ts and quartz/util/glob.ts (TypeScript, hence tsx).
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { joinSegments, simplifySlug, slugifyFilePath } from "../quartz/util/path.ts"
import { glob } from "../quartz/util/glob.ts"
import { HOST, IGNORE_PATTERNS, isIgnored, urlForContentPath } from "./indexnow-notify.mjs"

// generateSiteMap (quartz/plugins/emitters/contentIndex.tsx) with GARDEN_URL_CASE=preserve:
// `https://${joinSegments(baseUrl, encodeURI(simplifySlug(slug)))}`
const quartzLoc = (fp) => `https://${joinSegments(HOST, encodeURI(simplifySlug(slugifyFilePath(fp))))}`

const FIXTURES = [
  "index.md",
  "talks/index.md",
  "talks/_index.md",
  "notes/index.md",
  "notes/20250727T094722.md",
  "journal/20251103T000000.md",
  "bib/20220712T090000.md",
  "meta/20240918T175053.md",
  "notes/a b.md",
  "notes/a&b.md",
  "notes/100%.md",
  "notes/what?.md",
  "notes/c#.md",
  "notes/심학십도 이미지.md",
  "notes/éàü.md",
  "notes/v1.2.md",
  "notes/.hidden.md",
  "notes/sub/dir/x.md",
  "notes/sub/index.md",
  "notes/MiXeD Case.md",
  "notes/tab\tname.md",
]

test("urlForContentPath equals Quartz's sitemap <loc> for every fixture", () => {
  for (const fp of FIXTURES) assert.equal(urlForContentPath(fp), quartzLoc(fp), fp)
})

test("isIgnored equals what Quartz's glob drops under content/", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexnow-glob-"))
  const files = [
    "notes/a.md",
    "test/a.md",
    "private/a.md",
    "tmp/a.md",
    "templates/a.md",
    ".obsidian/a.md",
    "notes/tmp/a.md",
    "notes/test.md",
    "tmp.md",
    "test.md",
    "notes/private/a.md",
    "notes/.hidden.md",
    ".foo/a.md",
    "notes/.dir/a.md",
  ]
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    fs.writeFileSync(path.join(dir, f), "x\n")
  }
  const kept = new Set(await glob("**/*.*", dir, IGNORE_PATTERNS))
  for (const f of files) assert.equal(!isIgnored(f), kept.has(f), f)
})
