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
- **Detour 2026-07-09 (a) — shipped** (`9d89bc82`): `/llms.txt` manual header unfilled into semantic line breaks,
  dead `VOCABULARY.md` link repaired, `Navigation and Identifier Schema` + `Interpretation Rules` added, unused
  `.beads/` dropped. Now guarded by `scripts/validate-llms.mjs`.

## Detour 2026-07-09 (b): Folder/Tag lists are temporal reading indexes — SHIPPED
Six commits, GLG visually approved each round via `run.sh`; final round verified by driving the live dev server
in a browser, which is what caught the last two bugs. Pushed 2026-07-09.

| Commit | What |
|---|---|
| `9d89bc82` | `docs(llms)` — llms.txt semantic line breaks, dead VOCABULARY link, nav/interpretation sections, `.beads/` drop |
| `07d82fa9` | `feat(listing)` — the time axis in folder/tag rows + `scripts/validate-llms.mjs` |
| `9534d363` | `style(listing)` — bold date, smaller title/tags, shrink tag-index headings |
| `f61e0cab` | `style(tags)` — tag-index hierarchy on a rail; `Showing first N tags.` → `notes.` |
| `7e5b1a8d` | `fix(validate-llms)` — stop failing on a build that skipped post-build.sh |
| `14139a40` | `fix(listing)` — one-line date+title; visible rail; rail moved onto the note listing |

Each row is `modified-date + title` / `created: … ; tags: a, b, c` (inline links) / `description` — the same
shape `scripts/generate-llms-recent.mjs` `renderItem()` emits for LLMs. Listings announce
`Sorted by last modified date (newest first).` (`defaultDateType: "modified"` is deliberate; folders sorting
first is ordinary and goes unexplained).

`PageList` gained `showCreated` / `showDescription`, both defaulting **false**, so Category and the tag index
required no call-site change and could not regress. The inline-tag markup applies everywhere unconditionally.

| Surface | showCreated | showDescription | measured |
|---|---|---|---|
| `notes/index.html` | ✅ | ✅ | 540K → **696K**, 837 rows |
| `tags/<tag>.html` | ✅ | ✅ | `tags/bib.html` 653K → **836K** |
| `tags/index.html` | ❌ | ❌ | 5.29M → **5.0M** (6,537 rows, `created:` 0, `section-desc` 0) |
| `categories/index.html` | ❌ | ❌ | untouched: 56 rows, `created:` 0, `section-desc` 0 |

Dropping the `<ul>/<li>` tag wrappers shrank `tags/index.html` even while every other listing grew.
Turning description on there would have added ~1.4MB and buried 2,436 tag headings under 6,537 three-line
summaries — `/tags/` is an index *of tags*, not of notes.

### CSS invariants — don't undo these
- **`.section-head` must stay `flex-wrap: nowrap`.** With `wrap`, the title's `flex-basis: auto` (max-content)
  decides line breaking, so a long title drops whole below the date. `min-width: 0` does **not** prevent this —
  it only permits shrinking. 8 of the first 12 tag-index rows were broken this way and static HTML checks
  could not see it.
- **The rail belongs to `.tag-index > div > .page-listing`, not to the tag block.** A negative margin on the
  `h2` can never push it past its parent's border — measured `h2.left === block.left + border` — so hanging the
  heading "outside" the rail was impossible; it only indented the whole group by 16px, which is the crowding
  GLG saw. The tag now keeps the body's left edge and the rail starts beneath it.
- **Rail colour is theme-split.** `--lightgray` is `#393639` on dark mode's `#161618` page: **1.52:1**,
  invisible. `--gray` at full strength is 3.05:1 on dark but 5.59:1 on light. So: 70% mix for light,
  full `--gray` under `[saved-theme="dark"]`. Both land near 3:1.

### Typography rounds
Round 2 (GLG): bold the modified date, title `h3` 1.25rem → 1.05rem, tags line 0.85em → 0.75em, description
0.9em → 0.85em, tag-index `h2` 1.5rem → 1.1rem.

Round 3 (GLG): that shrink *created* a hierarchy bug. At 1.1rem the tag name sat next to 1.05rem note titles
in the same link colour, so a note read as its tag's **sibling**, not its child; by the third note you had lost
the owner. Re-enlarging the heading would undo round 2, so hierarchy moved off font size and onto space — the
rail. Zero markup, zero bytes: the `.tag-index` wrapper class already existed.

