# MEMORY

Scratchpad for whichever agent (Claude, GPT, Gemini) is working on this repo.
Not a changelog. Not auto-generated. Humans may edit freely; agents may read and update
the same way the Claude auto-memory system keeps short index entries.

Rules:
- Keep each bullet under ~200 characters.
- One line per fact. Add `— why:` if the reason isn't self-evident.
- Remove or rewrite stale lines instead of appending new ones.
- If something deserves long-form writeup, put it in `AGENTS.md` and link from here.

---

## User / collaboration style

- Multi-agent repo: Junghan (human), Claude, ChatGPT, Gemini all edit here — keep conventions agent-agnostic.
- `content/*.md` is exported from `~/org/` via `denote-export.sh` — never hand-edit. Static files like `content/llms.txt`, `content/robots.txt`, and `quartz.layout.ts` are the editable surfaces.
- Export + visual verification (`denote-export.sh`, `run.sh`) is Junghan-owned by default; agents usually pick up at commit/push/Search Console after explicit verification signoff.
- When an agent can't fetch a URL, assume it's the agent's network constraint, not a missing file. Verify with `curl -I` before concluding absence.

## Current project phase (as of 2026-04-17)

- Hardening mode, not semantic-upgrade mode. Big restructurings (elot, JSON-LD, alias scheme) are parked.
- 2026-04-14 bulk meta injection (description + `[!abstract]`) to 2,107 files landed; Search Console impressions roughly doubled the next day, long-tail surface area expanded.
- Next agent-facing work: expose machine entry points on the homepage and core landing notes (org-side task).

## Site-level decisions

- Footer order: social/identity → machine entry points (RSS, robots.txt, sitemap.xml, llms.txt) → bibliography raw (Zotero + 8 .bib files). `quartz/components/Footer.tsx` renders a flat `<ul>`; grouping is by order only.
- `content/llms.txt` starts with a "Machine-readable entry points" block so an agent that lands on `llms.txt` first can still reach sitemap/robots/RSS.
- `content/robots.txt` comment mentions `llms.txt` path. Non-standard but LLMs read it.
- Zotero raw data lives in `~/repos/gh/zotero-config/output/` (Article, Book, Online, Video, Misc, Reference, Software, github-starred). Repo-root `Book.bib` is legacy.

## Deploy / SEO

- Netlify builds from `v4` branch. `scripts/post-build.sh` appends "Recent Updates" to `public/llms.txt` and submits IndexNow to Bing/Yandex/Naver.
- Google Search Console sitemap submission: `gog sc sitemap submit --site="https://notes.junghanacs.com" "https://notes.junghanacs.com/sitemap.xml" -a junghanacs@gmail.com`.
- Google indexing after build takes days. Don't test LLM retrieval (Gemini) until Search Console confirms indexed.

## Open items (handed to org side)

- Add "Welcome, AI agents" section with 4 entry-point links to homepage (`content/index.md` comes from org).
- Add the same entry-point block to three core landing notes.
- Remove `#+OPTIONS: toc:1` from long guide notes so Quartz-side TOC doesn't precede the `[!abstract]` block in DOM.

## v4 audit (2026-04-17) — what's solid vs loose

Verified against `public/notes/20250727T094722.html`. Web-based GPT/Claude reviewers called out several items; many were false negatives caused by their fetch sandbox. Listing both so we don't redo work.

### Already solid (don't re-touch)

- `<html lang="ko" dir="ltr">` — correct.
- `<meta name="description">` — populated from frontmatter description (the 2,107-file bulk injection).
- Full OG + Twitter Card meta set.
- **JSON-LD `Article` schema** — present in `Head.tsx:108-134`. Includes author/datePublished/dateModified/description/image/url/isPartOf/isBasedOn. Restricted to Denote-ID pages only.
- IndieWeb: webmention, pingback, `rel="me"` for Bluesky/Mastodon/GitHub, `h-card` in footer.
- `robots.txt`, `sitemap.xml`, `llms.txt`, `index.xml` (RSS) all live at 200.
- URL case: all built files use uppercase `T` (`20250727T094722.html`); no `t` variants in `public/notes/`. The "case-mixing" concern from external reviewers was a misread.

