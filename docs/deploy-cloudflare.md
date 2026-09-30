# Cloudflare Workers 배포 계약 (garden)

가든(`notes.junghanacs.com`)을 Cloudflare Workers **정적 자산**으로 서빙하기 위한 계약이다. 정적 자산이 먼저 응답하고(asset-first), 맞는 파일이 없을 때만 얇은 Worker
(`cloudflare/worker.mjs`)가 옛 소문자 Denote URL을 회수한다.
큰 틀(계정·토큰·DNS·Netlify 해지)은 nixos-config#11, 선례는 homepage `docs/deploy-cloudflare.md`와 homepage#3.

상태(2026-09-30): **전환 전.** 정본 호스트는 Netlify이고 `netlify.toml`의 빌드가 그대로 돈다. Worker
`junghanacs-garden`은 workers.dev에만 있다(15:14 KST 첫 `wrangler deploy`, GLG 승인, routes 없음, noindex).
이후 미리보기는 `wrangler versions upload`로 만든다. custom domain·DNS·Workers Builds 연결은
이 문서의 범위 밖 관문이다.

## 구성

| 파일 | 역할 |
|---|---|
| `wrangler.jsonc` | Worker `junghanacs-garden`, `main=cloudflare/worker.mjs`, `assets.binding=ASSETS`, `not_found_handling=404-page`, flag `assets_navigation_has_no_effect`, `run_worker_first` 없음, **routes 없음** |
| `cloudflare/worker.mjs` | asset miss에서만 실행. 존재하는 소문자 Denote URL → 301, 나머지는 asset 서버의 404 그대로. **default export 하나만** 둔다 — workerd는 main 모듈의 named export를 모두 entrypoint로 보고 상수 export가 있으면 런타임이 뜨지 않는다(2026-09-30 `wrangler dev` 실측). 순수 로직은 `garden-route.mjs`, 테스트 `worker.test.mjs` |
| `scripts/check-git-history.sh` | git 이력 관문(fail closed). 테스트 `…​.test.mjs` |
| `scripts/validate-wrangler-config.mjs` | **config 입력** gate(wrangler.jsonc, TypeScript JSONC 파서). 산출물 gate와 다른 증거 축. 테스트 `…​.test.mjs` |
| `scripts/build-cloudflare.sh` | Cloudflare 빌드 명령. gitleaks → Quartz(대소문자 보존 sitemap) → JSON-LD 검증 → post-build 생성(IndexNow 없음) → `_headers` → 산출물 gate |
| `cloudflare/_headers` | 응답 헤더. **Cloudflare 빌드만** `public/_headers`로 복사한다. Netlify는 계속 `netlify.toml`만 읽는다 |
| `scripts/validate-cloudflare-output.mjs` | 산출물 gate(파일·크기 한도, `_headers` 규칙, sitemap). 테스트 `…​.test.mjs` |
| `scripts/verify-deployed.mjs` | 배포된 호스트의 **응답** gate |

## 언어 치환(privacy filter)과 빌드 입력

- `change-text.sh`는 gitignored이고 `content/`를 제자리 치환한다. CI(Workers Builds)에는 없다.
- committed content는 이미 치환된 상태다: GLG가 `run.sh`(change-text → gitleaks → build)를 거친 뒤 커밋한다.
  2026-09-30 HEAD `15c2311b5`에서 격리 사본에 `change-text.sh`를 돌려 `content/*.md` manifest가 바뀌지 않음(NOOP)을 확인했다.
- 따라서 CI의 보장은 **Netlify와 같은 수준**이다: "커밋 전에 GLG가 run.sh를 돌렸다". CI는 gitleaks만 다시 돈다.
  치환 패턴을 리포에 옮기지 않는다(tracked 코드·문서·해시 모두).
- 로컬 preview 산출물은 **커밋된 snapshot**에서만 만든다. 워킹트리의 ignored 파일(`static/ltximg` 등)은
  `post-build.sh`의 `cp -r static/*`가 그대로 복사하므로 워킹트리 `public/`을 올리지 않는다.
