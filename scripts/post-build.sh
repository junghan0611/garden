#!/usr/bin/env bash
# =============================================================================
# post-build.sh — Quartz 빌드 후 실행되는 후처리 스크립트 (생성만 한다 — 외부로 아무것도 보내지 않는다)
# scripts/build-cloudflare.sh, run.sh, netlify.toml build command에서 호출
# =============================================================================
set -euo pipefail

INDEXNOW_KEY="104b38a0ed1346238062b5ea70834012"

# ---------------------------------------------------------------------------
# 1. 정적 파일 복사 + 인증 파일 생성
#    INDEXNOW_KEY는 키의 유일한 출처다 — scripts/indexnow-notify.mjs가 이 줄을 읽는다.
# ---------------------------------------------------------------------------
cp -r static/* public/static/ 2>/dev/null || true
echo "$INDEXNOW_KEY" > "public/${INDEXNOW_KEY}.txt"
echo '8d423e4a2420e4370cd8d199712fd84bf4c2967b' > public/naverfca1456e69b21d0f6b4478da73268117.html

# ---------------------------------------------------------------------------
# 2. category records (schema.org ItemList sidecars)
#    Quartz/Head.tsx 외부. validate-jsonld.mjs 는 HTML만 보므로 여기서 생성한다.
#    독립 검증기가 각 sidecar 항목을 public HTML #article 과 대조한다.
# ---------------------------------------------------------------------------
node scripts/generate-category-records.mjs
node scripts/validate-category-records.mjs

# ---------------------------------------------------------------------------
# 3. llms.txt 자동 갱신
#    수동 헤더 유지 + context-weighted Recent Updates 섹션 자동 생성
# ---------------------------------------------------------------------------
if [ -f public/llms.txt ]; then
  {
    echo ""
    node scripts/generate-llms-recent.mjs
  } >> public/llms.txt

  echo "[llms.txt] Updated with context-weighted recent entries."
fi

# IndexNow는 빌드가 아니라 배포 뒤의 일이다: scripts/indexnow-notify.mjs (docs/deploy-cloudflare.md).
