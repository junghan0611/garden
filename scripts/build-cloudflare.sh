#!/usr/bin/env bash
# =============================================================================
# build-cloudflare.sh — Cloudflare Workers build: config gate → git history gate → gitleaks → Quartz
# (case-preserving sitemap) → JSON-LD validation → post-build generation (no IndexNow) → _headers →
# output gate. Each stage is timed; any failure stops the build before wrangler deploys.
# Netlify keeps its own command in netlify.toml until the cutover. Contract: docs/deploy-cloudflare.md
#
# Privacy filter: change-text.sh is gitignored and never reaches CI. The committed content is already
# filtered because GLG runs run.sh before committing — the same guarantee Netlify has. This script
# does not run change-text.sh and must not be pointed at a working tree that has not been through it.
#
# Dependency install (npm ci) happens before this script, in the Workers Builds image; its time is in
# the Cloudflare build log, not in the table below.
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

TIMINGS=()
CURRENT_STAGE=""
stage() {
  local name="$1"
  shift
  CURRENT_STAGE="$name"
  local start=${SECONDS}
  echo "build-cloudflare: ── ${name}"
  "$@"
  TIMINGS+=("$(printf '%-12s %4ss' "$name" "$((SECONDS - start))")")
  CURRENT_STAGE=""
}
trap 'status=$?; if [[ $status -ne 0 ]]; then echo "build-cloudflare: FAILED in stage ${CURRENT_STAGE:-setup} (exit ${status}) — nothing is deployed" >&2; fi' EXIT

echo "build-cloudflare: workers_ci=${WORKERS_CI:-0} commit=${WORKERS_CI_COMMIT_SHA:-local} branch=${WORKERS_CI_BRANCH:-local}"
echo "build-cloudflare: node $(node --version) npm $(npm --version) $(git --version)"

# 1. Inputs: the wrangler config, then full git history (Quartz page dates come from it).
stage config node scripts/validate-wrangler-config.mjs wrangler.jsonc
stage git-history bash scripts/check-git-history.sh .

# 2. Secret scan (lint.sh). If gitleaks is not on PATH in CI (image contents unmeasured), fetch a pinned release.
GITLEAKS_VERSION=8.28.0
GITLEAKS_SHA256=a65b5253807a68ac0cafa4414031fd740aeb55f54fb7e55f386acb52e6a840eb
gitleaks_scan() {
  if ! command -v gitleaks >/dev/null; then
    if [[ "${WORKERS_CI:-}" != 1 ]]; then
      echo "build-cloudflare: gitleaks not on PATH" >&2
      return 1
    fi
    local tmp tarball
    tmp="$(mktemp -d)"
    tarball="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
    curl -fsSL -o "$tmp/$tarball" "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${tarball}"
    echo "${GITLEAKS_SHA256}  $tmp/$tarball" | sha256sum -c -
    tar -xzf "$tmp/$tarball" -C "$tmp" gitleaks
    export PATH="$tmp:$PATH"
  fi
  echo "gitleaks $(gitleaks version)"
  gitleaks detect --source=content --no-git --redact
}
stage gitleaks gitleaks_scan

# 3. Quartz. Workers serves file names case-sensitively, so the sitemap keeps the Denote uppercase T.
rm -rf public
stage quartz env GARDEN_URL_CASE=preserve npm run quartz -- build
stage jsonld node scripts/validate-jsonld.mjs

# 4. post-build generation. IndexNow is a publication side effect: a build is not a deploy, so the
#    Netlify variables that arm it are removed here (post-build.sh skips it without them).
stage post-build env -u CACHED_COMMIT_REF -u COMMIT_REF bash scripts/post-build.sh

# 5. Response headers, then the independent output gate. (cloudflare/worker.mjs is bundled by wrangler
#    from wrangler.jsonc "main"; it is not part of public/.)
stage headers cp cloudflare/_headers public/_headers
stage output-gate node scripts/validate-cloudflare-output.mjs public

echo "build-cloudflare: stage times (npm ci and wrangler deploy are in the Cloudflare build log)"
printf '  %s\n' "${TIMINGS[@]}"
echo "build-cloudflare: total ${SECONDS}s"