- 날짜: `quartz.config.ts`의 `CreatedModifiedDate` 우선순위는 frontmatter → git → filesystem이다. 이력이 없으면 git 단계가
  조용히 checkout 시각으로 떨어진다(2026-09-30: `git archive` 사본은 "couldn't find git repository" 18건, 약 2,500 파일 본문이 달라짐).
  그래서 `check-git-history.sh`가 빌드 앞에서 막는다: git checkout이 아니면 실패, `WORKERS_CI_COMMIT_SHA`와 HEAD가 다르면 실패,
  shallow면 `git fetch --unshallow`를 **한 번** 시도하고(시간 로그, git 출력은 원격 URL을 담을 수 있어 버림) 여전히 shallow거나
  실패하면 멈춘다. 커밋 수는 로그만 하고 상수로 강제하지 않는다(로컬 기준 2,298). Workers Builds의 clone 깊이는 첫 빌드에서 측정한다.

## gitleaks (CI)

Workers Builds 이미지에 gitleaks가 있는지는 미측정이다. `build-cloudflare.sh`는 `WORKERS_CI=1`이고 PATH에 `gitleaks`가 없을 때만
공식 릴리스 `gitleaks_8.28.0_linux_x64.tar.gz`를 받고 sha256
`a65b5253807a68ac0cafa4414031fd740aeb55f54fb7e55f386acb52e6a840eb`(릴리스 `checksums.txt`, 로컬 nix판과 같은 버전)를
확인한 뒤 쓴다. 다운로드·해시·압축 해제 중 하나라도 실패하면 `set -e`로 빌드가 멈추고 배포하지 않는다.
로컬에서 PATH에 없으면 받지 않고 멈춘다. 빌드 이미지의 `curl`·`tar`·`sha256sum` 존재는 Workers Builds 연결 뒤 로그로 확인한다(미측정).

## URL 대소문자 (nixos-config#11 결정 5 → 2026-09-30 GLG 변경)

- 정본 URL은 Denote ID 그대로 대문자 `T`. Workers는 대소문자를 구분한다.
- **옛 소문자 `t` 링크는 회수한다**(GLG, 2026-09-30 15:3x: "배포 활용은 대문자지만 이것도 오는 경우 받아주자"). #11 결정 5의
  "소문자 404 감수"를 대체한다. 계약:
  - `^/(notes|meta|bib|botlog|journal)/<8자리>t<6자리>/?$` 이고 대문자 페이지가 **실제로 있을 때만** 301 → `/<섹션>/<8>T<6>`.
    Denote ID의 `t`만 바꾼다(섹션 등 나머지 casing은 그대로, 전체 대문자화 금지). trailing slash는 307 경유 없이 정본으로.
  - `Location`은 상대 경로 + 원래 query. 요청의 host로 URL을 만들지 않는다. fragment는 HTTP에 오지 않고 브라우저가 유지한다.
  - 존재 확인은 `env.ASSETS.fetch(HEAD, query 없음)`. 200만 301, 404면 404 페이지로, 그 밖의 상태는 502(`lookup-error`)로
    드러낸다 — 조회 실패를 301 성공으로 삼키지 않는다.
  - 없는 id, 임의 경로, 정적 파일 대소문자 오타(`/static/Profile.jpg`), 다른 섹션, GET/HEAD 아닌 메서드는 asset 서버 응답
    (404 페이지와 그 status·본문·Content-Type·Cache-Control)을 그대로 돌려준다.
- 왜 Worker인가: `_redirects`는 static 2,000 + dynamic 100 한도이고 placeholder는 대소문자를 바꾸지 못한다. Denote 페이지는
  2,250개(notes 837 · meta 538 · bib 680 · botlog 81 · journal 114, 2026-09-30 산출물). Bulk Redirects는 계정 규칙이라
  nixos-config 소관이고 현재 토큰 권한에 없다.
- 브라우저 함정: compat date ≥ 2025-04-01의 기본 `assets_navigation_prefers_asset_serving`은 `Sec-Fetch-Mode: navigate`
  요청의 asset miss를 Worker 없이 404 페이지로 끝낸다. 그래서 `assets_navigation_has_no_effect`를 켠다(공식 compatibility flags 문서).