### Three bugs found and fixed on the way
- `Showing first ${count} tags.` counts **notes**, not tags. Rendered 130× on the tag index (156 tags own more
  than `numPages: 10` notes). Fixed in `ko-KR` + `en-US` only.
- `validate-llms.mjs` failed on a build that skipped `post-build.sh` — which is exactly what `run.sh` produces.
  A validator that cries wolf on the normal development state trains you to ignore it. Now it reports which of
  the three built states it saw; only a **duplicated** block fails, since only `post-build.sh` running twice
  against one build can create one.
- Synthetic folder rows: a folder's `dates.created` is `getMostRecentDates()` — its *newest child's* created
  date, describing no folder. Suppressed. **Correction to the earlier plan**: `content/talks/sample/` is *not*
  a live instance (it holds no `.md`, so the trie never makes a folder node and no synthetic row renders
  anywhere today). Verified instead against an isolated fixture via `npx quartz build -d <fixture>`:
  folder row = date + title only; file row = created + description.

### Observed, not acted on
- `/tags/` freezes the renderer: two `Page.captureScreenshot` calls timed out at 30s against the live server.
  5.0MB and 6,537 rows will do that. Real visitors feel this too. A `numPages` cut or pagination is the lever,
  but that is a separate decision.
- **`#+filetags` sorts first on `/tags/`** — `+` precedes every letter — so the garbage tag from an org header
  typo occupies the first screen of the tag index. Fix is org-side (see tag hygiene below); it is just more
  visible than expected.
- Over half the tag-index blocks (1,207 of 2,436) own exactly one note, so the rail keeps stopping after one
  row. Special-casing that in CSS would be premature: it is a symptom of the orphan-tag problem, and should
  shrink once tag hygiene lands.

### Verified 2026-07-09 (every round)
- `npx quartz build` clean → `./scripts/post-build.sh` → `node scripts/validate-jsonld.mjs` → `html=4696
  ld=2238 content=2237`, types `Article 837 / TechArticle 80 / CreativeWork 782 / Article+DefinedTerm 538`,
  parse-fail 0. JSON-LD contract unchanged throughout.
- `node scripts/validate-llms.mjs` → OK. **New validator**; `validate-jsonld.mjs` stays JSON-LD-only.
  Five rules, each **proven to fire by injecting the regression it guards**: mid-sentence hard wrap in a
  paragraph, the same in a bullet, the dead bare `github.com/junghan0611/VOCABULARY.md` path, a missing
  required heading, and a duplicated `## Recent Updates` (`post-build.sh` appends with `>>`, so two local runs
  stack it). A new list item never counts as a continuation line — that distinction makes the wrap check usable.
  A **missing** Recent Updates block is *not* a failure: a bare `npx quartz build` (what `run.sh` does to serve
  locally) rewrites `public/llms.txt` from source without it. The validator says which of the three built states
  it saw rather than claiming "exactly one block" in all of them — an early version did, and lied.
- `grep -c 'class="tags"' public/tags/index.html` → 0. CSS asserted against the **compiled** `public/index.css`,
  not the SCSS source, so a mis-nested rule cannot pass unnoticed — one edit did mis-nest and the compiled
  output caught it.
- **Driven in a real browser** against `run.sh` (port 1231), which is the only reason the last two bugs surfaced:
  measured `time`/`h3` bounding boxes across rows (8 of 12 broken), measured `h2.left` vs `block.left` to prove
  the negative margin could never escape the border, and computed rail contrast per theme. Neither the built
  HTML nor the compiled CSS could have shown these.
