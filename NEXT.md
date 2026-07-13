# NEXT — notes.junghanacs.com

Boot sector for the next session. Durable facts live in `AGENTS.md`, not here.
# STATUS — LIVE on `junghan0611/garden@main`
The repository cutover is **done** (2026-07-13). Durable facts about it now live in `AGENTS.md`
("Repository cutover"); this file only carries what is still open. Next lanes: the GLG-Mono web subset
(owned by the font steward) and the non-font PageSpeed work below. Hosting stays Netlify until v5 is stable;
Oracle self-host remains post-stable.

# NOW

## Cutover — SHIPPED 2026-07-13

`junghanacs/notes.junghanacs.com@v4` → **`junghan0611/garden@main`**. Same Netlify site, same domain, same
Search Console property; only the source repo was relinked, so DNS/SSL/sitemap were never touched.

Live verification after deploy — all green:

| Check | Result |
|---|---|
| Footer `Source`, JSON-LD `isBasedOn`, `blob`/`blame` links | all `junghan0611/garden@main`, all **HTTP 200** |
| Old repo URL anywhere on the live site | **0** occurrences (home, `llms.txt`, note page) |
| `llms.txt:129` identity line | `@junghanacs (garden identity)` — org account **preserved**, as intended |
| `sitemap.xml` / `index.xml` / `robots.txt` | 200 / 200 / 200 |
| `## Recent Updates` in `llms.txt` | exactly 1 → `post-build.sh` ran once |
| Uppercase-`T` → lowercase 301 | still in place (documented invariant, not a bug) |

The `Head.tsx` ↔ `validate-jsonld.mjs` hard pair inside Netlify's `&&` build chain was gated locally before the
push and then proved itself in production. Old repo is retained, public, read-only on `v4`, with a "moved"
README banner and a `MOVED → junghan0611/garden` description.

### Still open

1. **`garden_v5`'s own docs still call it `junghan0611/garden`** — `AGENTS.md` 9, 18, 42, 114 and `NEXT.md:129`.
   Line 114 literally reads `origin = junghan0611/garden`, which now names the **live** repo. Its actual git
   remote is explicit and safe, but an agent trusting that line could push v5 into the live garden. **v5's job**,
   flagged to that lane; no longer theoretical.
2. **Do not `gh repo archive` the old repo yet.** Rollback = relink the same Netlify site to `oldorg` + branch
   `v4`; keep that window open for a confidence period. Archiving needs `gh auth switch --user junghanacs`
   (`junghan0611` is only a collaborator there — push yes, admin no).
3. Local directory is still `~/repos/gh/notes`. Rename to `~/repos/gh/garden` when no session holds the old CWD.

## Detour 2026-07-13: PageSpeed mobile/desktop — non-font performance + accessibility

GLG ran PageSpeed Insights against the homepage and asked for an implementation-ready handoff. These are
**Lighthouse lab results, not CrUX field data** (the report says real-user data is absent), captured 2026-07-13
12:34 KST with Lighthouse 13.4.0.

- Desktop report: <https://pagespeed.web.dev/analysis/https-notes-junghanacs-com/ket92hixxz?utm_source=search_console&form_factor=desktop&hl=ko>
- Mobile report: <https://pagespeed.web.dev/analysis/https-notes-junghanacs-com/ket92hixxz?utm_source=search_console&form_factor=mobile&hl=ko>

| Surface | Perf | A11y | Best | SEO | Agentic | FCP | LCP | TBT | CLS | SI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| desktop | 77 | 89 | 96 | 100 | 1/3 | 1.0s | 1.0s | 210ms | .222 | 1.8s |
| mobile | 74 | 95 | 96 | 100 | 2/3 | 1.8s | 1.8s | 510ms | .214 | 3.5s |

