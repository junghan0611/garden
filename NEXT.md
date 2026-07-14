# NEXT — notes.junghanacs.com

Boot sector for the next session. Durable facts live in `AGENTS.md`, not here.

# STATUS — LIVE on `junghan0611/garden@main`

The repository cutover is **done** (2026-07-13). Durable facts about it now live in `AGENTS.md`
("Repository cutover"); this file only carries what is still open. Next lanes: the GLG-Mono web subset
(owned by the font steward) and the non-font PageSpeed work below.

The garden is developed **independently** — upstream Quartz is not tracked and Quartz v5 is deferred
indefinitely (see PARKED). Hosting stays Netlify; Oracle self-host is a separate, unscheduled question and no
longer waits on "v5 stable".

# NOW

## Cutover — SHIPPED 2026-07-13 → `CHANGELOG.md` v2026.7.13

Durable facts live in `AGENTS.md` ("Repository cutover"). Only the loose ends stay here.

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

| Surface | Perf | A11y | Best | SEO | Agentic |  FCP |  LCP |   TBT |  CLS |   SI |
| ------- | ---: | ---: | ---: | --: | ------: | ---: | ---: | ----: | ---: | ---: |
| desktop |   77 |   89 |   96 | 100 |     1/3 | 1.0s | 1.0s | 210ms | .222 | 1.8s |
| mobile  |   74 |   95 |   96 | 100 |     2/3 | 1.8s | 1.8s | 510ms | .214 | 3.5s |

**Decided 2026-07-13: do not install the Netlify Lighthouse build plugin** (the UI keeps advertising it, so this
will get re-asked). It serves `public/` from a _local static server_ inside the build container, so Netlify's
brotli, cache headers, redirects and CDN are all out of the loop — `server-response-time` and
`uses-text-compression` become fiction. It measures rather than fixes, spends build minutes on every push, and a
threshold would let a ±5–10 point lab wobble block a note publish. Everything in this detour was obtained for
free by running Lighthouse locally against the **live** site (`CHROME_PATH=$(which google-chrome) npx
lighthouse@12 https://notes.junghanacs.com/ --only-categories=…`); PSI's anonymous API quota is exhausted, so
use the local CLI or the web UI. Separately: the sole SEO deduction is `robots.txt` `Content-Signal:` flagged as
an "Unknown directive" — **keep it**. The AI-crawler policy signal is deliberate, real crawlers ignore unknown
directives harmlessly, and Lighthouse's SEO score is not a ranking factor.

### Font lane — moved to branch `font/web-subset` (2026-07-14)

`main` publishes the live garden continuously, so font experiments do not live here. The GLG-Mono web
subset work — the 8-file `{core,jp}` checkpoint, its measurements and its acceptance criteria — is
committed on **`font/web-subset`**; the handoff is `NEXT--font_web-subset.md` on that branch.

**Do not touch fonts on `main`.** `quartz/styles/custom.scss` and `quartz/static/fonts/` here carry the
live four-face GLG-Mono, unchanged.

North star (GLG, 2026-07-14): **notes is a font consumer.** GLG-Mono ships Han in Korean glyph forms, and
the font lane owns that. Nothing lands on `main` until that build exists and GLG approves both rendering
and transfer size. On the branch checkpoint a single Han character still costs 1,959KB — which is why it
is parked rather than shipped.

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
- **`icon.png` is 684KB** (measured in the browser 2026-07-13, while checking the font waterfall). It is fetched on
  every page. Nothing needs a 684KB icon — resize/recompress it. Not investigated further; the number is real.

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
lands and is measured separately; only then reassess CLS/payload targets. Preserve the UI/CSS invariants in
`AGENTS.md` during every implementation pass.

- **Detour 2026-07-09 (a) — shipped** (`9d89bc82`): `/llms.txt` manual header unfilled into semantic line breaks,
  dead `VOCABULARY.md` link repaired, `Navigation and Identifier Schema` + `Interpretation Rules` added, unused
  `.beads/` dropped. Now guarded by `scripts/validate-llms.mjs`.

## Queued after this detour: tag hygiene (org-source side, not notes/)

