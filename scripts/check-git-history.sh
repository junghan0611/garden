#!/usr/bin/env bash
# =============================================================================
# check-git-history.sh — fail closed unless the checkout has full git history.
# Quartz dates pages frontmatter → git → filesystem (quartz.config.ts); without history the git step
# silently falls back to checkout time. A shallow clone is unshallowed once; anything else stops the build.
# Called by scripts/build-cloudflare.sh. Contract: docs/deploy-cloudflare.md
# =============================================================================
set -euo pipefail
cd "${1:-.}"

fail() {
  echo "git-history: FAIL $*" >&2
  exit 1
}

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not a git checkout: page dates would fall back to the filesystem"
head="$(git rev-parse HEAD 2>/dev/null)" || fail "no HEAD commit"
echo "git-history: $(git --version) head=${head} ci_commit=${WORKERS_CI_COMMIT_SHA:-none} ci_branch=${WORKERS_CI_BRANCH:-none}"
if [[ -n "${WORKERS_CI_COMMIT_SHA:-}" && "${WORKERS_CI_COMMIT_SHA}" != "${head}" ]]; then
  fail "HEAD ${head} is not the commit Workers Builds announced (${WORKERS_CI_COMMIT_SHA})"
fi

shallow="$(git rev-parse --is-shallow-repository)"
echo "git-history: shallow=${shallow} commits=$(git rev-list --count HEAD)"
if [[ "${shallow}" == true ]]; then
  # One attempt only. git's own output is dropped: an error line can carry the remote URL.
  start=${SECONDS}
  if ! git fetch --unshallow --quiet >/dev/null 2>&1; then
    fail "shallow clone and 'git fetch --unshallow' failed after $((SECONDS - start))s"
  fi
  shallow="$(git rev-parse --is-shallow-repository)"
  echo "git-history: unshallowed in $((SECONDS - start))s shallow=${shallow} commits=$(git rev-list --count HEAD)"
  [[ "${shallow}" == false ]] || fail "still shallow after unshallow"
fi
