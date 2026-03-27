# Protected Components — NEVER Modified by Self-Improvement

These components require human review (code commit) before any modification.
The improvement loop's structural enforcement blocks modifications to any path matching these patterns.

## Protected Paths

- `safety/kill-switch/` — 3-mechanism kill switch
- `safety/locked-constitution.ts` — Tier 1 immutable principles
- `safety/contract-enforcer/` — AgentSpec runtime enforcement
- `safety/cross-agent-monitor/` — Combined behavioral analysis
- `packages/foundation/src/audit/` — Dual-write audit logger
- `packages/foundation/src/secrets/` — Secret manager
- `packages/foundation/src/db/` — Database client
- `packages/governance/src/api/` — Governance REST API
- `mcp-servers/audit-mcp/` — Audit MCP with crypto signing
- `scripts/gate*` — All gate scripts (1-5, UI gates, migration gates)
- `scripts/spec-integrity-check.sh` — Spec integrity validator
- `constitution/locked-principles.md` — Locked constitution source
- `db/migrations/` — Database schema migrations
- `CLAUDE.md` — V1 master spec
- `CLAUDE_V2.md` — V2 architecture spec
- `UI_CLAUDE.md` — UI spec

## Why These Are Protected

Per SPN Scrutiny Report F-2: a sufficiently capable agent could learn to propose modifications that appear beneficial but introduce subtle vulnerabilities in safety infrastructure. Structural enforcement (not prompt-based prohibition) prevents this.

Per arXiv:2601.11369: prompt-only constitutional prohibitions yield no reliable improvement under optimization pressure. Only structural, externally-enforced governance mechanisms show meaningful reduction in policy violations.
