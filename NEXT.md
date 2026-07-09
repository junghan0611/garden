# NEXT — notes.junghanacs.com

Boot sector for the next session. Durable facts live in `AGENTS.md`, not here.

# STATUS — FROZEN STABLE (v4)
This repo is the **frozen stable v4 publish source**. Active development moved to the
**v5 rebuild at [`junghan0611/garden`](https://github.com/junghan0611/garden)** (private,
default branch `v5`). The garden steward receives all migration work there; see that
repo's `NEXT.md` for the plan. Here: keep the live site stable on Netlify, ship only small
v4 SEO patches if needed. Account consolidates `junghanacs` → `junghan0611`; domain
`notes.junghanacs.com` (hostingkr) and identity are unchanged. Hosting stays Netlify until
v5 is stable — Oracle self-host is a separate post-stable step. Org-export-side AEO items
below (e.g. `refs[]`) are version-independent and may ship here or graduate to garden.

# NOW
- **Current detour 2026-07-09**: `/llms.txt` manual header was unfilled into semantic line breaks (one sentence/bullet per physical line), broken `VOCABULARY.md` link fixed, `Navigation and Identifier Schema` + `Interpretation Rules` added. Changes are local/uncommitted in `content/llms.txt` + `AGENTS.md`; build/post-build verified once.

## Next detour: Folder/Tag lists as temporal reading indexes
Opus implements → GPT/pi reviews. Keep it light — this is a listing-readability patch, not a redesign.
The garden's axis is time. Note pages already show `Created: … Modified: … N min read`, but folder and tag
listings drop it. Worse, each item renders its tags as a **vertical `<ul class="tags">`**, so one note eats
many screen lines and the list stops reading as a list. Goal, and nothing beyond it:
**lastmod · created · title · tags · description, lined up cleanly.**

### Target item shape
Mirror `scripts/generate-llms-recent.mjs` `renderItem()` — same information, HTML instead of text:
```
2026-07-08  @힣: 문턱과 만남 — PKM-AI 하네스와 1KB 공개키의 두 트랙
  created: 2025-03-26; tags: ai, autholog, coevolution, geworfen, harness, jacobianlens
  PKM-AI 하네스 연구와 1KB 공개키/만남의 탐구를 문턱과 만남, 축적과 밀도라는 두 트랙으로 …
```
Line 1 = modified date + title link. Line 2 = `created:` + **inline comma-separated** tag links
(keep each tag an `<a class="internal tag-link">`; only the `<ul>/<li>` wrapper dies). Line 3 = `description`
(already on `QuartzPluginData.description` via `Plugin.Description()`, frontmatter-first, 150-char cap;
present on every note except 42 journal entries). Same shape on desktop and mobile — drop the
`display:none` mobile tag rule in `listPage.scss`.

### Sort notice
`defaultDateType: "modified"` is deliberate; the listing should say so. One sentence, everywhere:
`Sorted by last modified date (newest first).` Folders sorting above files is ordinary and needs no
explanation. `ko-KR` locale strings are intentionally English (Korean translation reads badly), so add the
key to **both** `quartz/i18n/locales/{ko-KR,en-US}.ts` next to `itemsUnderFolder` / `itemsUnderTag`.

### Scope contract — two new `PageList` props, default OFF
`PageList` is shared by Folder / Tag / Category. Give it `showCreated` and `showDescription`, both
defaulting to `false`. Then Category and the tag index need **zero** call-site edits and cannot regress.