**Decided 2026-07-13: do not install the Netlify Lighthouse build plugin** (the UI keeps advertising it, so this
will get re-asked). It serves `public/` from a *local static server* inside the build container, so Netlify's
brotli, cache headers, redirects and CDN are all out of the loop — `server-response-time` and
`uses-text-compression` become fiction. It measures rather than fixes, spends build minutes on every push, and a
threshold would let a ±5–10 point lab wobble block a note publish. Everything in this detour was obtained for
free by running Lighthouse locally against the **live** site (`CHROME_PATH=$(which google-chrome) npx
lighthouse@12 https://notes.junghanacs.com/ --only-categories=…`); PSI's anonymous API quota is exhausted, so
use the local CLI or the web UI. Separately: the sole SEO deduction is `robots.txt` `Content-Signal:` flagged as
an "Unknown directive" — **keep it**. The AI-crawler policy signal is deliberate, real crawlers ignore unknown
directives harmlessly, and Lighthouse's SEO score is not a ranking factor.

### Ownership boundary: font lane is already active elsewhere

GLG is working with the GLG-Mono font steward (`~/repos/gh/GLG-Mono`). Do **not** concurrently edit
`@font-face`, font files, `font-display`, fallback metrics, or subsetting here. The two WOFF2 files are
2.58MB + 2.57MB, account for ~5.15MB of the 6.04MB transfer, and explain almost all CLS (`.207/.214` mobile,
`.211/.222` desktop). Re-run both reports after that lane lands; do not duplicate its work in this detour.

**SSOT is `~/repos/gh/GLG-Mono/docs/WEBFONT_SUBSET.md`** (status: design approved, not implemented). Chunk
counts, the frequency partition, and the italic policy live there and are still moving — **do not copy its
numbers into this file**. Only the root cause and the notes-side consequences belong here:

- **Root cause is fork inheritance, not a skipped optimization.** GLG-Mono is a PlemolJP fork;
  `fontforge_script.py:214` still opens IBM Plex Sans JP as the base font and merges Hangul onto it. Half the
  cmap (13,412 of 27,846 codepoints) is Han the garden almost never renders. The real fault is that **no web
  font pipeline exists** — the desktop face was Brotli-compressed whole and uploaded. The fix lives entirely in
  the web deliverable; the source build does not change.
- **Corrected here 2026-07-13**: an earlier version of this section recommended dropping BoldItalic and letting
  the browser synthesize. **Wrong, and withdrawn.** Under `unicode-range` an unused chunk costs *zero network*,
  so the size argument that motivated it does not survive chunking. GLG-Mono's CJK italic is a defined
  `skew(9°) + translate(-40, 0)` with advance held, while synthesis is engine-defined — at GLG's pixel-parity
  bar, synthesis is out. The SSOT ships **physical italic chunks for all CJK**. A corpus-trained subset (ship
  only the garden's 3,665 characters) was likewise rejected there: a release font must not be cut against one
  private corpus.

**Do not retreat to Google Fonts.** Measured 2026-07-13, so it does not get re-litigated: IBM Plex Sans KR
through Google's own 94-chunk `unicode-range` split pulls **365 KB average per real garden note** (22–32 chunks
across 400+700), because generic frequency-ordered chunks scatter across the syllable space — a garden-trained
partition beats it by a wide margin. And two disqualifiers no size argument can fix: **IBM Plex Sans KR is not
monospace** (Plex has no Korean mono at all — that absence is exactly why PlemolJP/GLG-Mono exists), so Korean
would go proportional and break code-block alignment; and it **has no italic whatsoever**
(`ital,wght@1,400` → HTTP 400).

**Notes-side work when the font lands**: swap the four `@font-face` blocks in `quartz/styles/custom.scss` for
the steward's shipped `unicode-range` CSS, drop the old WOFF2s from `quartz/static/fonts/`, then re-measure.
Nothing here changes before that delivery.

The work below is the independent **non-font lane**. Preferred owner: an Opus implementation pass, one
measured commit per item; GLG retains the visual/interaction gate.

### P0 — stop eager search indexing (largest non-font CPU win)

