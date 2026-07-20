# NEXT — notes.junghanacs.com

Boot sector for the next session. Durable facts live in `AGENTS.md`, not here.

# STATUS — LIVE on `junghan0611/garden@main`

The repository cutover is **done** (2026-07-13). Durable facts about it now live in `AGENTS.md`
("Repository cutover"); this file only carries what is still open. Next lanes: the GLG-Mono web subset
(owned by the font steward) and the non-font PageSpeed work below.

The garden is developed **independently** — upstream Quartz is not tracked and Quartz v5 is deferred
indefinitely (see PARKED). Hosting stays Netlify; Oracle self-host is a separate, unscheduled question and no
longer waits on "v5 stable".

# NOW

## P0 — 디지털 가든 코어 (1단계 264 노트, 2미러 발행)

GLG가 2026-07-20에 연 새 레인. 정본 가든(2,239)은 그대로 두고, **선별된 코어 판본**을 두 미러에 발행한다.
위키독스 상한이 500이라 400을 천장으로 잡고, 1단계는 264로 시작한다.

목표(GLG): AI 크롤러가 미러로서 의미 있는 정보 세트를 갖는 **최소한의 자기완결 세트**.

- 블로그스팟: <https://junghanacs.blogspot.com/> — 이름 **"디지털 가든 코어"**, 방금 개설
- 위키독스: 기존 book/20676을 이 코어 판본으로 축소

**이 코어 판본 때문에 가든의 per-note 미러 링크와 `sameAs`를 제거했다**(`da0c6f74`). 선별 판본은 같은
저작물이 아니다. 되살리지 말 것 — `validate-jsonld.mjs`가 부재를 검증한다.

### 1단계 선별 규칙 — GLG 확정 2026-07-20

폴더와 태그만으로 판정된다. **예외 목록이 없다.**

```
core = notes[tag=autholog] ∪ botlog[전부] ∪ journal[2026] ∪ {index.md}
```

meta 전부 제외, bib 전부 제외. `meta/20241206T090648`(autholog 태그를 단 meta)도 제외 — meta 제외가
이긴다. 대문 `index.md`는 필수다.

| 구성 | 수 |
|---|---:|
| notes (autholog) | 154 |
| botlog 전체 | 80 |
| journal 2026 | 29 (연말 ~52까지 증가) |
| index.md | 1 |
| **합계** | **264** (연말 ≈ 287) |
| 400까지 여유 | **136** |

숫자는 스냅샷이지 계약이 아니다 — autholog는 이 세션 안에서만 160→161로 늘었다. 규칙을 코드로 옮길 때
다시 세라.

**왜 예외가 0이어야 하는가 (GLG, 2026-07-20).** meta를 일부만 편입하면 링크 재작성이 "폴더+태그 판정"에서
"노트별 멤버십 조회"로 바뀐다. 전자는 규칙이고 후자는 테이블이라, 어긋나면 한 건씩 디버깅해야 한다.
1단계는 복잡도를 줄이는 게 목적이다. **부분 편입 유혹에 빠지지 말 것** — 2단계에서 통째 단위로 늘린다.

### 자기완결성 — 1단계에서는 48.4%이고, 그래도 된다

측정: 코어가 거는 노트 링크 3,485개 중 코어 안에서 닫히는 것 1,686 / 밖으로 나가는 것 1,799.
코어 밖 고유 대상 754개 — bib 290, meta 264, notes 176, journal 23.

가장 많이 참조되는 코어 밖 노트 상위 15개 중 11개가 meta다(`meta/20250411T051011` 16회,
`meta/20240508T103852` 어쏠로지 15회, `meta/20241206T090648` 어쏠로그 10회). 즉 어쏠로그 노트들이 자기
뿌리 메타를 가리키는데 그 대상이 미러에 없다.

**이건 1단계의 결함이 아니라 성격이다.** 1단계 미러는 "자기완결 아카이브"가 아니라 **가든 입구**다.
밖으로 나가는 링크는 전부 정본 가든으로 가고, 그건 미러가 제 일을 하는 것이다. 완결률을 올리는 건
2단계 이후의 목표다.

### 링크 회수 규칙 — 위키독스 내보내기에서 검증됨

`garden2wikidocs`에 링크 대체 로직이 이미 들어갔고, 링크를 살린 채 옮길 수 있음이 확인됐다.

- 대상이 **코어 안** → 해당 미러의 자기 링크로 회수 (미러 내부에서 닫힘)
- 대상이 **코어 밖** → 정본 가든 절대 URL

1단계에서 이 판정은 폴더+태그만 보면 되므로 조회 테이블이 필요 없다.

### 단계 구조

- **1단계 (지금)**: 위 264개를 두 미러에 올린다. 시작이 반이고, 없던 정보가 공개되는 것 자체가 이득이다.
- **2단계 이후**: 완결률을 보며 통째 단위로 늘린다. 후보는 참조 빈도 상위 meta 묶음(여유 136 안에서),
  그다음이 journal 2025. **개별 노트 단위로 뽑아 넣지 말 것** — 예외 목록이 생기는 순간 1단계에서 줄인
  복잡도가 되돌아온다.