Tags are **public URLs** (`/tags/{tag}`), so tag naming is a URL-stability decision, not a cosmetic one.
This detour only changes how tags are _rendered_; it must not rename any tag. Census taken 2026-07-09 by
parsing frontmatter only (`^tags: [...]` inside the leading `---` block; a plain `grep ^tags:` also matches
code blocks in note bodies and inflates the count):

| Fact                                  | Value                                                 |
| ------------------------------------- | ----------------------------------------------------- |
| Notes with frontmatter                | 2,237                                                 |
| Unique tags in frontmatter            | 2,437                                                 |
| Unique tags Quartz actually publishes | **2,436** — the gap is a silently dropped tag, see #3 |
| Tags on exactly **1** note            | **1,208 — 49.6%**                                     |
| Tags on 2 notes                       | 457                                                   |
| Tags on ≥3 notes                      | 772                                                   |
| Singular/plural collisions            | 17 pairs                                              |
| Malformed tags                        | 3                                                     |

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

# AFTER SHIP — follow-ups

1. **`refs[] → schema.org citation`** — **EXPORT-SIDE DEPENDENCY; notes-side parked.** Investigated 2026-06-29: org sources carry `#+reference:` in **1086 notes**, but `denote-export.sh` emits **NONE** into content frontmatter, and `Head.tsx` has **no `citation` receiver** → fully unstarted (not a forgotten bug — the prior JSON-LD-ship session correctly parked it on this cross-repo dependency). Real work lives in `doomemacs-config` export pipeline. **doomemacs-config (`20260629T115742-397429`) + GLG decided 2026-06-29: GO — form (b) structured `refs: [{key, title, url}]`** (resolved via citar-denote helpers `citar-denote--retrieve-references` + citar memory, NOT bare keys — bare citekeys are crawler/LLM noise). Confirmed `#+reference:` is a citar-denote field, not ox-hugo, so export drop = missing mapping (not intentional); ox-hugo has no frontmatter-citation option, so frontmatter injection is the only path. **notes-side: CODE FROZEN — build NO receiver until dexport-side ships the PoC and notifies the confirmed frontmatter schema (key name `refs`, object fields `{key,title,url}`, future git-commit field).** When schema lands, the receiver is ~20 lines: `{title,url}` → schema.org `citation {@type:"CreativeWork", name, url}` on BlogPosting/Article. This is the first case of a broader dexport "package-metadata → md frontmatter" enrichment bridge (git commit SHA → frontmatter is the planned second). Awaiting dexport schema notification.

> Verified NOT a bug (GPT flagged, refuted 2026-06-23): build-time `fileData.slug` is **uppercase T**, so `isDenoteContent` regex matches and all 2,235 denote pages emit JSON-LD with correct uppercase `isBasedOn`. The lowercase `t` is Netlify serve-time URL canonicalization only — same HTML served at both cases. Don't "fix" the regex. (See AGENTS.md "Build & URL invariants".)

# PARKED

- **Quartz v5 — deferred indefinitely (GLG, 2026-07-13).** Not "watch and prepare" any more; simply not happening for now. The v5 rebuild stays in **`junghan0611/garden_v5`** (public, `main`), strictly separate from this live garden. Two repos, two lanes; do not merge, do not port.
- **This garden is developed independently — upstream Quartz is not tracked.** Do not pull, rebase onto, or reconcile with `jackyzha0/quartz`. Its release tags (`v4.5.2`, `v5.0.0`, …) survive in local history but are not ours and are never pushed to `origin`; our own line is CalVer in `CHANGELOG.md`. The `upstream` remote is kept only as a read-only reference for reading upstream code, never as a merge source. When Quartz's code fights us, we change our code — there is no upgrade path to preserve.
- `Plugin.CustomOgImages()` disabled (`quartz.config.ts`) — every page shares `/static/og-image.png`. Enable only if per-page social cards become worth the build cost.

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
CSS must be asserted against compiled `public/index.css`, and layout against a real browser — see the UI/CSS
invariants in `AGENTS.md` for what static checks cannot reveal.
