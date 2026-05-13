# AGENTS.md

Project context for AI agents.

## Agent workspace

- **`AGENTS.md`** (this file) — durable, shared instructions for any agent (Claude, GPT, Gemini) working on this repo. Edit when a rule or convention stabilizes.
- **`MEMORY.md`** — short scratchpad at the repo root. Treat it the way Claude's auto-memory system treats index entries: one line per fact, ~200 characters each, no long writeups. Read it at session start; update or remove stale lines as you go. When a fact grows past a line, promote it into `AGENTS.md` and leave a pointer.
- **Do NOT create a `memory/` directory.** A single `MEMORY.md` keeps the surface area flat across Claude/GPT/Gemini.
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

## Related Repositories

| Repo | Purpose |
|------|---------|
| [doomemacs-config](https://github.com/junghan0611/doomemacs-config) | Doom Emacs config — denote-export.sh, agent-server.el |
| [agent-config](https://github.com/junghan0611/agent-config) | AI agent harness — AGENTS.md, skills, pi config |
| [gogcli](https://github.com/junghan0611/gogcli) | Google Workspace + Search Console CLI |

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

```bash
# Submit sitemap
gog sc sitemap submit --site="https://notes.junghanacs.com" \
  "https://notes.junghanacs.com/sitemap.xml" -a junghanacs@gmail.com

# Check sitemap status
gog sc sitemap list --site="https://notes.junghanacs.com" -a junghanacs@gmail.com

# Inspect a specific URL
gog sc inspect --site="https://notes.junghanacs.com" <URL> -a junghanacs@gmail.com
```

Tool: [gogcli](https://github.com/junghan0611/gogcli) — SC support added via patch.

### Deploy loop

```
Junghan export/검수 (`denote-export.sh`, `run.sh`) → git commit → git push
→ Netlify build → gog sc sitemap submit
→ wait a few days → verify in Google Search Console
```

Note: Indexing takes time after build. Wait before testing with Gemini.

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