### Loose — prioritized

| # | Pri | Item | Why | Where |
|---|---|---|---|---|
| 1 | ⚪️ parked | `<link rel="canonical">` per page | **Not a bug, design decision deferred.** Netlify already 301s uppercase→lowercase (and serves lowercase 200 via case-insensitive match), sitemap carries the canonical signal to Google. Adding canonical now = signal conflict (HTML says uppercase T, response URL says lowercase t, sitemap says lowercase t, remark42 keeps uppercase T). Quartz upstream (jackyzha0, PR #629 closed 2025-06-27) also refuses canonical with the same reasoning. Revisit only after a canary test confirms whether Netlify can be forced to preserve uppercase URLs. | `quartz/components/Head.tsx` |
| 2 | 🟡 | No `BreadcrumbList` JSON-LD | Helps Google sitelinks and LLM navigation context. Slug is `section/YYYYMMDDTHHMMSS` so breadcrumb is trivially derivable. | `Head.tsx` same block |
| 3 | 🟡 | `Person` JSON-LD only nested inside `Article.author` | Standalone `Person` on the homepage would let agents dereference "who is Junghan" directly. | `Head.tsx` homepage branch |
| 4 | 🟡 | `Plugin.CustomOgImages()` disabled | Build-time cost, but default `static/og-image.png` is the same for every page — no per-page preview on social/LLM cards. | `quartz.config.ts:126` |

### Case-sensitivity truth table (2026-04-17 audit)

Verified against live site + `public/` build output.

| Layer | Value | Source |
|---|---|---|
| Original Denote ID | uppercase T | `~/org/` |
| `content/*.md` filename | uppercase T | denote-export.sh |
| `public/*.html` filename | uppercase T (2,199 files) | Quartz build |
| Internal `<a href>` links | uppercase T | Quartz CrawlLinks |
| `og:url`, `twitter:url`, JSON-LD `url` | uppercase T | `Head.tsx` |
| `sitemap.xml <loc>` | **lowercase t** (lone outlier) | `quartz/plugins/emitters/contentIndex.tsx:45` — explicit `.toLowerCase()` |
| Netlify response to uppercase request | 301 → lowercase | Netlify auto URL canonicalization (no `netlify.toml` rule) |
| Netlify response to lowercase request | 200 | Netlify case-insensitive matching |
| remark42 script | runtime lowercase→uppercase restoration | `quartz/components/scripts/remark42.inline.ts:31-36` (pre-existing workaround) |

**Read**: remark42 restoration is a *workaround for lowercase-leaking URLs*, not proof that "uppercase is the public-URL canonical." Junghan already treated identity (Denote ID) as uppercase, while accepting that public URLs leak to lowercase.

### v4-side backports from v5 research (see llmlog 20260404T124956)

Safe to cherry-pick without migrating to v5:
- Parallel git handling in `quartz/plugins/transformers/lastmod.ts` — build speedup.
- SVG rendered as `<object>` in OFM — better SVG compatibility.
- Search scroll-to-highlight UX in `search.inline.ts`.

### v5 migration (not now)

Per 2026-04-04 llmlog: v5 is architectural rebuild, not upgrade. Strategy = **watch + prepare**, don't migrate yet.
- Watch `quartz-community/ox-hugo` for our org-mode patches (TODO stripping, gptel wrap, csl-entry, custom anchor IDs).
- Eventually package `Remark42Comments`, `Webmentions`, `CategoryContent` as standalone plugins that v5 can consume via `npx quartz plugin add`.
- Trigger for serious v5 evaluation: (a) v5 merged to main, or (b) community ox-hugo reaches parity with our patches.
