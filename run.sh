#!/usr/bin/env bash
set -e

# 1. 텍스트 치환 (민감 정보 필터링)
./change-text.sh

# 2. 린트 (gitleaks)
./lint.sh

# 3. 로컬 서버 — npx는 이 root package의 bin을 못 찾아 npm 재조정에 들어갈 수 있다.
npm run quartz -- build --serve --port 1231 --concurrency 8
