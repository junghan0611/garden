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
- **Current**: JSON-LD identity slice **shipped & live** (Netlify deployed, agenda stamped, sitemap submitted, Google Rich Results ProfilePage valid, schema.org 0/0). Person.image, ProfilePage ImageObject, Authology identity description live. Follow-up: `Person.alternateName` expanded to `[GLG, GLGMAN, 힣, 힣맨, 정한]` (GPT review — Korean glyphs were missing).
- **2026-06-29 SEO batch — DEPLOYING (Head.tsx + NEXT.md)**: #2 og:url→root, #3 path→schema type (`typeBySection`), #4 `Blog` node, #5 `BreadcrumbList`, #6 reciprocal `sameAs` (+`https://junghanacs.com/`). Built + **dual-verified (Claude impl + GPT independent re-build), parse-fail 0/2237**, type counts confirmed. Detail in AFTER SHIP #2–5 + the sameAs note below. GLG ran local `run.sh` serve OK.
- **Validated live 2026-06-29 (GLG, validator.schema.org)**: meta multi-type `["Article","DefinedTerm"]` = **clean (0 errors/warnings), no rollback needed**. Caught + fixed 1 warning: `breadcrumb` is WebPage-only → removed from content node, BreadcrumbList kept standalone (`a4aec358`). Re-verify live after Netlify rebuild → expect 0/0. #1 refs awaits dexport schema notification.
- **Blocker**: none. Google KG/index lag is days–weeks; don't test LLM retrieval (Gemini) until Search Console confirms indexed.
- **Do not touch**: `content/*.md` (org export output); per-page `canonical` (see AGENTS.md URL invariants). **sameAs**: `https://junghanacs.com/` reciprocal **shipped (GLG-approved 2026-06-29)** — homepage↔notes 양방향. No further `sameAs` expansion without an explicit GLG gate.

# AFTER SHIP — follow-ups (priority order)
1. **`refs[] → schema.org citation`** — **EXPORT-SIDE DEPENDENCY; notes-side parked.** Investigated 2026-06-29: org sources carry `#+reference:` in **1086 notes**, but `denote-export.sh` emits **NONE** into content frontmatter, and `Head.tsx` has **no `citation` receiver** → fully unstarted (not a forgotten bug — the prior JSON-LD-ship session correctly parked it on this cross-repo dependency). Real work lives in `doomemacs-config` export pipeline. **doomemacs-config (`20260629T115742-397429`) + GLG decided 2026-06-29: GO — form (b) structured `refs: [{key, title, url}]`** (resolved via citar-denote helpers `citar-denote--retrieve-references` + citar memory, NOT bare keys — bare citekeys are crawler/LLM noise). Confirmed `#+reference:` is a citar-denote field, not ox-hugo, so export drop = missing mapping (not intentional); ox-hugo has no frontmatter-citation option, so frontmatter injection is the only path. **notes-side: CODE FROZEN — build NO receiver until dexport-side ships the PoC and notifies the confirmed frontmatter schema (key name `refs`, object fields `{key,title,url}`, future git-commit field).** When schema lands, the receiver is ~20 lines: `{title,url}` → schema.org `citation {@type:"CreativeWork", name, url}` on BlogPosting/Article. This is the first case of a broader dexport "package-metadata → md frontmatter" enrichment bridge (git commit SHA → frontmatter is the planned second). Awaiting dexport schema notification.
2. ~~**`og:url` ↔ `ProfilePage.url` mismatch**~~ — **DONE in code 2026-06-29** (`Head.tsx`): home `socialUrl` → `url.origin`. Pending GLG export/build/deploy. (Was: home `og:url` `/index` vs JSON-LD url root.)
3. ~~**Path-based schema type mapping**~~ — **DONE in code 2026-06-29** (`Head.tsx` `typeBySection`): `notes→Article`, `botlog→TechArticle`, `bib`·`journal→CreativeWork`, `meta→["Article","DefinedTerm"]` (multi-type), unknown→`BlogPosting` fallback. `@id` suffix kept `#article` for crawler-merge stability. Build-verified (Claude + GPT independent): Article 837 / TechArticle 80 / CreativeWork 781 / Article+DefinedTerm 538 / fallback 0, parse-fail 0. **meta multi-type validated clean live 2026-06-29 (0/0) — kept, no rollback.**
4. ~~**A-2 `Blog` node**~~ — **DONE in code 2026-06-29** (`Head.tsx`): `{@type:Blog, @id:#blog, isPartOf:#website, publisher:#person}`, only `notes`·`botlog` `isPartOf:#blog` (bib/meta/journal stay #website direct). No `hasPart` enumeration. Blog node only on pages that reference it (not home — conservative). Build-verified Blog 917.
5. ~~**BreadcrumbList JSON-LD**~~ — **DONE 2026-06-29** (`Head.tsx`): 3-level Home→section→page as a **standalone `#breadcrumb` @graph node**. NOTE: `breadcrumb` is a WebPage-only property — do NOT re-attach it to Article/CreativeWork content nodes (validator warns); standalone BreadcrumbList is Google's documented pattern (`a4aec358`). Section item `/<sec>/` resolves (FolderPage active). Build-verified BreadcrumbList 2236.

> Verified NOT a bug (GPT flagged, refuted 2026-06-23): build-time `fileData.slug` is **uppercase T**, so `isDenoteContent` regex matches and all 2,235 denote pages emit JSON-LD with correct uppercase `isBasedOn`. The lowercase `t` is Netlify serve-time URL canonicalization only — same HTML served at both cases. Don't "fix" the regex. (See AGENTS.md "Build & URL invariants".)

# PARKED
- `Plugin.CustomOgImages()` disabled (`quartz.config.ts`) — every page shares `/static/og-image.png`. Enable only if per-page social cards become worth the build cost.
- v5 migration — **moved to `junghan0611/garden`** (was watch-and-prepare; now active dev there). This repo no longer tracks v5 work.

# VERIFY (JSON-LD after any Head.tsx / export change)
```bash
npx quartz build
node -e 'const fs=require("fs");const ex=f=>fs.readFileSync(f,"utf8").match(/ld\+json">([\s\S]*?)<\/script>/)[1];console.log(JSON.stringify(JSON.parse(ex("public/index.html")),null,1))'
# expect: parse failures 0, Person.image consistent, ProfilePage ImageObject on home
```