- sitemap: Netlify는 대문자를 소문자로 301하므로 지금 sitemap은 소문자다(`contentIndex.tsx`). `GARDEN_URL_CASE=preserve`일 때만
  소문자화를 건너뛴다. 이 값은 `build-cloudflare.sh`만 켠다 — Netlify 빌드와 `run.sh`는 바뀌지 않는다.
  `validate-cloudflare-output.mjs`가 sitemap의 모든 `<loc>`이 정본 호스트·대문자·같은 산출물의 실제 파일인지 본다.
- 댓글: `remark42.inline.ts`의 t→T 복원은 그대로 둔다. 대문자 URL에서는 no-op이라 기존 thread key가 유지될 것이다(브라우저 미측정).

## Worker 호출 범위와 비용

- asset-first: `run_worker_first`를 쓰지 않는다. 정확히 맞는 정적 파일은 Worker 없이 응답한다 — 공식 문서상 static asset
  요청은 무료·무제한이고 Worker 요청만 Workers 요금(Free 100,000/일)에 든다. `run_worker_first` 패턴은 한도 초과 시 429라
  쓰지 않는다(billing-and-limitations 문서).
- Worker는 miss(소문자 회수·404)에서만 돈다. 404를 긁는 봇도 Worker 요청으로 센다. Free 한도를 넘었을 때 miss 응답이 어떻게
  되는지는 미측정이다.
- Worker 응답에는 `_headers`가 붙지 않는다(공식 문서). 그래서 `worker.mjs`가 `/*` 공통 헤더를 `set`으로(중복 없이), workers.dev
  host에는 noindex, 정확히 `notes.junghanacs.com`에는 HSTS를 붙인다. 값이 `cloudflare/_headers`와 같은지 테스트한다.
- 진단 헤더 `x-garden-route`(`lowercase-301` / `miss` / `lookup-error`)는 Worker 응답에만 있다. 정적 응답에 없음은 **샘플한
  응답에서의 측정**이다 — 모든 asset hit에서 Worker가 안 돈다는 보편 증명이 아니며, 그 근거는 위 asset-first 계약이다.
  공개 기능이 아니라 운영 진단이다.

## `_headers`

- Cloudflare는 한 경로에 맞는 규칙들의 **같은 이름 헤더 값을 이어 붙인다**. 그래서 한 헤더 이름은 한 경로에 맞는
  규칙 중 한 곳에만 둔다. gate는 산출물의 모든 실제 경로 × 호스트(정본, workers.dev, version preview)에서 이를 확인한다.
- 한도(공식 문서): 규칙 100개, 줄당 2,000자. 확장자 glob(`/*.woff2`)은 splat 1개 규칙으로 동작한다(로컬 `wrangler dev` 실측).
- Workers는 `text/plain`에 charset을 붙이지 않는다 → `llms.txt`·`robots.txt`에 명시. `.jsonld` 여섯 개는
  `application/ld+json; charset=utf-8`을 경로별로 명시한다.
- mutable 고정 파일명(`contentIndex.json`·CSS·JS)은 기본값과 같은 `public, max-age=0, must-revalidate`를 계약으로 명시한다.
- 정본 호스트만 HSTS(Netlify 값), `*.junghanacs.workers.dev`(production·version preview)는 `X-Robots-Tag: noindex`.

## 알려진 차이 (Netlify → Workers)

- 소문자 Denote URL: Netlify는 대문자→소문자 301 → 200, Workers는 소문자→대문자 301 → 200(존재하는 id만).
- 슬래시: `/notes` → 307 `/notes/`, `/notes/<id>/` → 307 `/notes/<id>` (Netlify 301).
- `netlify.toml`의 netlify.app → 정본 301과 `/static/*` self-rewrite는 옮기지 않는다.

## Workers Builds 연결 (Connect) — GLG 대시보드

2026-09-30 합의안(homepage 선례 + GLG 결정). 설정값은 나중에 CLI/대시보드에서 바꿀 수 있다.

