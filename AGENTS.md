# AGENTS.md

Project context for AI agents.

## Agent workspace

- **`AGENTS.md`** (this file) — durable, shared baseline for any agent (Claude, GPT, Gemini) working on this repo. Edit when a rule or convention stabilizes. Durable facts live here.
- **`NEXT.md`** — disposable session handoff: the next concrete move, its verification, and blockers. A boot sector, not a knowledge base. Read it at session start; when a NEXT item turns into a stable fact, graduate it into `AGENTS.md` and drop it from NEXT. Branch work uses `NEXT--<branch>.md`, deleted before merging to `v4`.
- **`README.md`** — human- and agent-facing entry point via GitHub. Keep the "How to read this repo" section current when the workspace layout changes.

## Project Overview

| Field | Value |
|-------|-------|
| Name | notes.junghanacs.com |
| Type | Quartz 4 Digital Garden |
| Language | Korean (ko-KR) |
| Author | Junghan Kim (@junghanacs) |
| Live URL | https://notes.junghanacs.com |
| Scale | ~3,352 notes (836 notes / 534 meta / 677 bib / journal) |

## Identity

One person, one identity, fixed across the garden's JSON-LD `Person` node (`@id …/#person`, `alternateName: [GLG, GLGMAN]`) and the homepage description:

> The digital garden of Junghan Kim (김정한) — known as GLG (힣), and reborn through working alongside AI agents as GLGMAN (힣맨) — author and gardener of the junghanacs world. A Korean web of interconnected notes on engineering, philosophy, and knowledge management (PKM), grown along a single timeline as a lifelong practice he calls Authology (어쏠로지).

Junghan Kim = GLG (힣) = GLGMAN (힣맨) = the junghanacs gardener. Use this equation whenever an agent needs to disambiguate who authored the garden. Public identity links (`sameAs`) extend to LinkedIn at most — never add employer, company, affiliation, or device identifiers to any public surface.

## Related Repositories