- bib는 당분간 제외 유지. 서지는 원래 외부를 가리키므로 미러에 없어도 정보가 끊기지 않는다.

### 위키독스는 지금 동기화가 죽어 있다 (2026-07-20)

위키독스가 500 제한을 걸면서 **웹훅이 돌지 않는다.** `garden2wikidocs`에서 commit/push해도 book/20676에
반영되지 않는다. 기존 2,238 페이지는 계속 서비스되지만 갱신은 불가능한 동결 상태다.

**서두를 이유는 없다.** page_id 회수는 이미 끝나 있다 — `garden2wikidocs/mapping.json`이 2,239건의
`page_id`/URL을 들고 있고, 이건 웹훅과 무관하게 보존된 자산이다. 위키독스를 지금 건드리지 않아도
잃는 것이 없다.

### 순서 — 블로거 먼저, 위키독스 나중 (권고)

1. **블로거부터.** 신규 발행이라 삭제도, URL 소실도, 색인 손실도 없다. 1단계 셀렉터를 여기서
   끝까지 돌려보고 검증한다. 실패해도 되돌릴 것이 없다.
2. **그다음 위키독스.** 축소는 파괴적이고 되돌리기 어렵다. 블로거에서 셀렉터가 증명된 뒤에 하면
   **한 번만, 맞게** 지우면 된다. 검증 안 된 셀렉터로 2,238개를 먼저 지우는 것은 순서가 거꾸로다.

### 블로거 접근면 — 조사 완료, 인증까지 뚫림 (2026-07-20)

| 사실 | 값 |
|---|---|
| blogId | **5636690999249333744** |
| 블로그 이름 | 힣(GLG) Digital Garden Core |
| URL / locale | <https://junghanacs.blogspot.com/> / ko |
| 호출 경로 | `gog api call blogger v3 <method>` (Discovery 경유, 별도 클라이언트 불필요) |
| 인증 | 노트북·Oracle **양쪽 완료** |

- **GitHub 연동 없음.** 네이티브 미지원, 서드파티 글루(Make/IFTTT)뿐이라 부적합. 위키독스의 웹훅 모델은
  이전 불가 — 로컬 푸시형 + 원장(`denote ID → postId`)으로 가야 한다. 이건 오히려 장점이다. 푸시가 곧
  배포가 아니므로 실험 여지가 생긴다.
- **Markdown 미지원.** `posts.insert`의 `content`는 HTML 문자열. 변환 단계 필수(`pandoc-html` 스킬 존재).
- **레이트 리밋이 실질 제약.** API 쿼터는 10,000 req/day지만 **블로그당 하루 포스트 생성 상한이 따로 있고
  문서화되어 있지 않다**(커뮤니티 보고 ~100건에서 403). 264건은 한 번에 못 올린다. 3일 분할 또는 스로틀을
  처음부터 설계에 넣어라.
- **라벨 제약은 통과.** 코어 264개 실측: 포스트당 태그 중앙값 5 / 최대 14(상한 20), 고유 라벨 366(상한
  2,000), 라벨 200자 초과 0건.

#### gog 스코프 추가의 함정 — 다시 밟지 말 것

blogger 스코프를 붙일 때 **큰 요청은 실패하고 작은 요청은 성공한다.** 41개(`--services user` 기본)로
요청하면 Google이 거부하고, 아래처럼 좁히면 통과한다:

```bash
gog auth add junghanacs@gmail.com --services gmail \
  --extra-scopes=https://www.googleapis.com/auth/blogger --force-consent
```

기존 권한은 안 날아간다. gogcli가 `include_granted_scopes=true`를 켜므로 Google이 **이전 승인 스코프와
합집합**을 만든다(`auth_add.go:118`에서 `--readonly`나 `--drive-scope=readonly|file`,
`--gmail-scope=readonly`일 때만 꺼진다). 실증됨: 재인증 후 Search Console이 그대로 동작.
`gog auth list`에는 `gmail`만 표시되지만 표시용 메타데이터일 뿐 런타임 게이트가 아니다.

큰 세트의 어느 스코프가 범인인지는 **미규명**. 지금 필요 없어 파지 않았다. 다른 gog 기능에서 같은 벽을
만나면 그때 좁혀라. 헤드리스(Oracle)는 `--remote --step 1` → 노트북 브라우저 승인 → `--step 2 --auth-url`.
step 1·2는 같은 머신·같은 GOG_HOME이어야 한다(PKCE verifier가 거기 있다).

### 다음 한 걸음

