# Changelog

CalVer snapshots (`vYYYY.M.D[-suffix]`) of `notes.junghanacs.com`.

This is the garden's own tag line, started with the move to `junghan0611/garden`. The repository still carries
Quartz upstream's release tags (`v4.5.2`, `v5.0.0`, …) in local history; they are **not** ours and are not
pushed here. The garden is developed independently — upstream Quartz is not tracked, and a Quartz v5 migration
is deferred indefinitely.

## Unreleased

## v2026.10.14 — Cloudflare Workers and Markdown twins

### Hosting

- Moved the canonical domain to the Cloudflare Worker `junghanacs-garden` as its single Workers Custom Domain (cutover 2026-09-30 18:06 KST). Git `main` builds run `./scripts/build-cloudflare.sh`: full Git history (Quartz dates depend on it), gitleaks, JSON-LD, and an output gate over files, `_headers`, and the sitemap; `scripts/verify-deployed.mjs` checks the deployed responses, including crawler user agents.
- Static files stay asset-first; a small Worker answers only misses and recovers existing lowercase-`t` Denote URLs with a 301 to the uppercase original, keeping query strings. Unknown notes stay 404. The Cloudflare sitemap keeps the uppercase `T`.
- GLG reported the Netlify site cleaned up on 2026-10-03, so Netlify is no longer a rollback target; recovery is a previous Worker version.

### Agent surface — Markdown twins (AEO step 1)

- Every published content page now ships a public Markdown twin at `/<slug>.md` (2,252 in the first build), built from the committed ox-hugo export: code is copied verbatim, HTML comments and export plumbing are removed, link and image destinations become absolute through the same `transformLink` the HTML uses, local paths lose their link, and frontmatter is limited to title, url, author, date, lastmod, tags, and description.
- Pages advertise their twin with `<link rel="alternate" type="text/markdown">` and with `MD` / `CopyMD` in the provenance line, which drops its `ᨒ` glyphs so `Source Blame History ↗ MD CopyMD WikiDocs ↗` fits one 360px phone line. WikiDocs stays last and independent.
- The HTML page stays the indexed original: twins are served as `text/markdown; charset=utf-8` with `X-Robots-Tag: noindex` on the canonical host. This is a Markdown copy with discovery links, not Markdown for Agents or `Accept: text/markdown` negotiation — Cloudflare Agent Readiness stays at Level 2/5, and negotiation is the next, separately gated step.
- The output gate requires a twin for every sitemap Denote page and rejects orphans, comments or shortcodes outside code, local paths, and non-absolute destinations; `verify-deployed.mjs` adds twin MIME, cache, noindex, and canonical-url checks. First deploy (`77a6af625`): 57 checks and 24 crawler user agents passed, 27 sampled twins were byte-identical to GLG's local build, and a 535 KB twin was served at 183 KB with br.
- The Cloudflare build grew from 93 s to 267 s (Quartz 75 → 206 s, output gate 39 s), still well inside the 20-minute limit; reducing it is tracked in NEXT.

### Published content

- Published the authology content refreshes, the October journal and Entwurf update, and the notes on the Cloudflare migration. Unwrapped a nested `denote:` link in two notes that had produced a `/[denote%3A…](…)` URL.

## v2026.9.27 — Garden export and machine-readable catalogs

### Published content

- Published the garden's accumulated Org-to-Markdown updates since the repository cutover, including new images and the September 27 full re-export. This export pairs with `doomemacs-config` `v2026.9.27`: source NBSP no longer leaks between Hangul words, and emphasis padding avoids most ordinary text that resembles markup (one ambiguous `+` case remains). The upstream release records the export logic and its tests.
- Rebuilt heading anchors without NBSP (for example, `#…지식-의-세계` becomes `#…지식의-세계`). The export review checked all 90 pages with changed heading IDs on localhost and found no broken in-page `#href` targets. Previously shared external links to old anchors were not measurable.
- The export review found 0 Hangul–NBSP–Hangul pairs and 0 NBSP in literal code blocks in the affected corpus; `verify-relref` reported 25,137 valid references, 0 malformed, and 2 pre-existing ambiguous references. Cross-page unresolved anchors rose from 210 to 212 because two new links use the older journal date-anchor form; historical journal entries were not re-exported.

### Site and discovery

- Published six category `ItemList` records for autholog and the five garden folders, linked from `llms.txt`, with an independent validator against rendered HTML. The autholog record is served as JSON-LD with the correct content type.
- Added an in-article H2–H3 outline after each note's abstract and improved homepage recent-note and backlink placement. The outline's final visual/deployed preview check remains a follow-up.
- Made the garden's machine entry points and Authology terminology clearer in `llms.txt`, including the agent-facing evidence shelf and adoption link.
- Restored WikiDocs links only for pages in the recovered live-TOC snapshot; removed per-note mirror equivalence for the later curated core edition. Recorded the Blogger-first publication plan without publishing that edition.
- Updated the public identity and homepage links, added conversation callouts, and used the repository-local Quartz CLI in development and deployment scripts.

