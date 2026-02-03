#!/usr/bin/env bash

# 비밀 탐지: gitleaks (secretlint 대체)
# content 폴더의 markdown 파일 스캔
gitleaks detect --source=content --no-git -v