1. **draft 왕복 검증.** `isDraft: true`로 1건 올려 `posts.insert`·라벨·**HTML 변환 착지**를 확인한다.
   가장 불확실한 것이 변환이다 — `[!abstract]` 콜아웃, 코드블록, 한글 앵커, `{{< relref >}}` 링크가
   블로거 HTML에서 어떻게 보이는지는 한 건 올려봐야 안다. 확인 후 삭제.
2. 1단계 셀렉터를 구현한다(폴더+태그 판정, 예외 목록 없음). 두 미러가 공유할 코드다.
3. 264개를 3일 분할로 올린다. 배포 위치(노트북/Oracle)는 1번 결과를 보고 정한다 — 1단계는 한 번만
   올리면 끝나므로 노트북 분할 실행으로도 충분하다.
4. 그 뒤에 위키독스 축소를 설계한다. **결정 필요**: 기존 page_id를 삭제할지 비공개로 돌릴지,
   색인된 URL이 죽는 것을 받아들일지. 웹훅이 막혀 있으므로 축소 자체가 수동 작업일 수 있다.

**Do not touch**: `content/` 원본, 가든의 per-note 미러 링크·`sameAs`(제거 상태 유지),
`quartz/data/wikidocs-mirror.json`(2,238 엔트리는 선별 판본 이전이라 낡음 — 코어 확정 후 재import하거나 폐기).

**Read**: `docs/WIKIDOCS_MIRROR.md`, `~/repos/gh/garden2wikidocs/NEXT.md`.

## P1 — in-article outline (구현 완료, GLG 시각 게이트 대기)

GLG saw this reading affordance on the WikiDocs mirror and wants the canonical garden to match or exceed it.
**The reading-progress rail that was originally paired with it is dropped — GLG decided 2026-07-18 not to
build it.** Do not reintroduce it as a follow-up; the outline is the whole lane.

### Placement is decided, not open

GLG's ruling from the WikiDocs screenshot: the outline sits **after the `[!abstract] 이 노트에 대하여` callout,
never above it.** The abstract is the note's own opening; a navigation block must not displace it.

That rules out `beforeBody` in `quartz.layout.ts` — anything there lands above the article entirely. The outline
belongs **inside** `article.h-entry.popover-hint > div.e-content`, between the abstract callout and the first
heading.

### IMPLEMENTED 2026-07-18, awaiting GLG's visual gate

Implemented in `quartz/components/ArticleOutline.tsx`,
`quartz/components/styles/articleOutline.scss`, a split-render in `quartz/components/pages/Content.tsx`,
and a new `minDepth` option in `quartz/plugins/transformers/toc.ts`. 2,219 pages carry an outline; JSON-LD
and llms validators pass; description/RSS/sitemap byte-identical. Zero added JS, zero CLS.

Decisions taken with GLG this session:

- **Headings listed are H2 and H3** (`quartz.config.ts` `minDepth: 2, maxDepth: 3`). These are markdown
  heading *numbers*, not level counts — an earlier `maxDepth: 2` silently excluded H3 from the 1,502 notes
  that have one, and included body H1 from the 134 notes that have one. This is shared state: the desktop
  sidebar TOC reads the same `fileData.toc`, so it lists H2-H3 too. Distribution: median 8, p90 27, p99 90,
  max 163.
- **Collapse threshold 40** (`COLLAPSE_ABOVE` in `ArticleOutline.tsx`). WikiDocs never folds, so the bar is
  deliberately high — 124 of 2,219 pages fold; the rest stay open. Those 124 are journal 65 / bib 32 /
  notes 14 / botlog 12 / meta 1, and they are genuinely long documents (weekly journals, classification
  tables, collections) rather than stale exports — checked against the org sources.
- **`ox-hugo-toc` notes are skipped** so the same headings never appear twice.
- A stack-built tree preserves hierarchy when a note opens with H3 and introduces H2 later (2 such notes),
  or skips a heading depth. Verified: outline entry count equals rendered H2+H3 count on all 2,219 pages.

Remaining:

- `content/notes/20250203T221636.md` and `content/notes/20250515T161418.md` still carry the old
  `ox-hugo-toc` block. GLG removed `#+OPTIONS: toc:2` from both org sources, so a re-export clears them.
  Until then the Quartz gate suppresses the duplicate.
- Mobile was checked at 390×844: the outline wraps without horizontal overflow. Recheck after deploy as part
  of GLG's final visual gate.
- Search/hover preview suppression was verified by computed style, not by a live preview: the local
  static server cannot serve Quartz's pretty URLs, so the preview fetch never resolves. Confirm after deploy.

**Original implementation reasoning, kept because it explains why this cannot move to a transformer:**

**Insert at render time in `quartz/components/pages/Content.tsx`, not in a transformer.**

`Content.tsx` currently does one `htmlToJsx(fileData.filePath!, tree)` over the whole tree. Split it: find the
index after the first `blockquote.callout[data-callout="abstract"]` in `tree.children`, render
`{type:"root", children: before}` and `{type:"root", children: after}` separately, and put a Preact
`ArticleOutline` component between them. `renderPage.tsx:167` already uses the `htmlAst.children.slice(...)`
pattern for transclusion — follow it. Do not mutate `tree`.