## v2026.7.13 — 저장소 이관: `junghan0611/garden@main`

The inaugural tag of this repository. Work before it predates CalVer tracking and lives only in commit history.

### Repository cutover

- **Moved the garden's publish source** from `junghanacs/notes.junghanacs.com@v4` to
  **`junghan0611/garden@main`**. The same Netlify site was relinked, so the domain, SSL, Search Console
  property, IndexNow key, and sitemap were never touched.
- **Retired `v4` as a branch name.** It was Quartz _upstream's_ default and means nothing in a repo called
  `garden`. The branch name is encoded in exactly three places — `Head.tsx`'s `isBasedOn`,
  `scripts/validate-jsonld.mjs`'s expected prefix, and `quartz.layout.ts`'s `branch` — which is why the rename
  rode along in the same commit that changed the repository URLs, and why those three must stay in lockstep.
- **Gated the cutover locally before pushing.** Netlify's build command is an `&&` chain and the JSON-LD
  validator hardcodes the expected `isBasedOn` prefix, so `Head.tsx` and `validate-jsonld.mjs` form a hard pair:
  changing either alone fails every page and aborts the deploy. Verified with
  `npx quartz build -o /tmp/cutover && node scripts/validate-jsonld.mjs /tmp/cutover` before the first push.
- **Left the identity graph alone.** `rel="me"`, JSON-LD `sameAs`, and the `@junghanacs` account link are the
  _identity_ account, not the repository; only the parenthetical in `llms.txt` became `(garden identity)`.
- **Kept the old repository** public and read-only on `v4`, with a "moved" README banner and a
  `MOVED → junghan0611/garden` description. That asymmetry is deliberate: it keeps every `blob/v4/…` permalink
  resolving and leaves rollback available by relinking the same Netlify site back to it.
- Live verification after deploy: footer `Source`, JSON-LD `isBasedOn`, and `blob`/`blame` links all resolve
  **HTTP 200** on the new repo; **zero** old-repo URLs remain anywhere on the live site; sitemap, RSS and
  `robots.txt` all 200; `llms.txt` carries exactly one `## Recent Updates` block.

### Listings — folder and tag indexes became temporal reading indexes

- Folder and tag rows now carry the time axis: `modified-date + title` / `created; tags` / `description`, the
  same shape `generate-llms-recent.mjs` emits for LLMs. Listings announce their sort order.
- `PageList` gained `showCreated` / `showDescription`, both defaulting **false**, so the tag index and Category
  needed no call-site change and could not regress. `/tags/` is an index _of tags_, not of notes — turning
  descriptions on there would have added ~1.4MB and buried 2,436 headings under 6,537 summaries.
- Tag-index hierarchy moved off font size and onto space (a rail), after shrinking headings made a note read as
  its tag's _sibling_ rather than its child.
- Fixed: `Showing first N tags.` was counting **notes**, not tags (rendered 130× on the tag index); synthetic
  folder rows showed a folder's newest child's created date, describing no folder.

### Machine-readable surface

- `llms.txt` rewritten with semantic line breaks (no mid-sentence `fill-column` wraps, which degrade
  translators and simple LLM parsers), a repaired vocabulary link, and new _Navigation and Identifier Schema_ +
  _Interpretation Rules_ sections.
- Added `scripts/validate-llms.mjs`, whose five rules were each proven to fire by injecting the regression they
  guard. It reports which of the three built states it saw rather than assuming one — an earlier version failed
  on the ordinary `run.sh` development state, and a validator that cries wolf trains you to ignore it.
- Added `scripts/validate-jsonld.mjs` to enforce the generated-HTML JSON-LD contract before post-build/IndexNow.

### Structured data (JSON-LD / AEO)

- Shipped the identity slice: `Person.image`, `ProfilePage` `ImageObject`, the Authology identity description,
  and `alternateName` expanded to include the Korean glyphs.
- Path-based schema types (`notes→Article`, `botlog→TechArticle`, `bib`/`journal→CreativeWork`,
  `meta→["Article","DefinedTerm"]`), a standalone `BreadcrumbList` node, reciprocal `sameAs`, and home
  `og:url` pointing at the origin.
- Removed the `Blog` grouping node: the garden is not a blog, and section semantics are already carried by
  `@type`. Validated clean (0 errors / 0 warnings) against validator.schema.org.