Evidence:
- Mobile: `postscript.js` CPU 2,442ms, JS execution 2.3s, main-thread work 3.2s, TBT 510ms.
- Desktop: `postscript.js` CPU 1,336ms, JS execution 1.2s, main-thread work 1.9s, TBT 210ms.
- `quartz/components/renderPage.tsx` eagerly starts `fetch("static/contentIndex.json")` on every page.
- `quartz/components/scripts/search.inline.ts` handles `nav` by awaiting it and immediately calls
  `fillDocument(data)`, adding all ~2,239 documents to FlexSearch before the user opens Search.
- The content index is ~1.81MB raw / 464KB transferred.

Fix contract:
1. Replace the eager global Promise with a memoized loader function (`fetchData()` starts once, on demand).
   Update every consumer (`search.inline.ts`, `explorer.inline.ts`, `graph.inline.ts`) together; do not leave a
   mixed Promise/function API.
2. On `nav`, Search should install only lightweight click/keyboard handlers. Fetch + `fillDocument` on the
   first Search button click or Cmd/Ctrl-K, cache the result, and show a loading state while it initializes.
3. Preserve the global populated index across SPA navigation, but refresh the current slug used to resolve
   result/preview URLs. Fix handler cleanup while there: `removeEventListener` must receive the same function
   reference, not a new lambda.

Acceptance:
- Initial homepage load does not request `contentIndex.json` solely because Search exists and does not populate
  FlexSearch before interaction.
- First Search open works by button and Cmd/Ctrl-K; CJK exact-substring behavior, `#tag` search, previews, and
  Search after two SPA navigations all still work.
- Mobile TBT materially falls; target `<300ms` before font work, with no search regression.

### P0 — lazy-load Remark42; do not execute comments during initial page load

Evidence:
- Initial load downloads Remark42 `remark.mjs` 253KB + `embed.js` 46KB + `remark.css` 45KB.
- Lighthouse estimates 121KB + 22KB unused JS and 38KB unused CSS.
- Guest startup probes `/api/v1/user?site=notes` and gets expected 401, which is the visible Best Practices
  failure. `quartz/components/scripts/remark42.inline.ts` currently injects `embed.js` immediately on `nav`.

Fix contract:
- Render the comments shell, but load Remark42 only when the shell approaches the viewport (IntersectionObserver,
  generous root margin such as 600px) or when an explicit accessible “Load comments” button is pressed.
- Do not use `requestIdleCallback` as the only gate: Lighthouse will still load it and the initial-page cost
  remains. Preserve SPA destroy/re-init, theme switching, and uppercase Denote-ID URL restoration.
- Apply the same footer-near-viewport policy to Webmentions as a smaller follow-up; it is not a score blocker.

Acceptance:
- No `comments.junghanacs.com/web/*` or guest `/api/v1/user` request on an untouched homepage load.
- Scroll/click loads comments; login, theme change, and comment continuity across SPA navigation work.
- Best Practices target: 100, unless a new independent failure appears.

### P1 — Explorer must not materialize the entire garden on load

Evidence:
- Lighthouse sees 5,001 DOM elements; `ul.content` has 837 children and depth 12.
- `explorer.inline.ts:createFolderNode()` recursively creates every descendant even for collapsed folders.
- `DesktopOnly` is CSS-only and forwards the wrapped script, so the hidden Explorer still builds on mobile.

Preferred garden-scale design:
- Explorer is **folder navigation**, Search is the note finder, and folder pages are the complete indexes.
  Initially render folders only (plus the active note/path if needed), not all ~2,239 note links.
- If GLG wants file browsing inside Explorer, use lazy subtree materialization with a hard cap and an
  “Open folder index (N)” link. Never append 837 siblings merely to show one active note.
- At minimum, skip Explorer setup while a `desktop-only` root is not visible and initialize on the first valid
  desktop display. Pair this with memoized `fetchData()`; otherwise mobile still downloads the index.

Acceptance:
- Initial homepage DOM target `<1,500` elements; mobile hidden Explorer adds no tree and no CPU work.
- Folder links, active path, saved collapse state, resize, and SPA navigation are browser-tested.
- Do not trade the DOM problem for a 5MB `/tags/`-style client renderer.

### P1 — accessibility/agentic quick wins (small, deterministic)