Why render time and not `htmlPlugins`:

- `Plugin.Description` runs `toString(tree)` in `htmlPlugins`, so a transformer-inserted outline would leak
  every heading into `<meta name="description">` and RSS.
- `CrawlLinks` would tag the anchors `a.internal`, which makes `popover.inline.ts` attach hover previews to
  every outline entry. At render time all transformers have already run, so the anchors stay inert with no
  `data-no-popover` workaround.
- Org and exported Markdown stay untouched — this is the non-invasive requirement, satisfied structurally.

Contract:

- Source is `fileData.toc` (already built by `quartz/plugins/transformers/toc.ts`; `minDepth: 2` and
  `maxDepth: 3` in `quartz.config.ts` select H2–H3). Reuse `entry.slug` verbatim so ox-hugo custom `{#id}`
  anchors cannot drift.
- Render nothing when `fileData.toc` is absent. The transformer's gate is `toc.length > minEntries` with
  `minEntries: 1`, so a one-heading note already has no `toc`. Do **not** add a second independent threshold in
  the component — it would disagree with the sidebar TOC.
- **Never reuse `class="toc"`.** `toc.inline.ts:31` reads `if (!button || !content) return` inside its
  `getElementsByClassName("toc")` loop — a `.toc` element without a `.toc-header` button aborts the whole loop
  and kills the sidebar TOC toggle. Use a distinct class (`article-outline`).
- Do not set `data-for` on outline anchors. The sidebar already owns in-view highlighting via
  `a[data-for=...]`, and the outline scrolls out of view anyway; adding it only grows observer work.
- Nested `<ol>` to match the WikiDocs numbering, built from the flat `depth` field with a stack.

Measured facts to design against (837 notes in `content/notes/`):

| Fact | Value |
|---|---|
| Notes with the abstract callout | 831 / 837 (99.3%) |
| Headings per note | median 6, p90 17, **max 187** |

- The 6 notes without an abstract need a fallback: insert before the first heading instead. Never skip silently.
- 187 entries would bury the note. Collapse with `<details>` above a threshold (start at ~20 entries, confirm in
  the browser) — open by default below it.
- The first entries are usually export scaffolding (`히스토리`, `관련메타`, `Related-Notes`, `BIBLIOGRAPHY`).
  WikiDocs shows them too. Decide with GLG whether to render them or filter; **do not filter unilaterally**,
  it changes what the reader is told the note contains.

Known side effect to fix in the same commit:

- `.e-content` sits inside `popover-hint`, which both `popover.inline.ts:99` and `search.inline.ts:499` harvest.
  Without a rule the outline appears at the top of every hover preview and search preview. Hide it with CSS in
  `.popover-inner` and `.preview-container` — no script change needed.

Acceptance:

- Outline renders after the abstract on a normal note, before the first heading on an abstract-less note, and
  not at all on a one-heading note, home, list pages, or 404.
- Every anchor jumps correctly, including ox-hugo custom IDs and Korean anchors.
- Sidebar TOC toggle still works (the `return`-vs-`continue` trap above).
- Hover preview and search preview show note content, not the outline.
- `<meta name="description">`, RSS, and `contentIndex` abstract are byte-identical to before.
- Zero added JS, zero CLS.

### Read first

`quartz/components/pages/Content.tsx`, `quartz/components/renderPage.tsx` (`:167` slice pattern, `:269` layout),
`quartz/plugins/transformers/toc.ts`, `quartz/components/scripts/toc.inline.ts`,
`quartz/components/styles/toc.scss`, `quartz/components/scripts/popover.inline.ts`.

Preserve JSON-LD, uppercase-`T` URLs, listing invariants, and every file under `content/`. One
commit per affordance; GLG owns the final visual gate. (This line used to say "mirror links" too — those were
removed on 2026-07-20; see the core-edition lane above.)

## Cutover — SHIPPED 2026-07-13 → `CHANGELOG.md` v2026.7.13

Durable facts live in `AGENTS.md` ("Repository cutover"). Only the loose ends stay here.

1. **`garden_v5`'s own docs still call it `junghan0611/garden`** — `AGENTS.md` 9, 18, 42, 114 and `NEXT.md:129`.
   Line 114 literally reads `origin = junghan0611/garden`, which now names the **live** repo. Its actual git
   remote is explicit and safe, but an agent trusting that line could push v5 into the live garden. **v5's job**,
   flagged to that lane; no longer theoretical.
2. **Do not `gh repo archive` the old repo yet.** Rollback = relink the same Netlify site to `oldorg` + branch
   `v4`; keep that window open for a confidence period. Archiving needs `gh auth switch --user junghanacs`
   (`junghan0611` is only a collaborator there — push yes, admin no).
3. Local directory is still `~/repos/gh/notes`. Rename to `~/repos/gh/garden` when no session holds the old CWD.

