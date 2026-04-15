# AGENTS.md

Project context for AI agents.

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
git push → Netlify build → gog sc sitemap submit
→ wait a few days → verify in Google Search Console
```

Note: Indexing takes time after build. Wait before testing with Gemini.
