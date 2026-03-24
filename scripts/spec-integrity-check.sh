#!/usr/bin/env bash
set -uo pipefail

# Spec Integrity Check — validates CLAUDE.md and UI_CLAUDE.md for internal consistency.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/spec-integrity-report.json"
CLAUDE_MD="$PROJECT_DIR/CLAUDE.md"
UI_CLAUDE_MD="$PROJECT_DIR/UI_CLAUDE.md"

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
echo "║       SPEC INTEGRITY CHECK                      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Check 1: No SELECT * in CLAUDE.md spec text (outside code fences is hard to parse, so check broadly) ──
echo "── Check 1: No SELECT * in spec text ──"
# Find SELECT * outside of the contract test code section (which quotes the old pattern)
# We look for it in the main body text, not inside ```code blocks```
SELECT_STAR_COUNT=0
IN_CODE_BLOCK=false
while IFS= read -r line; do
    if [[ "$line" == '```'* ]]; then
        if $IN_CODE_BLOCK; then IN_CODE_BLOCK=false; else IN_CODE_BLOCK=true; fi
        continue
    fi
    if ! $IN_CODE_BLOCK; then
        # Skip lines that reference SELECT * in a rule definition (e.g. "NEVER use SELECT *")
        if echo "$line" | grep -qi "SELECT \*" 2>/dev/null; then
            if ! echo "$line" | grep -qi "NEVER use SELECT\|Rule 11\|rule 11" 2>/dev/null; then
                SELECT_STAR_COUNT=$((SELECT_STAR_COUNT + 1))
            fi
        fi
    fi
done < "$CLAUDE_MD"

if [ "$SELECT_STAR_COUNT" -eq 0 ]; then
    record_result "No SELECT * in CLAUDE.md" "PASS" "Zero violations of Rule 11 in spec text"
else
    record_result "No SELECT * in CLAUDE.md" "FAIL" "$SELECT_STAR_COUNT SELECT * found in spec text (violates Rule 11)"
fi

# ── Check 2: Nav routes in diagram match NavRoute type ──
echo ""
echo "── Check 2: Navigation route count consistency ──"
# Count routes in UI_CLAUDE.md layout diagram (lines matching "● WORD")
DIAGRAM_ROUTES=$(grep -oP '● \w+' "$UI_CLAUDE_MD" | head -20 | wc -l)
# Count routes in NavRoute type
LAYOUT_TS="$PROJECT_DIR/apps/desktop/src/store/layout.ts"
if [ -f "$LAYOUT_TS" ]; then
    CODE_ROUTES=$(grep -oP '"[a-z]+"' "$LAYOUT_TS" | sort -u | wc -l)
    if [ "$DIAGRAM_ROUTES" -eq "$CODE_ROUTES" ]; then
        record_result "Nav route count" "PASS" "Diagram ($DIAGRAM_ROUTES) matches NavRoute type ($CODE_ROUTES)"
    else
        record_result "Nav route count" "FAIL" "Diagram has $DIAGRAM_ROUTES routes but NavRoute type has $CODE_ROUTES"
    fi
else
    record_result "Nav route count" "WARN" "layout.ts not found — skipping"
fi