- `npx tsc --noEmit`: **23 errors before, 23 after** — the pre-existing red baseline (incl. `Date.tsx:47`
  `formatDate` arity, CategoryContent's missing i18n key) is untouched and no new type error entered. tsc is not
  a gate here; builds go through esbuild. `npx prettier --check` clean on every changed file.
- Sort-notice strings are optional keys (`sortedByModified?`, `previewsSortedByModified?`) in
  `i18n/locales/definition.ts`, filled only in `ko-KR` + `en-US`. The other 29 locales stay untouched and
  silently omit the sentence. `ko-KR` strings are intentionally English (GLG: Korean translation reads badly).

### Do not touch
`content/*.md` (org export output) · per-page canonical (see AGENTS.md URL invariants) · the JSON-LD contract ·
`CategoryContent.tsx` call sites · `tags/index` payload · `defaultDateType: "modified"` · the red tsc baseline ·
the three CSS invariants above.

## Queued after this detour: tag hygiene (org-source side, not notes/)
Tags are **public URLs** (`/tags/{tag}`), so tag naming is a URL-stability decision, not a cosmetic one.
This detour only changes how tags are *rendered*; it must not rename any tag. Census taken 2026-07-09 by
parsing frontmatter only (`^tags: [...]` inside the leading `---` block; a plain `grep ^tags:` also matches
code blocks in note bodies and inflates the count):

| Fact | Value |
|---|---|
| Notes with frontmatter | 2,237 |
| Unique tags in frontmatter | 2,437 |
| Unique tags Quartz actually publishes | **2,436** — the gap is a silently dropped tag, see #3 |
| Tags on exactly **1** note | **1,208 — 49.6%** |
| Tags on 2 notes | 457 |
| Tags on ≥3 notes | 772 |
| Singular/plural collisions | 17 pairs |
| Malformed tags | 3 |

Singular/plural pairs (AGENTS.md says prefer singular atomic tags, but the corpus mostly went plural —
decide direction per pair, don't mass-rewrite): `concept(1)/concepts(12)`, `book(1)/books(9)`,
`skill(2)/skills(6)`, `program(3)/programs(3)`, `record(1)/records(5)`, `project(1)/projects(4)`,
`bead(1)/beads(4)`, `term(1)/terms(3)`, `principle(2)/principles(1)`, `war(2)/wars(1)`, plus 7 more 1/1 pairs
(`register`, `credit`, `workstation`, `dialectic`, `other`, `play`, `talk`).

Malformed tags — tags must be `[a-z0-9]` only (AGENTS.md Denote rules):
1. **`#+filetags`** in `content/notes/20250221T175407.md` — an org header keyword leaked into the tag list.
   Slugified, it emits a real page at `public/tags/+filetags.html`. Pure garbage URL.
2. **`agent-shell`** in `content/notes/20251121T132314.md` — hyphen. Name choice is an org-side call.
3. **`false`** in `content/bib/20250524T133025.md` — org source really does carry it:
   `#+filetags: :optimism:illusions:false:promise:bib:`. ox-hugo emits it **unquoted**
   (`tags: ["optimism", "illusions", false, "promise", "bib"]`), YAML reads it as a boolean, and Quartz drops
   it. The tag vanishes with no error — that is why the published count is one lower than the frontmatter
   count. It is the only unquoted scalar in the whole corpus today, but any tag named `true`/`no`/`null`/`on`
   would fail the same way. This is a data-loss class of bug, not a cosmetic one.

Not urgent for indexing: `sitemap.xml` contains **zero** `tags/` URLs, so Google isn't being fed these.
They are still reachable via in-page links. Fix lives in `~/org/` + `denote-export.sh`, not here — export
validates nothing today, so a `^[a-z0-9]+$` gate at the export boundary is the real fix.
Open question for the cleanup pass, not for now: does a tag with exactly one note earn a URL at all?
Any rename changes a public URL, so a rename decision must come with a redirect plan.

Handed to the org-side agent (`20260709T111627-d16ea1`, cwd `~/sync/org`) on 2026-07-09 via entwurf mailbox.

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

# VERIFY (after any Head.tsx / listing / llms.txt / export change)
```bash
npx quartz build
./scripts/post-build.sh                 # appends Recent Updates to public/llms.txt (>>, so run once per build)
node scripts/validate-jsonld.mjs
node scripts/validate-llms.mjs
node -e 'const fs=require("fs");const ex=f=>fs.readFileSync(f,"utf8").match(/ld\+json">([\s\S]*?)<\/script>/)[1];console.log(JSON.stringify(JSON.parse(ex("public/index.html")),null,1))'
# expect: validate-jsonld OK; parse failures 0; Person.image consistent; ProfilePage ImageObject on home; no Blog node; content isPartOf #website
# expect: validate-llms OK; content/llms.txt free of mid-sentence wraps; one '## Recent Updates' (none if post-build skipped)
```
A dev server is already writing `public/`, so verify a clean tree elsewhere rather than fighting it:
`npx quartz build -o /tmp/verifyout && node scripts/validate-jsonld.mjs /tmp/verifyout`.

Listing changes additionally: `grep -c 'class="tags"' public/tags/index.html` → 0, and
`du -h public/tags/index.html public/notes/index.html` → tags/index must not grow (5.0M), notes/index ≈ 696K.
CSS must be asserted against compiled `public/index.css`, and layout against a real browser — see the CSS
invariants in the detour above for what static checks cannot see.
