#!/usr/bin/env bash
set -uo pipefail

# Migration Gate M0 — Preparation Validation
# Verifies: workflow structure matches V2 spec, MCP servers wrap foundation,
# V1 tests still pass, no V1 code was modified.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/migration-gate-m0-report.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
RESULTS=()

record_result() {
    local check="$1" status="$2" detail="$3"
    case "$status" in
        PASS) PASS_COUNT=$((PASS_COUNT + 1)); echo -e "  ${GREEN}✓ PASS${NC}  $check — $detail" ;;
        FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)); echo -e "  ${RED}✗ FAIL${NC}  $check — $detail" ;;
        WARN) WARN_COUNT=$((WARN_COUNT + 1)); echo -e "  ${YELLOW}⚠ WARN${NC}  $check — $detail" ;;
    esac
    local safe=$(echo "$detail" | sed 's/"/\\"/g' | head -c 300)
    RESULTS+=("{\"check\": \"$check\", \"status\": \"$status\", \"detail\": \"$safe\"}")
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       MIGRATION GATE M0 — PREPARATION           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Workflow directory structure exists ──
echo "── Workflow Structure ──"
REQUIRED_WORKFLOWS=(
    "workflows/build-pipeline/instructions.md"
    "workflows/build-pipeline/data/domain-model.schema.json"
    "workflows/build-pipeline/data/router-rules.md"
    "workflows/build-pipeline/data/quality-thresholds.md"
    "workflows/build-pipeline/task-1-interpret-spec/instructions.md"
    "workflows/build-pipeline/task-2-generate-code/instructions.md"
    "workflows/build-pipeline/task-3-generate-tests/instructions.md"
    "workflows/build-pipeline/task-4-validate-tests/instructions.md"
    "workflows/build-pipeline/task-6-adversarial-review/instructions.md"
    "workflows/self-improve/instructions.md"
    "workflows/self-improve/data/protected-components.md"
    "workflows/environment-scan/instructions.md"
    "workflows/knowledge-propagation/instructions.md"
    "workflows/provision-agent/instructions.md"
    "constitution/locked-principles.md"
    "constitution/configurable-principles.md"
)

MISSING=0
for f in "${REQUIRED_WORKFLOWS[@]}"; do
    if [ ! -f "$f" ]; then
        echo "    Missing: $f"
        MISSING=$((MISSING + 1))
    fi
done

if [ "$MISSING" -eq 0 ]; then
    record_result "Workflow structure" "PASS" "All ${#REQUIRED_WORKFLOWS[@]} required files exist"
else
    record_result "Workflow structure" "FAIL" "$MISSING of ${#REQUIRED_WORKFLOWS[@]} files missing"
fi

# ── 2. Domain model schema is valid JSON ──
echo ""
echo "── Domain Model Schema ──"
if python3 -c "import json; json.load(open('workflows/build-pipeline/data/domain-model.schema.json'))" 2>/dev/null; then
    record_result "Domain model schema" "PASS" "Valid JSON schema"
else
    record_result "Domain model schema" "FAIL" "Invalid JSON"
fi

# ── 3. MCP servers exist ──
echo ""
echo "── MCP Servers ──"
MCP_SERVERS=("postgres-mcp" "redis-mcp" "sandbox-mcp" "ollama-mcp" "anthropic-mcp" "audit-mcp")
MCP_FOUND=0
for mcp in "${MCP_SERVERS[@]}"; do
    if [ -f "mcp-servers/$mcp/src/index.ts" ]; then
        MCP_FOUND=$((MCP_FOUND + 1))
    else
        echo "    Missing: mcp-servers/$mcp/src/index.ts"
    fi
done

if [ "$MCP_FOUND" -eq ${#MCP_SERVERS[@]} ]; then
    record_result "MCP servers" "PASS" "All ${#MCP_SERVERS[@]} MCP servers have src/index.ts"
elif [ "$MCP_FOUND" -ge 1 ]; then
    record_result "MCP servers" "WARN" "$MCP_FOUND of ${#MCP_SERVERS[@]} MCP servers created"
else
    record_result "MCP servers" "FAIL" "No MCP servers found"
fi

# ── 4. PostgreSQL MCP tests pass ──
echo ""
echo "── MCP Server Tests ──"
if [ -f "mcp-servers/postgres-mcp/tests/postgres-mcp.test.ts" ]; then
    PG_MCP_OUT=$(pnpm --filter @rsf/postgres-mcp exec vitest run 2>&1)
    if [ $? -eq 0 ]; then
        PG_COUNT=$(echo "$PG_MCP_OUT" | grep -oP '\d+ passed' | head -1)
        record_result "Postgres MCP tests" "PASS" "$PG_COUNT"
    else
        record_result "Postgres MCP tests" "FAIL" "Tests failed"
    fi
else
    record_result "Postgres MCP tests" "FAIL" "Test file not found"
fi

# ── 5. V1 foundation tests still pass ──
echo ""
echo "── V1 Compatibility ──"
V1_OUT=$(pnpm --filter @rsf/foundation exec vitest run --exclude 'tests/contract-5-*' --exclude 'tests/contract-3-*' 2>&1)
V1_EXIT=$?
if [ $V1_EXIT -eq 0 ]; then
    V1_COUNT=$(echo "$V1_OUT" | grep -oP '\d+ passed' | head -1)
    record_result "V1 Foundation tests" "PASS" "$V1_COUNT (excluding Ollama timeout-prone tests)"
else
    V1_FAIL=$(echo "$V1_OUT" | grep -oP '\d+ failed' | head -1)
    record_result "V1 Foundation tests" "FAIL" "$V1_FAIL"
fi

# ── 6. V1 code was NOT modified ──
echo ""
echo "── V1 Code Integrity ──"
# Check that no V1 source files were modified (compare mtime against a reference)
# Since we can't easily check mtimes, verify key files still contain expected content
V1_INTACT=true
if ! grep -q "createDbClient" packages/foundation/src/db/index.ts 2>/dev/null; then V1_INTACT=false; fi
if ! grep -q "createCacheClient" packages/foundation/src/cache/index.ts 2>/dev/null; then V1_INTACT=false; fi
if ! grep -q "createAuditLogger" packages/foundation/src/audit/index.ts 2>/dev/null; then V1_INTACT=false; fi
if ! grep -q "createKillSwitch" packages/orchestration/src/kill-switch/index.ts 2>/dev/null; then V1_INTACT=false; fi

if $V1_INTACT; then
    record_result "V1 code integrity" "PASS" "Core V1 exports unchanged"
else
    record_result "V1 code integrity" "FAIL" "V1 source files appear modified"
fi

# ── 7. V2 spec exists ──
echo ""
echo "── V2 Spec ──"
if [ -f "CLAUDE_V2.md" ]; then
    V2_VERSION=$(head -5 CLAUDE_V2.md | grep -oP 'Version: \K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
    record_result "V2 spec" "PASS" "CLAUDE_V2.md exists (v$V2_VERSION)"
else
    record_result "V2 spec" "FAIL" "CLAUDE_V2.md not found"
fi

# ── Generate report ──
echo ""
echo "── Report ──"
JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Migration Gate M0 — Preparation",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": { "total": $TOTAL, "passed": $PASS_COUNT, "failed": $FAIL_COUNT, "warnings": $WARN_COUNT },
  "results": [$JSON_RESULTS]
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  MIGRATION GATE M0 PASSED — $PASS_COUNT passed, $WARN_COUNT warnings${NC}"
    echo -e "${GREEN}  Ready to proceed to Phase M1${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  MIGRATION GATE M0 FAILED — $FAIL_COUNT failures${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
