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
