# NEXT.md — garden v5 migration

Disposable handoff. Read at session start. AGENTS.md holds durable facts; this holds the
live plan and the next concrete move.

## NOW — the next concrete move

**Phase 1: prove vanilla v5 builds with our content.**
Copy a representative `content/` subset from the notes repo, enable `ox-hugo`, and run
`npx quartz build`. Goal is to **measure the porting delta empirically**, not to ship.

```bash
npx quartz plugin install        # pull community plugins per quartz.config.yaml
npx quartz build --serve         # local preview
```

Verify: does our ox-hugo Markdown render? Where do anchors / bib / figures break? Those
breakages are exactly Bucket C item 2.

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
- Repo visibility: private now → flip public at launch (also re-checks the identity hook).

## Done

- Repo scaffolded from `upstream/v5` (`9cf87ff`); AGENTS.md + NEXT.md written.
- Strategy locked: base on v5, attach customizations as plugins; notes repo frozen on v4;
  hosting swap deferred to post-stable.