## Detour 2026-07-13: PageSpeed mobile/desktop — non-font performance + accessibility

GLG ran PageSpeed Insights against the homepage and asked for an implementation-ready handoff. These are
**Lighthouse lab results, not CrUX field data** (the report says real-user data is absent), captured 2026-07-13
12:34 KST with Lighthouse 13.4.0.

- Desktop report: <https://pagespeed.web.dev/analysis/https-notes-junghanacs-com/ket92hixxz?utm_source=search_console&form_factor=desktop&hl=ko>
- Mobile report: <https://pagespeed.web.dev/analysis/https-notes-junghanacs-com/ket92hixxz?utm_source=search_console&form_factor=mobile&hl=ko>

| Surface | Perf | A11y | Best | SEO | Agentic |  FCP |  LCP |   TBT |  CLS |   SI |
| ------- | ---: | ---: | ---: | --: | ------: | ---: | ---: | ----: | ---: | ---: |
| desktop |   77 |   89 |   96 | 100 |     1/3 | 1.0s | 1.0s | 210ms | .222 | 1.8s |
| mobile  |   74 |   95 |   96 | 100 |     2/3 | 1.8s | 1.8s | 510ms | .214 | 3.5s |

**Decided 2026-07-13: do not install the Netlify Lighthouse build plugin** (the UI keeps advertising it, so this
will get re-asked). It serves `public/` from a _local static server_ inside the build container, so Netlify's
brotli, cache headers, redirects and CDN are all out of the loop — `server-response-time` and
`uses-text-compression` become fiction. It measures rather than fixes, spends build minutes on every push, and a
threshold would let a ±5–10 point lab wobble block a note publish. Everything in this detour was obtained for
free by running Lighthouse locally against the **live** site (`CHROME_PATH=$(which google-chrome) npx
lighthouse@12 https://notes.junghanacs.com/ --only-categories=…`); PSI's anonymous API quota is exhausted, so
use the local CLI or the web UI. Separately: the sole SEO deduction is `robots.txt` `Content-Signal:` flagged as
an "Unknown directive" — **keep it**. The AI-crawler policy signal is deliberate, real crawlers ignore unknown
directives harmlessly, and Lighthouse's SEO score is not a ranking factor.

### Font lane — moved to branch `font/web-subset` (2026-07-14)

`main` publishes the live garden continuously, so font experiments do not live here. The GLG-Mono web
subset work — the 8-file `{core,jp}` checkpoint, its measurements and its acceptance criteria — is
committed on **`font/web-subset`**; the handoff is `NEXT--font_web-subset.md` on that branch.

**Do not touch fonts on `main`.** `quartz/styles/custom.scss` and `quartz/static/fonts/` here carry the
live four-face GLG-Mono, unchanged.

North star (GLG, 2026-07-14): **notes is a font consumer.** GLG-Mono ships Han in Korean glyph forms, and
the font lane owns that. Nothing lands on `main` until that build exists and GLG approves both rendering
and transfer size. On the branch checkpoint a single Han character still costs 1,959KB — which is why it
is parked rather than shipped.

The work below is the independent **non-font lane**. Preferred owner: an Opus implementation pass, one
measured commit per item; GLG retains the visual/interaction gate.

### P0 — stop eager search indexing (largest non-font CPU win)

Evidence:

- Mobile: `postscript.js` CPU 2,442ms, JS execution 2.3s, main-thread work 3.2s, TBT 510ms.
- Desktop: `postscript.js` CPU 1,336ms, JS execution 1.2s, main-thread work 1.9s, TBT 210ms.
- `quartz/components/renderPage.tsx` eagerly starts `fetch("static/contentIndex.json")` on every page.
- `quartz/components/scripts/search.inline.ts` handles `nav` by awaiting it and immediately calls
  `fillDocument(data)`, adding all ~2,239 documents to FlexSearch before the user opens Search.
- The content index is ~1.81MB raw / 464KB transferred.

Fix contract:

1. Replace the eager global Promise with a memoized loader function (`fetchData()` starts once, on demand).
   Update every consumer (`search.inline.ts`, `explorer.inline.ts`, `graph.inline.ts`) together; do not leave a
   mixed Promise/function API.
2. On `nav`, Search should install only lightweight click/keyboard handlers. Fetch + `fillDocument` on the
   first Search button click or Cmd/Ctrl-K, cache the result, and show a loading state while it initializes.
3. Preserve the global populated index across SPA navigation, but refresh the current slug used to resolve
   result/preview URLs. Fix handler cleanup while there: `removeEventListener` must receive the same function
   reference, not a new lambda.

Acceptance:

- Initial homepage load does not request `contentIndex.json` solely because Search exists and does not populate
  FlexSearch before interaction.
- First Search open works by button and Cmd/Ctrl-K; CJK exact-substring behavior, `#tag` search, previews, and
  Search after two SPA navigations all still work.
