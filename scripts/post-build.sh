#!/usr/bin/env bash
# =============================================================================
# post-build.sh — Quartz 빌드 후 실행되는 후처리 스크립트
# netlify.toml build command에서 호출
# =============================================================================
set -euo pipefail

SITE="notes.junghanacs.com"
INDEXNOW_KEY="104b38a0ed1346238062b5ea70834012"

# ---------------------------------------------------------------------------
# 1. 정적 파일 복사 + 인증 파일 생성
# ---------------------------------------------------------------------------
cp -r static/* public/static/ 2>/dev/null || true
echo "$INDEXNOW_KEY" > "public/${INDEXNOW_KEY}.txt"
echo '8d423e4a2420e4370cd8d199712fd84bf4c2967b' > public/naverfca1456e69b21d0f6b4478da73268117.html

# ---------------------------------------------------------------------------
# 2. llms.txt 자동 갱신 (4축)
#    수동 헤더 유지 + Recent Updates 섹션 자동 생성
# ---------------------------------------------------------------------------
if [ -f public/llms.txt ]; then
  TMPFILE=$(mktemp)

  {
    echo ""
    echo "## Recent Updates (auto-generated at build time)"
    echo ""

    for section in botlog notes meta bib; do
      if [ -d "content/${section}" ]; then
        echo "### ${section}"

        # frontmatter에서 date/lastmod + title 추출 → 최신 5개
        : > "$TMPFILE"
        for f in content/${section}/[0-9]*.md; do
          [ -f "$f" ] || continue
          date=$(grep -m1 '^lastmod:\|^date:' "$f" 2>/dev/null | head -1 | sed 's/^[^:]*: *//' | tr -d '"' || true)
          title=$(grep -m1 '^title:\|^today:' "$f" 2>/dev/null | sed 's/^[a-z]*: *//' | tr -d '"' || true)
          slug=$(echo "$f" | sed 's|^content/||;s|\.md$||')
          [ -n "$date" ] && [ -n "$title" ] && echo "${date}|${title}|${slug}" >> "$TMPFILE"
        done

        TOP5=$(sort -t'|' -k1 -r "$TMPFILE" | head -5 || true)
        echo "$TOP5" | while IFS='|' read -r date title slug; do
          [ -n "$title" ] && echo "- ${title}: https://${SITE}/${slug}"
        done
        echo ""
      fi
    done

    echo "Last updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } >> public/llms.txt

  rm -f "$TMPFILE"
  echo "[llms.txt] Updated with recent entries."
fi

# ---------------------------------------------------------------------------
# 3. IndexNow 자동 제출 (5축)
#    변경된 콘텐츠 URL을 Bing/Yandex/Naver에 즉시 알림
# ---------------------------------------------------------------------------
if [ -n "${CACHED_COMMIT_REF:-}" ] && [ -n "${COMMIT_REF:-}" ]; then
  CHANGED=$(git diff --name-only "$CACHED_COMMIT_REF" "$COMMIT_REF" -- content/ 2>/dev/null | \
    sed 's|^content/||;s|\.md$||' | \
    awk -v site="$SITE" '{printf "\"https://%s/%s\",", site, tolower($0)}' | \
    sed 's/,$//')

  if [ -n "$CHANGED" ]; then
    URL_COUNT=$(echo "$CHANGED" | tr ',' '\n' | wc -l)
    echo "[IndexNow] Submitting ${URL_COUNT} changed URLs..."
    curl -s -X POST "https://api.indexnow.org/IndexNow" \
      -H "Content-Type: application/json; charset=utf-8" \
      -d "{\"host\":\"${SITE}\",\"key\":\"${INDEXNOW_KEY}\",\"keyLocation\":\"https://${SITE}/${INDEXNOW_KEY}.txt\",\"urlList\":[${CHANGED}]}" \
      || echo "[IndexNow] Warning: submission failed (non-fatal)"
    echo "[IndexNow] Done."
  else
    echo "[IndexNow] No content changes detected, skipping."
  fi
else
  echo "[IndexNow] Not in Netlify build environment, skipping."
fi