| Repo | Purpose |
|------|---------|
| [doomemacs-config](https://github.com/junghan0611/doomemacs-config) | Doom Emacs config — denote-export.sh, agent-server.el |
| [agent-config](https://github.com/junghan0611/agent-config) | AI agent harness — AGENTS.md, skills, pi config |
| [gogcli](https://github.com/steipete/gogcli) | Google Workspace + Search Console CLI (`gog`) — upstream; the `junghan0611` fork is retired |

## Directory Structure

```
.
├── content/           # Markdown content (exported from Denote)
│   ├── notes/         # General notes (~836 files)
│   ├── meta/          # Meta notes (~534 files) — tag-of-tags
│   ├── bib/           # Bibliography notes (~677 files) — Zotero-linked
│   ├── journal/       # Daily journal notes
│   └── index.md       # Homepage
├── quartz/            # Quartz 4 source
├── static/            # Static files (images, fonts)
├── public/            # Build output (.gitignore)
├── quartz.config.ts   # Site config (theme, plugins)
├── quartz.layout.ts   # Layout components
├── flake.nix          # Nix dev environment
└── Book.bib           # BibTeX bibliography
```

## Content Pipeline

### Source (Org-mode)
- Location: `~/org/` (meta, bib, notes directories)
- Format: Denote filename convention (`YYYYMMDDTHHMMSS--title__tags.org`)
- Sequence files: `YYYYMMDDTHHMMSS==SIGNATURE--title__tags.org` (alphanumeric scheme)
- Editor: Doom Emacs + Org-mode 9.8

### Export
- Tool: `denote-export.sh` (multi-daemon parallel processing)
- Source repo: https://github.com/junghan0611/doomemacs-config
- Output: Hugo-flavored Markdown
- Human-owned step: Junghan runs export and visual verification personally (`denote-export.sh`, `run.sh`) to see exactly what goes into the garden. Agents should not run export/build verification unless explicitly asked; default handoff is commit/push/Search Console after the user says verification is done.

### Build
- Generator: Quartz 4
- Plugins: OxHugoFlavouredMarkdown, ObsidianFlavoredMarkdown
- Command: `npx quartz build`

### SEO Quality
Every note has two SEO layers added via the export pipeline:
- `description:` frontmatter → `<meta name="description">` (Google search snippet)
- `[!abstract]` callout block → visible summary in page body (also for LLM context)

## Key Files

| File | Purpose |
|------|---------|
| `quartz.config.ts` | Site config, theme, plugins |
| `quartz.layout.ts` | Layout component placement |
| `content/index.md` | Homepage content |
| `flake.nix` | Nix dev environment |
| `Book.bib` | Zotero-exported BibTeX |

## Conventions

### Content
- **Filename**: Denote format (timestamp-based)
- **Frontmatter**: YAML (title, date, tags, draft, description)
- **Internal links**: Hugo relref or Wikilinks
- **Do not edit** `content/` files directly — export from Org source
- **Exception**: `content/llms.txt` is a hand-maintained machine entry point. Keep prose with semantic line breaks (one sentence or bullet per physical line); do not Emacs-fill paragraphs mid-sentence, because translators and simple LLM parsers degrade on arbitrary `fill-column` wraps.

### Code Style
- TypeScript: follows Quartz default style
- Indent: 2 spaces
- Semicolons: none

## Common Tasks

### Local dev server
```bash
npx quartz build --serve
```

### Build
```bash
npx quartz build
```

### Content sync (Org → MD)
```bash
# run from doomemacs-config/bin/
denote-export.sh all
```

### Lint (gitleaks)
```bash
./lint.sh
```

## Notes

- Do not edit `content/` files directly — they are exported from Org-mode source
- Be careful with `quartz/` customizations — upstream updates may conflict
- Korean fonts: 42dot Sans, Hahmlet, Nanum Gothic Coding

## Google Search Console (SEO)

After deployment, submit sitemap via `gogcli` to trigger Google reindexing.
Gemini only reads pages indexed by Google — unindexed pages are invisible to it.

### Post-deploy workflow

The command is `gog searchconsole` (aliases `gsc`, `search-console`, `webmasters`) — **not `gog sc`**, which
upstream does not have. `siteUrl` is a positional argument and must carry its trailing slash exactly as
`gog gsc sites list` prints it; there is no `--site` flag. Verified against gogcli v0.31.1 on 2026-07-09.

```bash
# Submit sitemap: gog gsc sitemaps submit <siteUrl> <feedpath>
gog gsc sitemaps submit "https://notes.junghanacs.com/" \
  "https://notes.junghanacs.com/sitemap.xml" -a junghanacs@gmail.com

# Check sitemap status (expect errors 0, and contents web:0/<pagecount>)
gog gsc sitemaps list "https://notes.junghanacs.com/" -a junghanacs@gmail.com

# Which pages Google actually serves. --from/--to are required.
gog gsc query "https://notes.junghanacs.com/" --dimensions=PAGE \
  --from=2026-06-01 --to=2026-07-08 -a junghanacs@gmail.com
```

There is **no URL Inspection command** upstream, so a single URL's index status has to be read in the Search
Console web UI. `gsc query` answers a different question — whether a page is being served in results — which is
usually the question worth asking anyway.

Tool: upstream [steipete/gogcli](https://github.com/steipete/gogcli) on PATH via nixos-config
`scripts/external-packages.sh`. The `junghan0611/gogcli` fork that carried the old `gog sc` patch is retired.

### Deploy loop

```
Junghan export/검수 (`denote-export.sh`, `run.sh`) → git commit → git push
→ Netlify build → gog gsc sitemaps submit
→ wait a few days → verify in Google Search Console
```

Note: Indexing takes time after build. Wait before testing with Gemini.

IndexNow: `scripts/post-build.sh` appends a "Recent Updates" block to `public/llms.txt` and submits IndexNow to Bing/Yandex/Naver on every Netlify build — no manual step.

## Structured Data (JSON-LD / AEO)

`quartz/components/Head.tsx` emits a single `@graph` with stable `@id`s so crawlers and LLMs merge node properties across pages. Restricted to the homepage and Denote-ID pages (tags/folder-index/404 excluded).

- **Person** (`@id …/#person`) on every page — `name`, `alternateName: [GLG, GLGMAN]`, `jobTitle`, `description`, `knowsAbout`, `knowsLanguage`, `sameAs` (5: two GitHub, LinkedIn, Bluesky, Mastodon), `image`.
- **WebSite** (`#website`), **ProfilePage** (homepage only, `mainEntity → #person`, `primaryImageOfPage` as `ImageObject`), **BlogPosting** (notes, `author/publisher → #person`, `isBasedOn → GitHub source`).
- Profile photo: `quartz/static/profile.jpg` (640×640 grayscale) → served at `/static/profile.jpg`. Separate channel from `og:image` (`/static/og-image.png`); the face photo never overrides link-preview cards.
- **Standard schema.org only.** No invented properties (e.g. `temporalStatus`) — crawlers drop non-standard terms. Synthesize at build time; never mutate the org source. No content `license` field until a content licence (CC-*) is actually chosen — `LICENSE.txt` is Quartz's MIT, not a content licence.
- Next AEO lever (not yet shipped): `#+reference:` citekeys → frontmatter `refs[]` → schema.org `citation` (org-export side) so bib notes expose what primary sources they engage — the "footprints, not facade" signal.

## Build & URL invariants

Denote IDs and all built URLs use **uppercase `T`** (`20250727T094722`). The lone lowercase outlier is `sitemap.xml <loc>` (explicit `.toLowerCase()` in `quartz/plugins/emitters/contentIndex.tsx`). Netlify 301s uppercase→lowercase and serves lowercase `200`; `remark42.inline.ts` restores uppercase at runtime for comments. There is **no per-page `<link rel="canonical">`** — a deliberate decision: adding one would conflict the uppercase-HTML / lowercase-response / lowercase-sitemap signals (Quartz upstream refuses canonical for the same reason). Don't "fix" this without a canary confirming Netlify can preserve uppercase.

v5 is **watch-and-prepare, not migrating now** — track community ox-hugo for our org-mode patches; revisit only when v5 merges to main or that fork reaches parity.

## External Agent Environment (Network-Restricted LLMs)

External agents (Claude.ai web, ChatGPT web, Gemini web, etc.) block arbitrary URL fetching by sandbox policy. When they say "file not found," it is usually an **environment constraint**, not actual absence. The garden is designed to work around this constraint.

### Observed Constraints

| Agent | Mechanism | Consequence |
|---|---|---|
| Claude.ai web (`web_fetch`) | **Provenance-based gating** — only URLs that appear in the user message or in prior fetch responses are approved. Derived URLs are rejected with `PERMISSIONS_ERROR` | Given only the homepage, it cannot read `/robots.txt`·`/sitemap.xml`·`/llms.txt`. But if the homepage HTML contains those links as `<a href>`, subsequent fetches are approved |
| Claude.ai web (`bash_tool` curl) | **Host allowlist** — only pypi/npmjs/github/crates/Ubuntu mirrors allowed. Arbitrary domains return `HTTP/2 403 x-deny-reason: host_not_allowed` | Cannot directly verify any external site |
| Gemini web / ChatGPT web | Similar fetch gating per platform (details not public) | Same design principle applies |

### Response Policy

**Core: expose machine entry points as plaintext body links.** Don't hide them in footer-only — surface them on the homepage and core landing notes too.

1. **Footer exposes 4 machine entry points** (`quartz.layout.ts`)
   — `robots.txt`, `sitemap.xml`, `llms.txt`, `index.xml` (RSS). Embedded in every page's DOM so the entry-point chain starts no matter which page an agent hits first.
2. **`content/llms.txt` top block: self-reference + siblings**
   — so that if `llms.txt` is fetched first, the agent can still reach sitemap/robots.
3. **`content/robots.txt` comment referring to `llms.txt`**
   — not a standard field, but LLMs do read comments.
4. **Core landing notes (welcome pages, etc.) carry an entry-point block in body**
   — handled on the org source side. Covers single-page entries that don't hit the footer.

### Design Principle

Do not branch by specific LLM (Claude/Gemini/GPT). Target "network-restricted LLMs in general" with a single response: **expose links in body**.
