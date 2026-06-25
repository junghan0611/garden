#!/usr/bin/env bash
set -e

# garden v5 로컬 빌드/서브 — v4처럼 직접 돌려보는 진입점.
#
# 핵심 규율 (v4 담당자 진단, GLG 방향성):
#   - 기본 heap으로 돈다. NODE_OPTIONS=--max-old-space-size 같은 증상 처방 금지.
#     tag-page OFF 상태면 기본 heap(약 2GB)으로 완주하는 게 정상 기준이다.
#   - OOM 진범은 tag-page virtual 페이지(2735개) htmlAst 동시 보유였다.
#     note-properties는 결백 → ON 유지. tag-page는 일단 OFF (태그페이지 없어도 됨,
#     v4 패리티가 먼저).
#
# content는 이 repo에 없다(content/ gitignored). v4로 frozen된 notes repo를 가리킨다.
# 다른 경로를 쓰려면 첫 인자로 넘겨라:  ./run.sh /path/to/content

CONTENT="${1:-$HOME/repos/gh/notes/content}"

# 재현성 단계 (git clean -xfd 후 필수): lockfile 핀 커밋으로 플러그인을 설치하고
# .quartz/plugins/index.ts barrel을 재생성한다. 빌드 자동 설치(loadQuartzConfig)는
# 플러그인 디렉토리만 만들고 barrel은 안 만들어서, 이 단계 없이는 Head.tsx의
# `../../.quartz/plugins` import가 깨진다. 멱등 — 캐시가 따뜻하면 "already installed"로 통과.
npx quartz plugin install

npx quartz build --serve --port 1231 --concurrency 8 -d "$CONTENT"