# ── Check 3: DB columns documented vs actual ──
echo ""
echo "── Check 3: DB columns documented vs actual ──"
# Get actual columns from DB
ACTUAL_AE=$(docker exec rsf-postgres psql -U rsf_user -d rsf_db -t -A -c \
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'agent_events' ORDER BY ordinal_position" 2>/dev/null)
ACTUAL_ART=$(docker exec rsf-postgres psql -U rsf_user -d rsf_db -t -A -c \
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'artifacts' ORDER BY ordinal_position" 2>/dev/null)

# Check V2 columns are documented
MISSING_DOCS=0
for col in workload_id reasoning_trace context_utilization_pct router_classification_reason; do
    if ! grep -q "$col" "$CLAUDE_MD" 2>/dev/null; then
        echo "    Missing from CLAUDE.md: agent_events.$col"
        MISSING_DOCS=$((MISSING_DOCS + 1))
    fi
done
for col in test_results_breakdown spec_similarity_score; do
    if ! grep -q "$col" "$CLAUDE_MD" 2>/dev/null; then
        echo "    Missing from CLAUDE.md: artifacts.$col"
        MISSING_DOCS=$((MISSING_DOCS + 1))
    fi
done

if [ "$MISSING_DOCS" -eq 0 ]; then
    record_result "DB columns documented" "PASS" "All V2 columns present in CLAUDE.md DATABASE SCHEMA"
else
    record_result "DB columns documented" "FAIL" "$MISSING_DOCS column(s) exist in DB but not documented in CLAUDE.md"
fi

# ── Check 4: Governance API endpoints in UI_CLAUDE.md vs actual routes ──
echo ""
echo "── Check 4: API endpoints documented vs actual ──"
# Extract documented endpoints from UI_CLAUDE.md
DOC_ENDPOINTS=$(grep -oP '`(GET|POST|PATCH|DELETE|PUT) /[^`]+`' "$UI_CLAUDE_MD" | head -20 | sort -u | wc -l)
# Count actual Express route registrations
ACTUAL_ROUTES=$(grep -rE "app\.(get|post|patch|put|delete)\(" "$PROJECT_DIR/packages/governance/src/api/index.ts" 2>/dev/null | wc -l)

if [ "$DOC_ENDPOINTS" -ge "$ACTUAL_ROUTES" ]; then
    record_result "API endpoints documented" "PASS" "$DOC_ENDPOINTS documented >= $ACTUAL_ROUTES implemented"
else
    record_result "API endpoints documented" "FAIL" "Only $DOC_ENDPOINTS documented but $ACTUAL_ROUTES implemented"
fi

# ── Check 5: CLAUDE.md version matches latest spec-v* git tag ──
echo ""
echo "── Check 5: CLAUDE.md version matches git tag ──"
CLAUDE_VERSION=$(head -5 "$CLAUDE_MD" | grep -oP 'Version: \K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
LATEST_TAG=$(git tag -l 'spec-v*' --sort=-v:refname 2>/dev/null | head -1 || echo "")

if [ -z "$LATEST_TAG" ]; then
    record_result "Version tag match" "WARN" "No spec-v* tags exist yet — skipping (CLAUDE.md version: $CLAUDE_VERSION)"
else
    TAG_VERSION="${LATEST_TAG#spec-v}"
    if [ "$CLAUDE_VERSION" = "$TAG_VERSION" ]; then
        record_result "Version tag match" "PASS" "CLAUDE.md v$CLAUDE_VERSION matches tag $LATEST_TAG"
    else
        record_result "Version tag match" "FAIL" "CLAUDE.md v$CLAUDE_VERSION != tag $LATEST_TAG (v$TAG_VERSION)"
    fi
fi

# ── Check 6: CLAUDE.md version matches UI_CLAUDE.md version ──
echo ""
echo "── Check 6: Spec file versions match ──"
UI_VERSION=$(head -5 "$UI_CLAUDE_MD" | grep -oP 'Version: \K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")

if [ "$CLAUDE_VERSION" = "$UI_VERSION" ]; then
    record_result "Spec versions match" "PASS" "Both files at v$CLAUDE_VERSION"
else
    record_result "Spec versions match" "FAIL" "CLAUDE.md v$CLAUDE_VERSION != UI_CLAUDE.md v$UI_VERSION"
fi

# ── Generate report ──
echo ""
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Spec Integrity Check",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": {
    "total": $TOTAL,
    "passed": $PASS_COUNT,
    "failed": $FAIL_COUNT,
    "warnings": $WARN_COUNT
  },
  "results": [$JSON_RESULTS]
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  SPEC INTEGRITY CHECK PASSED — $PASS_COUNT passed, $WARN_COUNT warnings${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  SPEC INTEGRITY CHECK FAILED — $FAIL_COUNT failures${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