| 항목 | 값 |
|---|---|
| 빌드 명령 | `./scripts/build-cloudflare.sh` |
| 배포 명령 | 기본값 `npx wrangler deploy` — 버전을 고정하지 않고, 빌드 로그의 wrangler 버전을 검수한다 |
| preview 명령 / non-production 브랜치 빌드 | 기본값 유지 / **off**. 미리보기는 `wrangler versions upload`로 만든다 |
| 빌드 토큰 | 자동 생성(Create new token) |
| 빌드 변수 | `WRANGLER_SEND_METRICS=false` |
| build cache | 첫 빌드 off, 이후 on으로 2회 측정 |
| 빌드 감시 제외 | 문서류만(`NEXT.md`, `NEXT--*.md`, `CHANGELOG.md`, `AGENTS.md`, `README.md`, `docs/**`) — 연결 뒤 설정 |
| Node | `.node-version` `v22.16.0`이 정확히 설치되는지 빌드 로그로 확인(미측정) |
| 의존성 설치 | Workers Builds가 lockfile로 자동 설치하는지 로그로 확인(미측정). 설치 시간은 이 스크립트가 아니라 Cloudflare 로그에 있다 |

- 원칙: 연결 전에 `wrangler.jsonc`와 빌드 스크립트가 main HEAD에 있어야 Cloudflare가 설정 PR을 만들지 않는다.
- 2026-09-30 경과: GLG가 16:07 KST에 Connect를 마쳤다(설정값은 위 표와 같음 — `cf builds triggers list`·`environment-variables list`
  읽기로 확인, 빌드 0건). Connect는 빌드를 시작하지 않고 첫 push가 트리거한다. 이 구현은 GLG 승인 뒤 커밋·push되며,
  CI 빌드 결과(시간·clone 깊이·설치)는 아직 측정 전이다.
- 사양(공식 Limits & pricing, 2026-05-29 갱신): Free 2 vCPU · 8 GB · 디스크 20 GB · 월 3,000 빌드 분 · 동시 1 · 빌드당 20분.
  추가 요금 문구는 Paid(6,000분 후 분당 $0.005)에만 있다. 로컬 55s(16 논리코어, Quartz parse 4 threads —
  `quartz/processors/parse.ts`는 concurrency 미명시 시 기본 1–4 threads)는 CI 시간이 아니다.
- 첫 Git 빌드에서 볼 것: `build-cloudflare:` 머리줄(commit·branch·node·npm·git 버전), `git-history:` 줄(shallow 여부·커밋 수·
  unshallow 시간), 단계별 시간표, wrangler 버전과 `Current Version ID`. 빌드가 실패하면 기존 배포 버전이 그대로인지 확인한다.
- 이 스크립트의 단계 시간표는 config · git-history · gitleaks · quartz · jsonld · post-build · headers · output-gate이다.
  실패하면 `FAILED in stage <이름>`을 찍고 멈춘다(배포 명령은 빌드 명령이 성공해야 실행된다).
- 빌드는 외부로 발행하지 않는다: IndexNow 변수 제거, sitemap 제출 없음. 준비 단계의 외부 요청은 gitleaks 다운로드(PATH에 없을 때)와 git 이력 fetch(shallow일 때)다.

## 배포 경로와 제약

