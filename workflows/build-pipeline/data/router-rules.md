# Model Router — Classification, Routing, and Orchestration Rules

Classify every task before dispatching to an LLM. Never bypass the router.

---

## Anti-Deliberation Constraint

**This is the single most important architectural rule in the routing layer.**

All multi-agent interactions in the build pipeline use PIPELINE (a) or ROUTING (b).
No task permits agents to engage in unconstrained deliberation.

If a task requires input from multiple agents, use AGGREGATION (c):
- Each agent produces output independently
- No agent sees another agent's output during generation
- A separate aggregation step combines outputs using confidence-weighted voting
- The aggregation logic is deterministic, not LLM-mediated

Permitted patterns:
- (a) PIPELINE — Agent A → Agent B → Agent C (sequential, each transforms prior output)
- (b) ROUTING — Orchestrator selects ONE agent to handle the task
- (c) AGGREGATION — Multiple agents produce independent outputs, aggregator combines via confidence-weighted voting

Prohibited patterns:
- (x) DEBATE — Agents discuss, argue, and reach consensus through free-form exchange
- (y) COMMITTEE — Multiple agents vote on a shared decision through deliberation

**Exception:** V2's adversarial peer review uses a critic panel, but this is structured aggregation (c), not debate (x). Each critic evaluates independently with no shared context. The aggregation rule (2/3 agree = pass) is deterministic.

**Research basis:** Pappu et al. (Stanford, Feb 2026, arXiv:2602.01011) — LLM teams consistently fail to match their best individual member, with losses up to 37.6%. Choi, Zhu, Li (NeurIPS 2025 Spotlight, arXiv:2508.17536) — multi-agent debate induces a martingale over belief trajectories; debate alone does not improve expected correctness. Wynn, Satija, Hadfield (ICML 2025, arXiv:2509.05396) — debate can decrease accuracy over time. ACL 2025 Findings — LLM agents exhibit group conformity mirroring human groupthink.

---

## Three-Tier Router Architecture

| Tier | Role | Models | Tasks | Cost |
|------|------|--------|-------|------|
| 1 (Reactive) | Instant, cheap, deterministic | Small local models OR no LLM | Schema validation, formatting, linting, type checking, regex extraction, template filling | $ (or free) |
| 2 (Coordinated) | Moderate, domain-aware | Claude Sonnet/Haiku, qwen2.5-coder:14b | Standard code gen, test gen, spec interpretation, code review, bug fix | $$ |
| 3 (Strategic) | Slow, expensive, frontier | Claude Opus, GPT-4o, o3 | Novel domains, ambiguous specs, multi-step reasoning, Tier 2 confidence < 0.7 | $$$ |

---

## Task Classification Rules

### DETERMINISTIC (Tier 1 — no LLM needed)
- JSON/YAML schema validation → use Zod/ajv directly
- Code formatting → use prettier/eslint directly
- Type checking → use tsc --noEmit directly
- File template generation from structured data → string interpolation
- Regex-based extraction from known formats

### SIMPLE (Tier 1 — small local model)
- Single-function generation with clear signature and <20 lines expected
- Docstring/comment generation for existing code
- Variable/function renaming suggestions
- Simple format conversion (e.g., CSV → JSON with known schema)

### STANDARD (Tier 2 — mid-tier model)
- Multi-function module generation
- Test generation for known patterns
- Spec interpretation for familiar domains (RPA, ETL, CRUD)
- Code review with specific criteria
- Bug fix with stack trace provided

### COMPLEX (Tier 3 — frontier model)
- Novel algorithm design
- Architecture decisions with multiple viable approaches
- Ambiguous or contradictory spec interpretation
- Multi-file refactoring with dependency analysis
- Tasks where Tier 2 agent reports confidence < 0.7
- First encounter with a new domain (no cached examples)

---

## Escalation Rules

- If Tier 1 output fails validation → escalate to Tier 2
- If Tier 2 output confidence < 0.7 → escalate to Tier 3
- If Tier 2 output fails quality gate → escalate to Tier 3 with failure context
- If Tier 3 output fails quality gate → flag for human review
- NEVER escalate DOWN (Tier 3 → Tier 2) — wastes the expensive generation

---

## Call Budget Rules (Non-Monotonic Scaling Guard)

Each task has a maximum LLM call budget. Exceeding it triggers HALT_FOR_HUMAN.

| Task Type | Max LLM Calls | Rationale |
|-----------|---------------|-----------|
| SIMPLE | 1 | One shot. If it fails, escalate tier — don't retry same tier. |
| STANDARD | 3 | Initial + 1 retry with feedback + 1 escalation |
| COMPLEX | 5 | Initial + 2 retries with feedback + 1 escalation + 1 adversarial |
| Any task with 3 consecutive failures | 0 (halt) | Non-monotonic law: more calls are making it worse |

These budgets are informed by Chen et al. (NeurIPS 2024, arXiv:2403.02419): performance is non-monotonic as LLM calls increase — more calls help easy queries but hurt hard ones.

---

## Spend Guardrails

- Daily cloud spend tracked in Redis key `rsf:daily-spend`
- If daily spend exceeds `MAX_DAILY_CLOUD_SPEND_USD` ($10 default): escalate COMPLEX to Tier 3-only mode
- If daily spend exceeds `PAUSE_THRESHOLD_USD` ($20 default): pause all cloud calls, local only
- Local models (Tier 1, Tier 2 local) have no spend limit
