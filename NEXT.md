# NEXT.md — garden v5 migration

Disposable handoff. Read at session start. AGENTS.md holds durable facts; this holds the
live plan and the next concrete move.

## NOW — the next concrete move

**GLG가 `./run.sh`로 직접 빌드해 v4 패리티를 확인하는 단계.** 목표는 명확하다:
**태그페이지는 일단 없어도 된다 — 나머지가 v4처럼 동작하는 게 먼저다.**

Run locally — content is **not** copied into this repo (it stays in the frozen notes repo;
`content/` is gitignored). `run.sh`가 경로를 가리킨다:

```bash
./run.sh                      # 기본: ~/repos/gh/notes/content
./run.sh /path/to/content     # 다른 콘텐츠 경로
```

**기본 heap으로 돈다.** `NODE_OPTIONS=--max-old-space-size` 같은 증상 처방 금지 —
tag-page OFF 상태면 기본 heap(~2GB)으로 완주하는 게 정상 기준이다(v4 담당자 실험으로 증명).

그다음 move는 **v4와 diff** — 빌드된 페이지를 live `notes.junghanacs.com`과 비교해 breakage
잡기 (front matter leak / LaTeX 한글 / reading time 등, 아래 목록).

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
4. **OOM 진범 = `tag-page` (확정, v4 담당자 f40c43).** ~~note-properties 의심~~은 **오진**:
   NP는 결백한 트리거였다. 메커니즘 — NP ON → `tags` 파싱 → virtual 태그페이지 **2735개**
   생성 → v5 page-type 디스패처(`quartz/plugins/pageTypes/dispatcher.ts:141-142`,
   `fromHtml → vfile.data.htmlAst`)가 그 2735개 hast 트리를 **emit 내내 동시 보유** → heap
   폭발. 목적은 transclusion인데 **우리는 안 쓴다**. v4는 emit 때 렌더→파일쓰기→버려서 2GB로
   완주. 증명: tag-page OFF + NP ON + 기본 heap → `2236 parsed → 5566 emitted → 1m, OOM 없음`.
   **현 상태: tag-page OFF(임시, 태그링크 깨짐 감수), NP ON(결백), crawl-links absolute.**
   **고침 정공법(나중에, 가볍게)**: 디스패처/tag-page가 virtual htmlAst를 안 쥐게(끄거나 lazy)
   — transclusion 안 쓰니까. 차선: 태그 prune(싱글톤 정리, 콘텐츠 이득도 큼). fork는 최후수단.
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

## 기조 (GLG 방향성 — 무겁게 가지 마라)

- **가볍게. v4보다 욕심내지 마라.** 목표는 v4 *이관*이지 기능 확장이 아니다. 풀기능은 안 쓴다.
- v5 업스트림을 계속 받아내면서(머지 가능하게) 풀기능 대신 **플러그인 구조로 GLG가 직접 커스텀**.
- 우선순위: 에이전트가 **한 번에 쭉 훑기 좋은** 단순함 + 가든이 이후 진화하기 좋은 구조. 화려함 < 가독성/단순성.
- **heap 16GB 박는 증상 처방 금지.** 기본 heap으로 도는 게 정상 기준이다.

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
- **OOM 진단 종결(f40c43)**: 진범 = tag-page virtual htmlAst 보유. note-properties 결백.
  tag-page OFF + NP ON + 기본 heap으로 완주 확인. config 정합 상태로 정리됨.
- **`run.sh` 추가**: 기본 heap + content `-d ~/repos/gh/notes/content`로 직접 빌드/서브.
