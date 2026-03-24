#!/usr/bin/env bash
set -euo pipefail

# Gate 2 — Dependency Resolution
# Verifies all Node.js, Python, and Docker dependencies are resolved without conflicts.

REPORT_FILE="$(dirname "$0")/../gate2-report.json"
PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

record_result() {
    local check_name="$1"
    local status="$2"
    local detail="$3"

    if [ "$status" = "PASS" ]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        echo -e "  ${GREEN}✓ PASS${NC}  $check_name — $detail"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "  ${RED}✗ FAIL${NC}  $check_name — $detail"
    fi

    RESULTS+=("{\"check\": \"$check_name\", \"status\": \"$status\", \"detail\": \"$detail\"}")
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       GATE 2 — DEPENDENCY RESOLUTION            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. pnpm lockfile exists ──
echo "── Node.js / pnpm ──"
if [ -f "pnpm-lock.yaml" ]; then
    record_result "pnpm lockfile" "PASS" "pnpm-lock.yaml exists"
else
    record_result "pnpm lockfile" "FAIL" "pnpm-lock.yaml not found — run pnpm install"
fi

# ── 2. pnpm install succeeds with no errors ──
PNPM_OUTPUT=$(pnpm install 2>&1)
if echo "$PNPM_OUTPUT" | grep -qiE "ERR_PNPM|error|unresolved"; then
    record_result "pnpm install" "FAIL" "pnpm install reported errors"
else
    record_result "pnpm install" "PASS" "pnpm install completed without errors"
fi

# ── 3. No unmet peer dependencies ──
PEER_ISSUES=$(echo "$PNPM_OUTPUT" | grep -ciE "WARN.*peer|missing peer|unmet peer" || true)
if [ "$PEER_ISSUES" -eq 0 ]; then
    record_result "Peer dependencies" "PASS" "No unmet peer dependency warnings"
else
    record_result "Peer dependencies" "FAIL" "$PEER_ISSUES unmet peer dependency warning(s)"
fi

# ── 4. All workspace packages present ──
EXPECTED_PKGS=("@rsf/foundation" "@rsf/orchestration" "@rsf/manufacturing" "@rsf/quality" "@rsf/provisioning" "@rsf/meta-improvement" "@rsf/governance")
WORKSPACE_LIST=$(pnpm ls --depth -1 -r --json 2>/dev/null || echo "[]")
MISSING_PKGS=0
for pkg in "${EXPECTED_PKGS[@]}"; do
    if echo "$WORKSPACE_LIST" | grep -q "\"$pkg\""; then
        : # found
    else
        MISSING_PKGS=$((MISSING_PKGS + 1))
        echo -e "    ${YELLOW}Missing:${NC} $pkg"
    fi
done
if [ "$MISSING_PKGS" -eq 0 ]; then
    record_result "Workspace packages" "PASS" "All ${#EXPECTED_PKGS[@]} workspace packages found"
else
    record_result "Workspace packages" "FAIL" "$MISSING_PKGS of ${#EXPECTED_PKGS[@]} packages missing"
fi

# ── 5. TypeScript compiles (noEmit) ──
echo ""
echo "── TypeScript ──"
# Check each package individually since they have separate tsconfigs
TS_ERRORS=0
for pkg_dir in packages/foundation packages/orchestration packages/manufacturing packages/quality/typescript packages/provisioning packages/meta-improvement/typescript packages/governance; do
    if [ -f "$pkg_dir/tsconfig.json" ] && [ -f "$pkg_dir/src/index.ts" ]; then
        if pnpm --filter "$(node -e "console.log(require('./$pkg_dir/package.json').name)")" exec tsc --noEmit 2>/dev/null; then
            : # ok
        else
            TS_ERRORS=$((TS_ERRORS + 1))
        fi
    fi
done
if [ "$TS_ERRORS" -eq 0 ]; then
    record_result "TypeScript compilation" "PASS" "All packages compile with zero errors"
else
    record_result "TypeScript compilation" "FAIL" "$TS_ERRORS package(s) have TypeScript errors"
fi

# ── 6. Python venvs exist and deps resolved ──
echo ""
echo "── Python ──"
for py_pkg in packages/quality/python packages/meta-improvement/python; do
    pkg_name=$(basename "$(dirname "$py_pkg")")/$(basename "$py_pkg")
    if [ -d "$py_pkg/.venv" ]; then
        # Verify key packages are importable
        if "$py_pkg/.venv/bin/python" -c "import anthropic, dspy, hypothesis, pytest" 2>/dev/null; then
            record_result "Python ($pkg_name)" "PASS" "venv exists, core packages importable"
        else
            record_result "Python ($pkg_name)" "FAIL" "venv exists but core packages not importable"
        fi
    else
        record_result "Python ($pkg_name)" "FAIL" "No .venv found — run: cd $py_pkg && uv venv --python python3.11 .venv && uv pip install -e '.[dev]'"
    fi
done

# ── 7. Docker images available ──
echo ""
echo "── Docker Images ──"
EXPECTED_IMAGES=("pgvector/pgvector:pg16" "redis:7.2-alpine" "temporalio/auto-setup:1.24" "temporalio/ui:2.26.2" "jaegertracing/all-in-one:1.58" "ollama/ollama:latest")
MISSING_IMAGES=0
for img in "${EXPECTED_IMAGES[@]}"; do
    if timeout 10 docker image inspect "$img" &>/dev/null; then
        : # exists
    else
        MISSING_IMAGES=$((MISSING_IMAGES + 1))
        echo -e "    ${YELLOW}Missing image:${NC} $img"
    fi
done
if [ "$MISSING_IMAGES" -eq 0 ]; then
    record_result "Docker images" "PASS" "All ${#EXPECTED_IMAGES[@]} images available locally"
else
    record_result "Docker images" "FAIL" "$MISSING_IMAGES of ${#EXPECTED_IMAGES[@]} images missing — run docker compose pull"
fi

# ── 8. docker-compose.yml validates ──
if docker compose config --quiet 2>/dev/null; then
    record_result "docker-compose.yml" "PASS" "Compose file validates successfully"
else
    record_result "docker-compose.yml" "FAIL" "Compose file has validation errors"
fi

# ── Generate JSON report ──
echo ""
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Gate 2 — Dependency Resolution",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": {
    "total": $((PASS_COUNT + FAIL_COUNT)),
    "passed": $PASS_COUNT,
    "failed": $FAIL_COUNT
  },
  "results": [$JSON_RESULTS],
  "dependency_tree": {
    "node": {
      "package_manager": "pnpm",
      "workspace_packages": ${#EXPECTED_PKGS[@]},
      "lockfile": "pnpm-lock.yaml"
    },
    "python": {
      "package_manager": "uv",
      "environments": ["packages/quality/python/.venv", "packages/meta-improvement/python/.venv"]
    },
    "docker": {
      "images": [$(printf '"%s",' "${EXPECTED_IMAGES[@]}" | sed 's/,$//')]
    }
  }
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  GATE 2 PASSED — All $PASS_COUNT checks passed${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  GATE 2 FAILED — $FAIL_COUNT of $((PASS_COUNT + FAIL_COUNT)) checks failed${NC}"
    echo -e "${RED}  Fix all failures before proceeding to Gate 3${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
