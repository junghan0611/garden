#!/usr/bin/env node
// Validate content/llms.txt, the hand-maintained machine entry point.
// Scope: text-shape rules only. The JSON-LD contract lives in validate-jsonld.mjs.

import fs from "node:fs"

const SOURCE = process.argv[2] ?? "content/llms.txt"
const BUILT = process.argv[3] ?? "public/llms.txt"

const REQUIRED_HEADINGS = [
  "## Machine-readable entry points",
  "## Navigation and Identifier Schema",
  "## Interpretation Rules",
]

// The pre-2026-07 link pointed at a path that never existed.
const FORBIDDEN = [/github\.com\/junghan0611\/VOCABULARY\.md/]

const failures = []
const fail = (message) => failures.push(message)

const isFence = (line) => line.startsWith("```")
const isHeading = (line) => line.startsWith("#")
const isBlank = (line) => line.trim() === ""

// A new list item starts its own thought, so it never continues the line above.
// Only a non-marker line can be the tail of a refilled paragraph.
const isListItem = (line) => /^\s*([-*+]|\d+\.)\s/.test(line)

// A physical line ends a thought if it closes with terminal punctuation, a colon
// introducing a list, or a bare URL. Anything else running into a continuation
// line means Emacs refilled the paragraph mid-sentence.
const closesThought = (line) => {
  const t = line.trimEnd()
  return /[.:!?)»"”』」]$/.test(t) || /https?:\/\/\S+$/.test(t)
}

function checkSource(file) {
  if (!fs.existsSync(file)) {
    fail(`${file}: missing`)
    return
  }
  const text = fs.readFileSync(file, "utf8")
  const lines = text.split("\n")

  for (const heading of REQUIRED_HEADINGS) {
    if (!lines.some((line) => line.trim() === heading)) {
      fail(`${file}: required heading not found: ${heading}`)
    }
  }

  for (const pattern of FORBIDDEN) {
    const hit = lines.findIndex((line) => pattern.test(line))
    if (hit !== -1) {
      fail(`${file}:${hit + 1}: forbidden pattern ${pattern} — ${lines[hit].trim()}`)
    }
  }

  let inFence = false
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]
    if (isFence(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const next = lines[i + 1]
    const nextContinues =
      !isBlank(line) &&
      !isBlank(next) &&
      !isHeading(line) &&
      !isHeading(next) &&
      !isFence(next) &&
      !isListItem(next)

    if (nextContinues && !closesThought(line)) {
      fail(
        `${file}:${i + 1}: mid-sentence hard wrap — line does not close a thought and the next line continues it\n` +
          `    ${line.trim()}\n` +
          `  ↳ ${next.trim()}`,
      )
    }
  }
}

function checkBuilt(file) {
  if (!fs.existsSync(file)) {
    console.log(`[llms] ${file} absent — run 'npx quartz build' to check the built artifact`)
    return
  }
  const text = fs.readFileSync(file, "utf8")
  const recent = text
    .split("\n")
    .filter(
      (line) => line.trim() === "## Recent Updates" || line.trim().startsWith("## Recent Updates "),
    ).length

  // post-build.sh appends with '>>', so running it twice silently duplicates the block.
  if (recent === 0) {
    fail(`${file}: '## Recent Updates' block missing — did scripts/post-build.sh run?`)
  } else if (recent > 1) {
    fail(
      `${file}: '## Recent Updates' appears ${recent} times — post-build.sh ran more than once against the same build`,
    )
  }
}

checkSource(SOURCE)
checkBuilt(BUILT)

if (failures.length > 0) {
  console.error(`[llms] ${failures.length} failure(s):\n`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}

console.log(`[llms] OK — ${SOURCE} shape valid, ${BUILT} has exactly one Recent Updates block`)
