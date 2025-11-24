#!/usr/bin/env bash
# revert-trivial-changes.sh - Revert trivial changes (lastmod/org-id only)
#
# ox-hugo automatically updates lastmod timestamps on export.
# This script reverts files where only lastmod or org-id changed,
# keeping actual content changes.
#
# Usage:
#   ./revert-trivial-changes.sh [--dry-run]
#
# Options:
#   --dry-run   Show what would be reverted without actually reverting

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}[DRY-RUN MODE]${NC} No changes will be made"
    echo
fi

# Change to repo root
cd "$(git rev-parse --show-toplevel)"

# Find files with exactly 1 insertion and 1 deletion
echo -e "${GREEN}[INFO]${NC} Scanning for trivial changes..."

# Counters
total_changed=0
lastmod_only=0
orgid_only=0
actual_changes=0
reverted=0

# Get files with 1 line changed
while IFS=$'\t' read -r added deleted file; do
    ((total_changed++)) || true
    
    # Skip if not exactly 1 line changed
    if [[ "$added" != "1" || "$deleted" != "1" ]]; then
        ((actual_changes++)) || true
        continue
    fi
    
    # Get diff content
    diff_content=$(git diff "$file")
    
    # Check if it's lastmod only change
    if echo "$diff_content" | grep -qE "^-lastmod:" && \
       echo "$diff_content" | grep -qE "^\+lastmod:"; then
        ((lastmod_only++)) || true
        if $DRY_RUN; then
            echo -e "  ${YELLOW}[WOULD REVERT]${NC} $file (lastmod only)"
        else
            git checkout -- "$file"
            ((reverted++)) || true
            echo -e "  ${GREEN}[REVERTED]${NC} $file (lastmod only)"
        fi
        continue
    fi
    
    # Check if it's org-id only change (e.g., --org1234abc-- → --org5678def--)
    if echo "$diff_content" | grep -qE "^[-+].*--org[a-f0-9]+--"; then
        ((orgid_only++)) || true
        if $DRY_RUN; then
            echo -e "  ${YELLOW}[WOULD REVERT]${NC} $file (org-id only)"
        else
            git checkout -- "$file"
            ((reverted++)) || true
            echo -e "  ${GREEN}[REVERTED]${NC} $file (org-id only)"
        fi
        continue
    fi
    
    # Other 1-line changes (keep them)
    ((actual_changes++)) || true
    
done < <(git diff --numstat content/)

echo
echo -e "${GREEN}[SUMMARY]${NC}"
echo "  Total changed files: $total_changed"
echo "  Lastmod only:        $lastmod_only"
echo "  Org-ID only:         $orgid_only"
echo "  Actual changes:      $actual_changes"

if $DRY_RUN; then
    echo
    echo -e "${YELLOW}[DRY-RUN]${NC} Would revert $((lastmod_only + orgid_only)) files"
    echo "  Run without --dry-run to apply changes"
else
    echo "  Reverted:            $reverted"
fi
