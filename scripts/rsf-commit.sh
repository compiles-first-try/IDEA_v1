#!/usr/bin/env bash
# RSF Git Commit Helper
# Usage: ./scripts/rsf-commit.sh "Your commit message"
# Automatically detects spec version changes and tags accordingly.

set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: ./scripts/rsf-commit.sh 'Your commit message'"
    exit 1
fi

MSG="$1"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

SPEC_CHANGED=false
if git diff --name-only | grep -qE '^(CLAUDE|UI_CLAUDE)\.md$' 2>/dev/null; then
    SPEC_CHANGED=true
fi
if git diff --cached --name-only | grep -qE '^(CLAUDE|UI_CLAUDE)\.md$' 2>/dev/null; then
    SPEC_CHANGED=true
fi
if git status --short | grep -qE '(CLAUDE|UI_CLAUDE)\.md' 2>/dev/null; then
    SPEC_CHANGED=true
fi

git add -A
git commit -m "$MSG"
git push

if [ "$SPEC_CHANGED" = true ]; then
    SPEC_VERSION=$(head -2 CLAUDE.md | grep -oP 'Version: \K[0-9.]+')
    LATEST_TAG=$(git tag --list 'spec-v*' --sort=-v:refname | head -1 | sed 's/spec-v//' || echo "none")

    if [ "$SPEC_VERSION" != "$LATEST_TAG" ]; then
        echo ""
        echo "[RSF] Spec files changed. Version: $SPEC_VERSION (last tag: $LATEST_TAG)"
        echo "[RSF] Creating tag: spec-v$SPEC_VERSION"
        git tag "spec-v$SPEC_VERSION"
        git push --tags
        echo "[RSF] Tagged and pushed: spec-v$SPEC_VERSION"
    else
        echo ""
        echo "[RSF] Spec files changed but version ($SPEC_VERSION) matches latest tag. No new tag needed."
    fi
else
    echo ""
    echo "[RSF] No spec file changes. Regular commit (no tag)."
fi
