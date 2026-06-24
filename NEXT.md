# NEXT.md — garden v5 migration

Disposable handoff. Read at session start. AGENTS.md holds durable facts; this holds the
live plan and the next concrete move.

## NOW — the next concrete move

**Phase 1 DONE: vanilla v5 builds with full v4 content (2237 files, 45s).** Site serves at
`localhost:1231`. The next move is **catch the breakages**, comparing each against the live
`notes.junghanacs.com` page (GET + diff).

Run locally — content is **not** copied into this repo (it stays in the frozen notes repo;
`content/` is gitignored). Point `-d` at it:

```bash
NODE_OPTIONS="--max-old-space-size=8192" \
  npx quartz build --serve --port 1231 --concurrency 8 -d ~/repos/gh/notes/content
```

### Breakages to fix (compare vs live notes.junghanacs.com)

1. **Front matter leaks into body** *(highest)* — e.g. `content/index.md`: its `---` YAML
   header (`today:`, long `description` with em-dash + Greek `ξενία`, `comments:`) renders
   as plain body text. v5 core `FrontMatter` ↔ community `ox-hugo` header handling clash.
   Suspect the non-standard `today:` field and/or ox-hugo not stripping Hugo front matter.
   Diagnose: does it leak on notes *without* `today:`? Is ox-hugo's own front-matter parse
   fighting core's?
2. **LaTeX: Korean in math mode** — `$결$`-style warnings (`unicodeTextInMathMode`). ox-hugo
   exports inline `$…$` around Korean that isn't math. Bucket C ox-hugo delta.
3. **Reading time** — ContentMeta shows "15 min read" on the home index; check against v4
   layout (v4 `showReadingTime: true` only on content pages, list pages plain).
4. **Identify the real OOM culprit** — disabled 6 plugins at once to clear OOM
   (encrypted-pages / bases-page / canvas-page / unlisted-pages / note-properties /
   reader-mode). `encrypted-pages` (full-content encrypted index, 600k iters) is prime
   suspect; re-enable one at a time to confirm, then keep only what we actually want.
5. **v4 micro-settings still unmapped**: CrawlLinks `absolute` (v5 default `shortest`),
   ObsidianFM option set (wikilinks+callouts+youtube only), analytics `umami` self-host
   (v5 has `plausible`), GLG-Mono local fonts (v5 has Schibsted/Source Sans), footer links
   (v5 has stock Quartz/Discord).

## Migration mapping (v4 custom → v5 destination)

| v4 custom (lines) | v5 destination | Bucket | Status |
|---|---|---|---|
| Netlify 301 casing, sitemap `.toLowerCase()`, remark42 uppercase restore | native lowercase + `alias-redirects` | **A delete** | ☐ |
| `categoryPage.tsx` + `CategoryContent.tsx` (+303) | community `folder-page` + `tag-page` | B adopt | ☐ |
| `frontmatter.ts` (+41) | community `note-properties` | B verify | ☐ |
| `ContentMeta` / `Date` / `Footer` | community `content-meta` + `footer` | B config | ☐ |
| `contentIndex.tsx` sitemap/RSS (+89) | community `content-index` | B adopt | ☐ |
| i18n `ko-KR` (+88) | native `locale: ko-KR` | B adopt | ☐ |
| `oxhugofm.ts` (+74) | community `ox-hugo` **+ our delta** | **C gate** | ☐ |
| `Head.tsx` JSON-LD `@graph` (+138) | **new custom head plugin** | C build | ☐ |
| `search.inline.ts` CJK (+185) | community `search` (verify CJK) else fork | C verify | ☐ |
| remark42 / disqus / webmentions | **custom comments plugin** (community = giscus only) | C build | ☐ |
| footer machine entry points + body-links | community `footer` + body-link strategy | C port | ☐ |
| GLG-Mono fonts + `custom.scss`/`base.scss` (+264) | community `fonts` + custom theme/SCSS | C config | ☐ |

## ox-hugo delta (the publish gate)

`quartz-community/ox-hugo` (26-commit early plugin) covers relref / shortcode / figure→img
/ latex / anchor-removal. It is **missing** our patches and **inverts** one decision:

- `replaceCslEntry` — bib `<div class="csl-entry">` unwrap
- `removeOrgTodo` — strip `<span class="org-todo …">TODO</span>`
- `wrapGptelRoles` — `@user`/`@assistant` → styled spans
- figure → `![[src|640]]` wikilink embed (not plain `![]()`)
- **anchor: we preserve `{#id}` as the heading's real HTML `id`; community removes it** →
  our intra-page anchor links depend on this. **Decide: PR upstream vs fork.**

## Phases

1. ☐ **Prove** — vanilla v5 + content subset builds; catalog real breakages. *(NOW)*
2. ☐ **Adopt** — enable/configure Bucket A (delete) + B (community) in `quartz.config.yaml`.
3. ☐ **Build** — Bucket C custom plugins: JSON-LD head, comments, ox-hugo delta, search CJK.
4. ☐ **Gate** — resolve ox-hugo parity (PR vs fork); confirm anchors/bib/figures correct.
5. ☐ **Casing canary** — confirm `alias-redirects` covers v4 uppercase→lowercase inbound +
   remark42 thread anchors; full content build; visual QA. Still on Netlify.
6. ☐ **DEFERRED (post-v5-stable)** — Oracle self-host replaces Netlify. Separate variable;
   do not start until phase 5 is green and stable.

## Blockers / open decisions

- ox-hugo parity: PR our 5 patches upstream, or maintain a `quartz-community/ox-hugo` fork?
- Does community `search` tokenize CJK adequately, or do we re-port our matcher?
- remark42 thread re-anchoring: lowercase URL change moves comment keys — verify continuity.

## Done

- Repo scaffolded from `upstream/v5` (`9cf87ff`); AGENTS.md + NEXT.md written.
- Strategy locked: base on v5, attach customizations as plugins; notes repo frozen on v4;
  hosting swap deferred to post-stable.
- Repo flipped **private → public** (`junghan0611/garden`). Global identity hook now applies
  to commits here: the AGENTS.md GLG/힣/Junghan Kim block is the intended public persona and
  passes; the hook blocks employer/device/secret. First-commit block = a real private leak.
- Handoff received from the strategy/scaffolding session; garden migration now owned here.
- Branch renamed `v5` → `main` (local). origin push / default-branch flip left to GLG.
- `quartz.config.yaml` created from default + tuned: `pageTitle: 정한의 디지털가든`,
  `locale: ko-KR`, `baseUrl: notes.junghanacs.com`, **ox-hugo on**, popovers off.
- Disabled per GLG "clean HTML, no JS/graph" + OOM fix: graph, og-image, encrypted-pages,
  bases-page, canvas-page, unlisted-pages, note-properties, reader-mode.
- **Full build works**: 2237 v4 files → 5552 emitted in 45s, serves at `localhost:1231`.
- slug collision resolved: merged `talks/talks.md` into `talks/index.md` (notes repo, v4).
- `content/` gitignored — base config only ships from this repo; content stays in notes repo.