- Mobile TBT materially falls; target `<300ms` before font work, with no search regression.

### P0 — lazy-load Remark42; do not execute comments during initial page load

Evidence:

- Initial load downloads Remark42 `remark.mjs` 253KB + `embed.js` 46KB + `remark.css` 45KB.
- Lighthouse estimates 121KB + 22KB unused JS and 38KB unused CSS.
- Guest startup probes `/api/v1/user?site=notes` and gets expected 401, which is the visible Best Practices
  failure. `quartz/components/scripts/remark42.inline.ts` currently injects `embed.js` immediately on `nav`.

Fix contract:

- Render the comments shell, but load Remark42 only when the shell approaches the viewport (IntersectionObserver,
  generous root margin such as 600px) or when an explicit accessible “Load comments” button is pressed.
- Do not use `requestIdleCallback` as the only gate: Lighthouse will still load it and the initial-page cost
  remains. Preserve SPA destroy/re-init, theme switching, and uppercase Denote-ID URL restoration.
- Apply the same footer-near-viewport policy to Webmentions as a smaller follow-up; it is not a score blocker.

Acceptance:

- No `comments.junghanacs.com/web/*` or guest `/api/v1/user` request on an untouched homepage load.
- Scroll/click loads comments; login, theme change, and comment continuity across SPA navigation work.
- Best Practices target: 100, unless a new independent failure appears.

### P1 — Explorer must not materialize the entire garden on load

Evidence:

- Lighthouse sees 5,001 DOM elements; `ul.content` has 837 children and depth 12.
- `explorer.inline.ts:createFolderNode()` recursively creates every descendant even for collapsed folders.
- `DesktopOnly` is CSS-only and forwards the wrapped script, so the hidden Explorer still builds on mobile.

Preferred garden-scale design:

- Explorer is **folder navigation**, Search is the note finder, and folder pages are the complete indexes.
  Initially render folders only (plus the active note/path if needed), not all ~2,239 note links.
- If GLG wants file browsing inside Explorer, use lazy subtree materialization with a hard cap and an
  “Open folder index (N)” link. Never append 837 siblings merely to show one active note.
- At minimum, skip Explorer setup while a `desktop-only` root is not visible and initialize on the first valid
  desktop display. Pair this with memoized `fetchData()`; otherwise mobile still downloads the index.

Acceptance:

- Initial homepage DOM target `<1,500` elements; mobile hidden Explorer adds no tree and no CPU work.
- Folder links, active path, saved collapse state, resize, and SPA navigation are browser-tested.
- Do not trade the DOM problem for a 5MB `/tags/`-style client renderer.

### P1 — accessibility/agentic quick wins (small, deterministic)

1. **TOC broken `aria-controls` (desktop only).** `TableOfContents.tsx` points at `toc-*`, but
   `OverflowListFactory` overwrites the supplied ID with `list-*`; the controlled target therefore does not
   exist. Expose/reuse the factory's actual ID (or make it preserve a supplied ID), and ensure the overflow
   observer uses that same ID. This should move desktop agentic accessibility from fail to pass.
2. **Main landmark.** In `renderPage.tsx`, change the central content wrapper from `<div class="center">` to
   one `<main class="center">` (sidebars/footer remain outside). Verify CSS selectors and SPA replacement.
3. **Contrast.** `search.scss` uses low-contrast `var(--gray)` for “Search”; use a passing token such as
   `var(--darkgray)`. `footer.scss` applies `opacity: .7` to the entire footer; remove inherited opacity and use
   explicit passing colors so links/text remain legible in both themes.
4. **Same text, different destination.** Rename the external footer toolchain link `Emacs` to `GNU Emacs` so it
   is not confused with the internal garden note link named `Emacs`.

Acceptance:

- Every `aria-controls` resolves to an existing element after first load and after SPA navigation.
- axe/Lighthouse: no invalid ARIA, missing main landmark, contrast, or identical-link-purpose failure.
- A11y target 100 desktop/mobile. Agentic target 2/3 on desktop/mobile. Do **not** add fake WebMCP forms merely
  to chase 3/3; mobile already passes accessibility-tree + `llms.txt`, and this site has no actionable form.

### P2 — remove homepage-only resource waste

- **KaTeX:** homepage has no math, yet global `Latex.externalResources()` loads render-blocking jsDelivr
  `katex.min.css` and `copy-tex.min.js` (mobile third-party latency ~750ms each; render-blocking estimate 600ms
  total). Preferred: emit KaTeX CSS/copy support only on pages whose rendered HAST contains KaTeX. Safe fallback
  for v4: self-host/bundle the small CSS and remove or lazy-load nonessential copy-tex JS. Verify a math-heavy
  note before shipping.
- **Unused preconnect:** `Head.tsx` always preconnects `cdnjs.cloudflare.com`, but Mermaid is disabled and PSI
  marks it unused. Remove it. Do not replace it with speculative preconnects.