| Call site | showCreated | showDescription |
|---|---|---|
| `FolderContent` | ✅ files only, not synthetic folder rows | ✅ |
| `TagContent`, single tag (`tag !== "/"`) | ✅ | ✅ |
| `TagContent`, tag index (`tag === "/"`) | ❌ | ❌ |
| `CategoryContent` | ❌ | ❌ (GLG doesn't use categories) |

The inline-tag markup change still applies to **all four** — that part is unconditional.

### Why `/tags/` stays two-line (measured 2026-07-09, not estimated)
`public/tags/index.html` = 5.29 MB · 2,437 `<h2>` tag blocks · **6,537 items** · 43,299 item tag links ·
description avg 126 B. Removing `<ul>/<li>` wrappers nets **−470 KB** (→ ~4.8 MB). Turning on
description + `created` would add **+1.4 MB** (823 KB text, 196 KB `<p>` wrappers, 392 KB `created`/`<time>`),
landing at ~6.2 MB — bigger than today. Size aside, `/tags/` is an index **of tags**, not of notes: at 2.7
notes per tag, three-line summaries repeated 6,537 times between 2,437 headings destroy its scanning function.
Consistency holds because the unit of consistency is "a list you read notes from" — `/notes/`, `/meta/`,
`/tags/autholog` all get the full three lines. `/tags/` gets `date + title` and inline tags, and gets lighter.

### Two traps found while reading the code
- `FolderContent.tsx:80-88` synthesizes subfolder rows with `frontmatter:{title, tags:[]}`, no description,
  and `dates.created` = `getMostRecentDates()`, i.e. the *newest child's* created date. Printing `created:`
  on a folder row would be a lie. Folder rows: date + title only.
- `npm run check` (`tsc --noEmit`) is **already red** here (12+ errors, incl. the pre-existing `Date.tsx:47`
  `formatDate(date, locale)` vs `formatDate(d: Date)` arity bug). Not a usable gate; builds pass via esbuild.
  Don't fix tsc in this detour, and don't rely on it.

### Files
`quartz/components/PageList.tsx` (props + markup), `quartz/components/styles/listPage.scss`
(3-col grid → block rows; drop the mobile tag-hiding rule; `.popover .section` is dead since
`enablePopovers: false`), `quartz/components/pages/{FolderContent,TagContent}.tsx` (pass props + notice),
`quartz/i18n/locales/{ko-KR,en-US}.ts` (new sort-notice key).
Read-only references: `quartz/components/Date.tsx` (`getDateCustom(cfg, data, "created")` already exists),
`scripts/generate-llms-recent.mjs` (`renderItem`, the shape of truth).

### Verify
```bash
npx quartz build && ./scripts/post-build.sh && node scripts/validate-jsonld.mjs && node scripts/validate-llms.mjs
grep -c 'class="tags"' public/tags/index.html   # expect 0 (ul wrapper gone everywhere)
du -h public/tags/index.html public/notes/index.html public/tags/bib.html
# baseline 2026-07-09: tags/index 5.29M → expect ~4.8M; notes/index 540K; tags/bib 653K
```
Then eyeball `public/notes/index.html` + `public/tags/autholog.html`: sort notice present, one row per note,
`created:` and comma-separated tags inline, description line present. `/talks/index.html`: folder rows show
date + title only, no `created:`. `public/tags/index.html`: inline tags, **no** `created:`, **no** description,
smaller than baseline.

**New**: `scripts/validate-llms.mjs` (`validate-jsonld.mjs` stays JSON-LD-only — different artifact, different
contract). It checks `content/llms.txt` for mid-sentence hard wraps, requires the `Navigation and Identifier
Schema` + `Interpretation Rules` headings, rejects the old bare `github.com/junghan0611/VOCABULARY.md` path, and
asserts `public/llms.txt` contains `## Recent Updates` **exactly once** — `post-build.sh` appends with `>>`, so
running it twice locally silently duplicates the block.

### Do not touch
`content/*.md` (org export output) · per-page canonical (see AGENTS.md URL invariants) · the JSON-LD contract ·
`CategoryContent.tsx` call sites · `tags/index` payload · `defaultDateType: "modified"` · the red tsc baseline.

## Queued after this detour: tag hygiene (org-source side, not notes/)
Tags are **public URLs** (`/tags/{tag}`), so tag naming is a URL-stability decision, not a cosmetic one.
This detour only changes how tags are *rendered*; it must not rename any tag. Census taken 2026-07-09 by
parsing frontmatter only (`^tags: [...]` inside the leading `---` block; a plain `grep ^tags:` also matches
code blocks in note bodies and inflates the count):

| Fact | Value |
|---|---|
| Notes with frontmatter | 2,237 |
| Unique tags | 2,437 (matches `<h2>` count in `tags/index.html`) |
| Tags on exactly **1** note | **1,208 — 49.6%** |
| Tags on 2 notes | 457 |
| Tags on ≥3 notes | 772 |
| Singular/plural collisions | 17 pairs |
| Charset-rule violations | 2 |

Singular/plural pairs (AGENTS.md says prefer singular atomic tags, but the corpus mostly went plural —
decide direction per pair, don't mass-rewrite): `concept(1)/concepts(12)`, `book(1)/books(9)`,
`skill(2)/skills(6)`, `program(3)/programs(3)`, `record(1)/records(5)`, `project(1)/projects(4)`,
`bead(1)/beads(4)`, `term(1)/terms(3)`, `principle(2)/principles(1)`, `war(2)/wars(1)`, plus 7 more 1/1 pairs
(`register`, `credit`, `workstation`, `dialectic`, `other`, `play`, `talk`).

Charset violations — tags must be `[a-z0-9]` only (AGENTS.md Denote rules):
- **`#+filetags`** in `content/notes/20250221T175407.md` — an org header leaked into the tag list. It emits a
  real page at `public/tags/+filetags.html`. Pure garbage URL; fix the org source.
- **`agent-shell`** in `content/notes/20251121T132314.md` — hyphen. → `agentshell`.

Not urgent for indexing: `sitemap.xml` contains **zero** `tags/` URLs, so Google isn't being fed these.
They are still reachable via in-page links. Fix lives in `~/org/` + `denote-export.sh`, not here.
Open question for the cleanup pass, not for now: does a tag with exactly one note earn a URL at all?

- **Current**: JSON-LD identity slice **shipped & live** (Netlify deployed, agenda stamped, sitemap submitted, Google Rich Results ProfilePage valid, schema.org 0/0). Person.image, ProfilePage ImageObject, Authology identity description live. Follow-up: `Person.alternateName` expanded to `[GLG, GLGMAN, 힣, 힣맨, 정한]` (GPT review — Korean glyphs were missing).
- **2026-06-29 SEO batch — DEPLOYING (Head.tsx + NEXT.md)**: #2 og:url→root, #3 path→schema type (`typeBySection`), #5 standalone `BreadcrumbList`, #6 reciprocal `sameAs` (+`https://junghanacs.com/`). Built + **dual-verified (Claude impl + GPT independent re-build)**. Detail in AFTER SHIP #2–5 + the sameAs note below. GLG ran local `run.sh` serve OK.
- **Validated live 2026-06-29 (GLG, validator.schema.org)**: meta multi-type `["Article","DefinedTerm"]` = **clean (0 errors/warnings), no rollback needed**. Caught + fixed 1 warning: `breadcrumb` is WebPage-only → removed from content node, BreadcrumbList kept standalone (`a4aec358`). Then removed the weak `#blog` grouping: the garden is not a blog; folder semantics are already expressed by section-based `@type`, and all content is `isPartOf #website`. Added `scripts/validate-jsonld.mjs` to enforce the generated-HTML contract before Netlify post-build/IndexNow. Re-verify live after Netlify rebuild → expect 0/0. #1 refs awaits dexport schema notification.
- **Blocker**: none. Google KG/index lag is days–weeks; don't test LLM retrieval (Gemini) until Search Console confirms indexed.
- **Do not touch**: `content/*.md` (org export output); per-page `canonical` (see AGENTS.md URL invariants). **sameAs**: `https://junghanacs.com/` reciprocal **shipped (GLG-approved 2026-06-29)** — homepage↔notes 양방향. No further `sameAs` expansion without an explicit GLG gate.

# AFTER SHIP — follow-ups (priority order)
1. **`refs[] → schema.org citation`** — **EXPORT-SIDE DEPENDENCY; notes-side parked.** Investigated 2026-06-29: org sources carry `#+reference:` in **1086 notes**, but `denote-export.sh` emits **NONE** into content frontmatter, and `Head.tsx` has **no `citation` receiver** → fully unstarted (not a forgotten bug — the prior JSON-LD-ship session correctly parked it on this cross-repo dependency). Real work lives in `doomemacs-config` export pipeline. **doomemacs-config (`20260629T115742-397429`) + GLG decided 2026-06-29: GO — form (b) structured `refs: [{key, title, url}]`** (resolved via citar-denote helpers `citar-denote--retrieve-references` + citar memory, NOT bare keys — bare citekeys are crawler/LLM noise). Confirmed `#+reference:` is a citar-denote field, not ox-hugo, so export drop = missing mapping (not intentional); ox-hugo has no frontmatter-citation option, so frontmatter injection is the only path. **notes-side: CODE FROZEN — build NO receiver until dexport-side ships the PoC and notifies the confirmed frontmatter schema (key name `refs`, object fields `{key,title,url}`, future git-commit field).** When schema lands, the receiver is ~20 lines: `{title,url}` → schema.org `citation {@type:"CreativeWork", name, url}` on BlogPosting/Article. This is the first case of a broader dexport "package-metadata → md frontmatter" enrichment bridge (git commit SHA → frontmatter is the planned second). Awaiting dexport schema notification.
2. ~~**`og:url` ↔ `ProfilePage.url` mismatch**~~ — **DONE in code 2026-06-29** (`Head.tsx`): home `socialUrl` → `url.origin`. Pending GLG export/build/deploy. (Was: home `og:url` `/index` vs JSON-LD url root.)
3. ~~**Path-based schema type mapping**~~ — **DONE in code 2026-06-29** (`Head.tsx` `typeBySection`): `notes→Article`, `botlog→TechArticle`, `bib`·`journal→CreativeWork`, `meta→["Article","DefinedTerm"]` (multi-type), unknown→`BlogPosting` fallback. `@id` suffix kept `#article` for crawler-merge stability. Build-verified (Claude + GPT independent): Article 837 / TechArticle 80 / CreativeWork 781 / Article+DefinedTerm 538 / fallback 0, parse-fail 0. **meta multi-type validated clean live 2026-06-29 (0/0) — kept, no rollback.**
4. ~~**A-2 `Blog` node**~~ — **REVERTED/REMOVED 2026-06-29** (`Head.tsx`): the garden is not a blog, and `notes`·`botlog`→`#blog` vs `bib`·`meta`·`journal`→`#website` had no garden-native rule. Keep the honest minimal model: all content `isPartOf #website`; folder semantics are carried by `@type`. If section collection entities (`#notes`, `#meta`, `#bib`, …) are needed, design them in v5 JSON-LD builder, not as a v4 live patch.
5. ~~**BreadcrumbList JSON-LD**~~ — **DONE 2026-06-29** (`Head.tsx`): 3-level Home→section→page as a **standalone `#breadcrumb` @graph node**. NOTE: `breadcrumb` is a WebPage-only property — do NOT re-attach it to Article/CreativeWork content nodes (validator warns); standalone BreadcrumbList is Google's documented pattern (`a4aec358`). Section item `/<sec>/` resolves (FolderPage active). Build-verified BreadcrumbList 2236.

> Verified NOT a bug (GPT flagged, refuted 2026-06-23): build-time `fileData.slug` is **uppercase T**, so `isDenoteContent` regex matches and all 2,235 denote pages emit JSON-LD with correct uppercase `isBasedOn`. The lowercase `t` is Netlify serve-time URL canonicalization only — same HTML served at both cases. Don't "fix" the regex. (See AGENTS.md "Build & URL invariants".)

# PARKED
- `Plugin.CustomOgImages()` disabled (`quartz.config.ts`) — every page shares `/static/og-image.png`. Enable only if per-page social cards become worth the build cost.
- v5 migration — **moved to `junghan0611/garden`** (was watch-and-prepare; now active dev there). This repo no longer tracks v5 work.

# VERIFY (JSON-LD after any Head.tsx / export change)
```bash
npx quartz build
node scripts/validate-jsonld.mjs
node -e 'const fs=require("fs");const ex=f=>fs.readFileSync(f,"utf8").match(/ld\+json">([\s\S]*?)<\/script>/)[1];console.log(JSON.stringify(JSON.parse(ex("public/index.html")),null,1))'
# expect: validate-jsonld OK; parse failures 0; Person.image consistent; ProfilePage ImageObject on home; no Blog node; content isPartOf #website
```
