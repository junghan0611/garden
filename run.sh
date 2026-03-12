#!/usr/bin/env bash
set -e

# 1. 텍스트 치환 (민감 정보 필터링)
./change-text.sh

# 2. 린트 (gitleaks)
./lint.sh

# 3. 로컬 서버
npx quartz build --serve --port 1231 --concurrency 8