1. **TOC broken `aria-controls` (desktop only).** `TableOfContents.tsx` points at `toc-*`, but
   `OverflowListFactory` overwrites the supplied ID with `list-*`; the controlled target therefore does not
   exist. Expose/reuse the factory's actual ID (or make it preserve a supplied ID), and ensure the overflow
   observer uses that same ID. This should move desktop agentic accessibility from fail to pass.
2. **Main landmark.** In `renderPage.tsx`, change the central content wrapper from `<div class="center">` to
   one `<main class="center">` (sidebars/footer remain outside). Verify CSS selectors and SPA replacement.
3. **Contrast.** `search.scss` uses low-contrast `var(--gray)` for “Search”; use a passing token such as
   `var(--darkgray)`. `footer.scss` applies `opacity: .7` to the entire footer; remove inherited opacity and use
   explicit passing colors so links/text remain legible in both themes.
4. **Same text, different destination.** Rename the external footer toolchain link `Emacs` to `GNU Emacs` so it
   is not confused with the internal garden note link named `Emacs`.

Acceptance:
- Every `aria-controls` resolves to an existing element after first load and after SPA navigation.
- axe/Lighthouse: no invalid ARIA, missing main landmark, contrast, or identical-link-purpose failure.
- A11y target 100 desktop/mobile. Agentic target 2/3 on desktop/mobile. Do **not** add fake WebMCP forms merely
  to chase 3/3; mobile already passes accessibility-tree + `llms.txt`, and this site has no actionable form.

### P2 — remove homepage-only resource waste

- **KaTeX:** homepage has no math, yet global `Latex.externalResources()` loads render-blocking jsDelivr
  `katex.min.css` and `copy-tex.min.js` (mobile third-party latency ~750ms each; render-blocking estimate 600ms
  total). Preferred: emit KaTeX CSS/copy support only on pages whose rendered HAST contains KaTeX. Safe fallback
  for v4: self-host/bundle the small CSS and remove or lazy-load nonessential copy-tex JS. Verify a math-heavy
  note before shipping.
- **Unused preconnect:** `Head.tsx` always preconnects `cdnjs.cloudflare.com`, but Mermaid is disabled and PSI
  marks it unused. Remove it. Do not replace it with speculative preconnects.
- Keep `index.css` and `prescript.js` blocking until proven otherwise; dark-mode bootstrap must not flash. Measure
  before attempting critical CSS or script reshuffling.

### P3 — security diagnostics: verify, then harden separately

Live `curl -I` already confirms `X-Frame-Options: SAMEORIGIN`, HSTS, nosniff, Referrer-Policy, and
Permissions-Policy from `netlify.toml`. Do not churn these because Lighthouse lists related informational audits.
CSP/Trusted Types/COOP are real hardening opportunities but not a casual score patch:

1. Inventory inline Quartz scripts, JSON-LD, Umami, Remark42, Webmention, and KaTeX origins.
2. Start with CSP Report-Only and test Search, SPA, comments login, analytics, JSON-LD, and external embeds.
3. Consider `Cross-Origin-Opener-Policy: same-origin` only after testing Remark42 auth/popups and share links.
4. Enforce CSP/Trusted Types in a separate commit after violations are zero; never add broad `unsafe-*` merely
   to satisfy an audit label.

### Measurement/ship loop

One concern per commit: Search → comments → Explorer → a11y → KaTeX/head cleanup. After each:

```bash
npx quartz build -o /tmp/psi-verify
node scripts/validate-jsonld.mjs /tmp/psi-verify
node scripts/validate-llms.mjs content/llms.txt /tmp/psi-verify/llms.txt
```

Then browser-test the acceptance cases above. After Netlify deploy, run mobile and desktop PSI three times and
record the median (lab scores vary). Keep SEO at 100 and the JSON-LD/llms contracts unchanged. Font-owner work
lands and is measured separately; only then reassess CLS/payload targets.

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
- v5 rebuild — lives in **`junghan0611/garden_v5`** (public, default `main`). Keep it strictly separate from the live garden, which is now `junghan0611/garden@main`. Two repos, two lanes; do not merge.

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
