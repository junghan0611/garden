# AGENTS.md — garden (Quartz v5)

Project context for AI agents. This repo is the **v5 successor workspace** for the
junghanacs digital garden. The live site keeps running on the frozen v4 repo until v5
stabilizes here.

## What this repo is

`junghan0611/garden` — a Quartz **v5**-based rebuild of `notes.junghanacs.com`. The
strategy is **base on upstream v5, attach our customizations as plugins** rather than
forking core files inline (the v4 mistake we are correcting). 522 commits / ~1,817 lines
of inline v4 forks collapse into a handful of community-plugin toggles plus 5–6 genuine
custom plugins.

| Repo | Role |
|------|------|
| [`junghanacs/notes.junghanacs.com`](https://github.com/junghanacs/notes.junghanacs.com) | **Frozen stable** — v4, publishes the live site. Do not migrate here. |
| `junghan0611/garden` (this) | **v5 dev** — migration workspace; becomes the publish source once stable. |

Account consolidation: the garden work moves from the `junghanacs` org to the
`junghan0611` personal account. One person, one account. The published **domain stays
`notes.junghanacs.com`** (bought via hostingkr, independent of any host) — `garden` is
only the repo name, never the URL.

## Workspace files

- **`AGENTS.md`** (this file) — durable baseline. Edit when a rule stabilizes.
- **`NEXT.md`** — disposable session handoff: the migration plan, next concrete move,
  blockers. Read at session start. Graduate stable facts here into AGENTS.md.
- Branch work uses `NEXT--<branch>.md`, deleted before merging to `v5`.

## Identity (carried over, unchanged)

One person, one identity, fixed across the garden's JSON-LD `Person` node
(`@id …/#person`, `alternateName: [GLG, GLGMAN, 힣, 힣맨, 정한]`):

> Junghan Kim (김정한) = GLG (힣) = GLGMAN (힣맨) = the junghanacs gardener.

Public identity links (`sameAs`) extend to LinkedIn / Bluesky / Mastodon / two GitHub
accounts at most — never add employer, company, affiliation, or device identifiers to any
public surface. The JSON-LD `isBasedOn → GitHub source` now points at
`junghan0611/garden` once this becomes the publish source.

## v5 architecture facts (vs v4)

- **Config is YAML** — `quartz.config.yaml` (no `quartz.config.ts`). JSON-schema
  validated (`quartz/plugins/quartz-plugins.schema.json`).
- **`quartz.layout.ts` is gone** — layout is a per-plugin `layout: {position, priority,
  group, condition, display}` property inside the YAML, plus a top-level `layout:` block
  with `groups` and `byPageType`.
- **Plugins are git-installed community packages** — `source: github:quartz-community/<x>`,
  pinned in `quartz.lock.json`, installed via `npx quartz plugin install`. Class plugins
  became factory functions.
- **Page-types are a first-class category** — content / folder / tag / canvas / bases.
  Our old custom category page is now upstream-supported.
- **URLs are lowercased + hyphenated natively**, and `alias-redirects` ships by default.
  This **obsoletes** the entire v4 uppercase-`T` workaround stack (Netlify 301 casing,
  sitemap `.toLowerCase()` hack, remark42 runtime uppercase restore). Delete those — do
  not port them.
- `Dockerfile` ships in v5 — useful for the later Oracle self-host step.

## Migration strategy — three buckets

Every v4 customization lands in exactly one bucket. See `NEXT.md` for the live mapping
table and phase status.

- **Bucket A — obsolete (delete, never port):** uppercase-`T` URL workarounds. Replaced
  by v5 native lowercasing + `alias-redirects`.
- **Bucket B — upstreamed (drop our patch, adopt community):** `folder-page`+`tag-page`
  (category pages), `note-properties` (frontmatter), `content-meta`, `description`,
  `content-index` (sitemap/RSS), `fonts`, native `locale: ko-KR`, base `search`.
- **Bucket C — genuinely ours (build as v5 plugins):**
  1. **JSON-LD `@graph` identity layer** — no community equivalent; custom head plugin.
  2. **ox-hugo delta patches** — `quartz-community/ox-hugo` lacks our `replaceCslEntry`,
     `removeOrgTodo`, `wrapGptelRoles`, `figure → ![[src|640]]`, and **inverts our
     anchor decision** (it removes `{#id}`; we preserve it as the heading's real HTML
     `id`). This is the **publish gate**: PR our patches upstream, or fork the plugin.
  3. **CJK + description search tuning** — verify community `search` handles CJK; else
     options/fork.
  4. **Comments** — community `comments` is giscus-only; we run remark42 (+ webmentions).
     Re-anchor threads to lowercase URLs.
  5. **Machine entry points** — footer body-links (robots/sitemap/llms/index.xml) for
     network-restricted LLMs; port the body-link strategy, not just footer links.
  6. **Brand** — GLG-Mono fonts + custom SCSS; audit against v5 DOM/class changes.

## Content pipeline (unchanged source side)

- Source: `~/org/` Denote/org-mode → `denote-export.sh` → Hugo-flavored Markdown into
  `content/`. **Junghan owns export + visual QA.** Agents do not run export/build verify
  unless asked.
- The ox-hugo → Quartz transform that was inline in v4 now runs via the `ox-hugo`
  community plugin (+ our Bucket C delta).
- Do not edit `content/` files directly — they are generated.

## Hosting — deferred, do not bundle with v5

The live site stays on **Netlify** through the entire v5 migration. Replacing Netlify
with **Oracle self-host** is a **separate, post-v5-stabilization** step. Rationale:
changing the SSG (v4→v5) and the host (Netlify→Oracle) at once hides which layer a
regression came from. One variable at a time. The v5 `Dockerfile` is the eventual
self-host seed.

## Steward role

This repo has a designated migration steward (agent). The work is a **move → build →
test loop that needs time, not difficulty** — the hard architectural calls are made; what
remains is disciplined porting and verification. Keep `NEXT.md` as the single source of
"what's next" so any sibling resuming the loop lands on the same move.

## Git

- `upstream = https://github.com/jackyzha0/quartz.git`; default branch **`v5`** tracks
  `upstream/v5` so upstream updates merge cleanly.
- `origin = junghan0611/garden`. Private during WIP; flip public at launch.
- Commit via the `commit` skill. No `Generated with Claude` / `Co-Authored-By` trailers.
  GLG pushes.