- **새 Worker에는 `wrangler versions upload`가 안 된다** (2026-09-30 측정: "You cannot upload a new version of a Worker that
  does not yet exist. Please run the `deploy` command first."). 첫 생성은 `wrangler deploy`가 필요하다 — 별도 관문.
- 한도(공식 문서, Free): 버전당 파일 20,000개, 파일당 25MiB. 2026-09-30 산출물 6,251 files / 1.43GB, 최대 12.3MB.
- IndexNow·sitemap 제출은 **배포 후 통지**다. 빌드(preview·CI)에서는 보내지 않는다(`post-build.sh`는 Netlify 변수가
  없으면 건너뛰고, `build-cloudflare.sh`는 그 변수를 지운다). 전환 뒤 통지 설계는 별도.

## 검수 후보와 receipt

- 후보는 이력이 있는 격리 clone을 공개 commit에 detached로 두고, 검토된 구현 파일만 allowlist로 덮어 만든다.
  커밋 전 구현을 담은 후보는 "공개된 commit"이 아니다 — receipt는 content SHA와 overlay digest(파일별 sha256)를 따로 적는다.
- 같은 입력을 두 번 빌드해도 HTML 바이트는 같지 않다: Quartz Explorer의 요소 id(`explorer-16`/`explorer-17`)가
  빌드마다 바뀐다(2026-09-30 두 빌드 diff 측정, 약 2,500 파일). 그래서 manifest digest는 **그 빌드 한 번**의 receipt이고,
  본문 대조는 같은 빌드의 로컬 산출물과 그것을 올린 응답 사이에서만 의미가 있다.
- 후보 산출물은 로컬 검수용이다. 정본 배포는 GLG가 승인한 커밋·push 뒤의 빌드다.
- `verify-deployed.mjs`는 경로마다 응답 하나를 받아 샘플 선정·헤더·본문 해시를 모두 그 응답으로 판정한다. publicDir를 주면
  기계 진입점과 샘플 HTML의 본문을 로컬 산출물과 대조한다. 샘플한 페이지들의 세대만 증명하고 사이트 전체의 세대는 주장하지 않는다.
- 보안 4종과 Link는 리다이렉트(307)·404 응답에도 요구한다. 플랫폼이 만든 리다이렉트에 `_headers`가 붙는지는 edge에서 실측한다.

## 측정 기록 (2026-09-30, 전환 전)

모든 수치는 content SHA `15c2311b5`. 원본 로그는 `/tmp`에만 있었으므로 결정적인 줄만 옮긴다.

| 항목 | 값 |
|---|---|
| 언어 치환 | 격리 사본에서 `change-text.sh` 실행 → `content/*.md` manifest 전/후 동일(NOOP). 치환 패턴은 기록하지 않는다 |
| gitleaks | 8.28.0, `content/` 약 30.8MB, no leaks |
| baseline(`git archive`, 이력 없음) | npm ci 9s · quartz 47s(parse 18s, emit 4,930 files 27s) · validate+post-build 2s · 총 61s. git 경고("couldn't find git repository") 18건 → 날짜가 filesystem으로 떨어짐. 크기·시간 참고용 |
| 후보(이력 clone + 구현 overlay) | build-cloudflare.sh 약 50–53s, git 경고 0, `[cloudflare-output] OK files=6251 rules=22 sitemap=2252`, 테스트 18/18 |
| 산출물 | 6,251 files(+`_headers`) / 1,430,670,150 B, 최대 12,330,793 B, 25MiB 초과 0 — Free 한도 20,000 files·25MiB 안 |
| baseline ↔ 후보 | 약 2,500 files의 본문이 다름(날짜 출처 차이) → 신·구 비교는 이력 있는 빌드로만 |
| IndexNow | 두 빌드 모두 `[IndexNow] Not in Netlify build environment, skipping.` |
| 로컬 `wrangler dev`(4.143.0) | 대문자 Denote 200, 소문자 404, `/notes` → 307 `/notes/`, `/notes/<id>/` → 307 `/notes/<id>`, 확장자 glob `/*.woff2` 동작, 같은 헤더 이름 중복 없음, 307에도 보안 4종+Link. host 기반 noindex/HSTS는 localhost라 판정 불가 |
| 새 Worker | `wrangler versions upload` → "You cannot upload a new version of a Worker that does not yet exist." 계정 변경 없음 |
| `wrangler deploy --dry-run` | "Read 6266 files from the assets directory" — 디스크의 6,252(`_headers` 포함)와 14개 차이, 원인 미확인 |
| 첫 `wrangler deploy` (15:11:45–15:14:12) | "Uploaded 4934 files (1317 already uploaded) (135.17 sec)", Worker 업로드 143.64s, triggers 0.57s, 총 약 147s. Version `f2d84c5d-7c1d-4cd0-8fae-964b68d87c9a`. 4,934+1,317 = 6,251 = 디스크(`_headers` 제외). 노트북 업로드 시간이며 Workers Builds 시간과 다르다 |
| edge 응답 gate | `verify-deployed.mjs` 35 checks OK — production workers.dev와 version URL(`f2d84c5d-…`) 모두, 올린 산출물과 본문 sha256 일치. noindex는 host 규칙으로 붙음, 307에도 보안 헤더·Link·noindex |
| 브라우저 1차(`gate.mjs`, workers.dev) | Ctrl-K 열림, GLG Mono 400/700 loaded(woff2 3개 200), 4xx/5xx 0, 390px 가로 넘침 0, page error 0. **이 실행의 SPA(`/`→`/`)·CJK 검색 0건은 스크립트 artifact**(기사 밖 링크 클릭, 한글에 Playwright `fill()`) — 인용하지 않는다 |
| 브라우저 정정 probe(`probe.mjs`, 15:19 KST) | 보이는 기사 링크 클릭 + 키 입력으로 workers.dev와 Netlify 정본을 같은 방식으로 측정, **결과 동일**: SPA 2회 same-document(`./meta/20240918T175053` → `/meta/20250328T124902`), 검색 emacs 311 · 어쏠로지 20 · 디지털 가든 53 · #autholog 216, page error 0 |
| 댓글 | workers.dev에서는 remark42 iframe이 `frame-ancestors`(허용 목록에 workers.dev 없음)로 막힘 — preview origin 한계, 정본 호스트에서 확인할 것. `remark_config.url`은 대문자 Denote URL 그대로 |
| 소문자 301 후보(cand2) | overlay 12 파일, `[wrangler-config] OK`, 테스트 39/39, `[cloudflare-output] OK files=6251 rules=22 sitemap=2252`. manifest는 `cd public && find . -type f ! -name _headers` 정렬 sha256 목록의 sha256 하나로 고정(`03b1ad0a…`) — 다른 경로 표기로 해시하면 값이 달라지는 것은 조회 방법 차이다 |
| 로컬에서 잡은 결함 | `wrangler dev`: "Incorrect type for map entry 'CANONICAL_HOST' … not of type 'function or ExportedHandler'" → named export 분리, 테스트로 고정. 업로드 전 |
| `wrangler versions upload` (15:43:21–15:43:49) | 새 2,275 + 중복 3,976 = 6,251 files, 업로드 17.77s, Worker 업로드 25.61s(총 약 28s), startup 1ms. Version `30410e9a-4c93-4f8e-a029-a6688695ad69`, preview `https://30410e9a-junghanacs-garden.junghanacs.workers.dev`. `versions deploy`는 하지 않음 — 기본 workers.dev URL은 `f2d84c5d`(소문자 404) 그대로 |
| preview 응답 gate | `verify-deployed.mjs` **51 checks OK**(같은 빌드 public 본문 대조): canary `/journal/20260921t000000` + 섹션 샘플 × fetch/navigate 301, slash·query, 없는 id·`/static/Profile.jpg` 404 miss(본문 = 404.html), 전 응답 보안 4종+Link+noindex |
| preview edge 샘플 | 대문자+query 200·HEAD 200·css·woff2·jsonld 200·`/notes` 307은 `x-garden-route` 없음(샘플), HEAD 소문자 301, POST 소문자 → asset 서버 405 그대로(`miss`) |
| preview 브라우저 주소창(Playwright, `sec-fetch-mode: navigate`) | 소문자 journal/notes/meta/bib → 301 [lowercase-301] → 대문자 200, trailing slash도 한 번에; query 유지; fragment 유지하고 해당 heading 존재(`#h-2026-09-21`, `#tips-and-tricks-the-non-geek-scientist`); 없는 id·오타는 404 "Not Found". SPA 2회 same-document, 검색 311/20/53/216 — Netlify 정본과 같음 |
| Git Builds 준비 후보(cand3) | `git-history: shallow=false commits=2298`, 단계 시간 config 0s · git-history 0s · gitleaks 1s · quartz 52s · jsonld 0s · post-build 2s · headers 0s · output-gate 0s · total 55s(로컬), 테스트 45/45. git 없는 사본은 `FAILED in stage git-history`로 멈추고 `public/` 미생성 |

로컬 행은 edge 응답이 아니다. edge 판정은 첫 업로드 뒤 `verify-deployed.mjs`로 한다.

## 검증

```bash
./scripts/build-cloudflare.sh                                         # 커밋된 snapshot 사본에서
node --test scripts/validate-cloudflare-output.test.mjs scripts/validate-wrangler-config.test.mjs cloudflare/worker.test.mjs scripts/check-git-history.test.mjs
node scripts/verify-deployed.mjs https://<version>-junghanacs-garden.junghanacs.workers.dev public
```
