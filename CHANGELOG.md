# Changelog

CalVer snapshots (`vYYYY.M.D[-suffix]`) of `notes.junghanacs.com`.

This is the garden's own tag line, started with the move to `junghan0611/garden`. The repository still carries
Quartz upstream's release tags (`v4.5.2`, `v5.0.0`, …) in local history; they are **not** ours and are not
pushed here. The garden is developed independently — upstream Quartz is not tracked, and a Quartz v5 migration
is deferred indefinitely.

## Unreleased

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