- Keep `index.css` and `prescript.js` blocking until proven otherwise; dark-mode bootstrap must not flash. Measure
  before attempting critical CSS or script reshuffling.
- **`icon.png` is 684KB** (measured in the browser 2026-07-13, while checking the font waterfall). It is fetched on
  every page. Nothing needs a 684KB icon — resize/recompress it. Not investigated further; the number is real.

### P3 — security diagnostics: verify, then harden separately

Live `curl -I` already confirms `X-Frame-Options: SAMEORIGIN`, HSTS, nosniff, Referrer-Policy, and
Permissions-Policy from `netlify.toml`. Do not churn these because Lighthouse lists related informational audits.
CSP/Trusted Types/COOP are real hardening opportunities but not a casual score patch:

1. Inventory inline Quartz scripts, JSON-LD, Umami, Remark42, Webmention, and KaTeX origins.
2. Start with CSP Report-Only and test Search, SPA, comments login, analytics, JSON-LD, and external embeds.
3. Consider `Cross-Origin-Opener-Policy: same-origin` only after testing Remark42 auth/popups and share links.
4. Enforce CSP/Trusted Types in a separate commit after violations are zero; never add broad `unsafe-*` merely
   to satisfy an audit label.

### Measurement/ship loop

One concern per commit: Search → comments → Explorer → a11y → KaTeX/head cleanup. After each:

```bash
npx quartz build -o /tmp/psi-verify
node scripts/validate-jsonld.mjs /tmp/psi-verify
node scripts/validate-llms.mjs content/llms.txt /tmp/psi-verify/llms.txt
```

Then browser-test the acceptance cases above. After Netlify deploy, run mobile and desktop PSI three times and
record the median (lab scores vary). Keep SEO at 100 and the JSON-LD/llms contracts unchanged. Font-owner work
lands and is measured separately; only then reassess CLS/payload targets. Preserve the UI/CSS invariants in
`AGENTS.md` during every implementation pass.

- **Detour 2026-07-09 (a) — shipped** (`9d89bc82`): `/llms.txt` manual header unfilled into semantic line breaks,
  dead `VOCABULARY.md` link repaired, `Navigation and Identifier Schema` + `Interpretation Rules` added, unused
  `.beads/` dropped. Now guarded by `scripts/validate-llms.mjs`.

## Queued after this detour: tag hygiene (org-source side, not notes/)

Tags are **public URLs** (`/tags/{tag}`), so tag naming is a URL-stability decision, not a cosmetic one.
This detour only changes how tags are _rendered_; it must not rename any tag. Census taken 2026-07-09 by
parsing frontmatter only (`^tags: [...]` inside the leading `---` block; a plain `grep ^tags:` also matches
code blocks in note bodies and inflates the count):

| Fact                                  | Value                                                 |
| ------------------------------------- | ----------------------------------------------------- |
| Notes with frontmatter                | 2,237                                                 |
| Unique tags in frontmatter            | 2,437                                                 |
| Unique tags Quartz actually publishes | **2,436** — the gap is a silently dropped tag, see #3 |
| Tags on exactly **1** note            | **1,208 — 49.6%**                                     |
| Tags on 2 notes                       | 457                                                   |
| Tags on ≥3 notes                      | 772                                                   |
| Singular/plural collisions            | 17 pairs                                              |
| Malformed tags                        | 3                                                     |

Singular/plural pairs (AGENTS.md says prefer singular atomic tags, but the corpus mostly went plural —
decide direction per pair, don't mass-rewrite): `concept(1)/concepts(12)`, `book(1)/books(9)`,
`skill(2)/skills(6)`, `program(3)/programs(3)`, `record(1)/records(5)`, `project(1)/projects(4)`,
`bead(1)/beads(4)`, `term(1)/terms(3)`, `principle(2)/principles(1)`, `war(2)/wars(1)`, plus 7 more 1/1 pairs
(`register`, `credit`, `workstation`, `dialectic`, `other`, `play`, `talk`).

Malformed tags — tags must be `[a-z0-9]` only (AGENTS.md Denote rules):

1. **`#+filetags`** in `content/notes/20250221T175407.md` — an org header keyword leaked into the tag list.
   Slugified, it emits a real page at `public/tags/+filetags.html`. Pure garbage URL.
2. **`agent-shell`** in `content/notes/20251121T132314.md` — hyphen. Name choice is an org-side call.
3. **`false`** in `content/bib/20250524T133025.md` — org source really does carry it:
   `#+filetags: :optimism:illusions:false:promise:bib:`. ox-hugo emits it **unquoted**
   (`tags: ["optimism", "illusions", false, "promise", "bib"]`), YAML reads it as a boolean, and Quartz drops
   it. The tag vanishes with no error — that is why the published count is one lower than the frontmatter
   count. It is the only unquoted scalar in the whole corpus today, but any tag named `true`/`no`/`null`/`on`
   would fail the same way. This is a data-loss class of bug, not a cosmetic one.

Not urgent for indexing: `sitemap.xml` contains **zero** `tags/` URLs, so Google isn't being fed these.
They are still reachable via in-page links. Fix lives in `~/org/` + `denote-export.sh`, not here — export
validates nothing today, so a `^[a-z0-9]+$` gate at the export boundary is the real fix.
Open question for the cleanup pass, not for now: does a tag with exactly one note earn a URL at all?
Any rename changes a public URL, so a rename decision must come with a redirect plan.

Handed to the org-side agent (`20260709T111627-d16ea1`, cwd `~/sync/org`) on 2026-07-09 via entwurf mailbox.

# AFTER SHIP — follow-ups

1. **`refs[] → schema.org citation`** — **EXPORT-SIDE DEPENDENCY; notes-side parked.** Investigated 2026-06-29: org sources carry `#+reference:` in **1086 notes**, but `denote-export.sh` emits **NONE** into content frontmatter, and `Head.tsx` has **no `citation` receiver** → fully unstarted (not a forgotten bug — the prior JSON-LD-ship session correctly parked it on this cross-repo dependency). Real work lives in `doomemacs-config` export pipeline. **doomemacs-config (`20260629T115742-397429`) + GLG decided 2026-06-29: GO — form (b) structured `refs: [{key, title, url}]`** (resolved via citar-denote helpers `citar-denote--retrieve-references` + citar memory, NOT bare keys — bare citekeys are crawler/LLM noise). Confirmed `#+reference:` is a citar-denote field, not ox-hugo, so export drop = missing mapping (not intentional); ox-hugo has no frontmatter-citation option, so frontmatter injection is the only path. **notes-side: CODE FROZEN — build NO receiver until dexport-side ships the PoC and notifies the confirmed frontmatter schema (key name `refs`, object fields `{key,title,url}`, future git-commit field).** When schema lands, the receiver is ~20 lines: `{title,url}` → schema.org `citation {@type:"CreativeWork", name, url}` on BlogPosting/Article. This is the first case of a broader dexport "package-metadata → md frontmatter" enrichment bridge (git commit SHA → frontmatter is the planned second). Awaiting dexport schema notification.

> Verified NOT a bug (GPT flagged, refuted 2026-06-23): build-time `fileData.slug` is **uppercase T**, so `isDenoteContent` regex matches and all 2,235 denote pages emit JSON-LD with correct uppercase `isBasedOn`. The lowercase `t` is Netlify serve-time URL canonicalization only — same HTML served at both cases. Don't "fix" the regex. (See AGENTS.md "Build & URL invariants".)

# PARKED

- **Quartz v5 — deferred indefinitely (GLG, 2026-07-13).** Not "watch and prepare" any more; simply not happening for now. The v5 rebuild stays in **`junghan0611/garden_v5`** (public, `main`), strictly separate from this live garden. Two repos, two lanes; do not merge, do not port.
- **This garden is developed independently — upstream Quartz is not tracked.** Do not pull, rebase onto, or reconcile with `jackyzha0/quartz`. Its release tags (`v4.5.2`, `v5.0.0`, …) survive in local history but are not ours and are never pushed to `origin`; our own line is CalVer in `CHANGELOG.md`. The `upstream` remote is kept only as a read-only reference for reading upstream code, never as a merge source. When Quartz's code fights us, we change our code — there is no upgrade path to preserve.
- `Plugin.CustomOgImages()` disabled (`quartz.config.ts`) — every page shares `/static/og-image.png`. Enable only if per-page social cards become worth the build cost.

# VERIFY (after any Head.tsx / listing / llms.txt / export change)

```bash
npx quartz build
./scripts/post-build.sh                 # appends Recent Updates to public/llms.txt (>>, so run once per build)
node scripts/validate-jsonld.mjs
node scripts/validate-llms.mjs
node -e 'const fs=require("fs");const ex=f=>fs.readFileSync(f,"utf8").match(/ld\+json">([\s\S]*?)<\/script>/)[1];console.log(JSON.stringify(JSON.parse(ex("public/index.html")),null,1))'
# expect: validate-jsonld OK; parse failures 0; Person.image consistent; ProfilePage ImageObject on home; no Blog node; content isPartOf #website
# expect: validate-llms OK; content/llms.txt free of mid-sentence wraps; one '## Recent Updates' (none if post-build skipped)
```

A dev server is already writing `public/`, so verify a clean tree elsewhere rather than fighting it:
`npx quartz build -o /tmp/verifyout && node scripts/validate-jsonld.mjs /tmp/verifyout`.

Listing changes additionally: `grep -c 'class="tags"' public/tags/index.html` → 0, and
`du -h public/tags/index.html public/notes/index.html` → tags/index must not grow (5.0M), notes/index ≈ 696K.
CSS must be asserted against compiled `public/index.css`, and layout against a real browser — see the UI/CSS
invariants in `AGENTS.md` for what static checks cannot reveal.
