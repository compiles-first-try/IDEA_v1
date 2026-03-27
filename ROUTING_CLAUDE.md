# ROUTING_CLAUDE.md — Tiered Agent Routing & Cost-Aware Orchestration

**Version:** 1.0.0
**Status:** IMPLEMENTATION SUPPLEMENT to CLAUDE_V2.md v2.0.0-draft
**Scope:** System 3 (Resource Management) — does NOT modify safety infrastructure
**M3 Compatibility:** SAFE — all items are System 3 scope, no overlap with M3 safety hardening
**Location:** `~/Projects/IDEA_v1/ROUTING_CLAUDE.md`
**Created:** 2026-03-27

---

## PURPOSE

This file implements the **model routing and agent orchestration** layer for RSF V2. It fills six specific gaps in CLAUDE_V2.md that are backed by validated scholarly research. Claude Code should treat this as a subordinate spec — CLAUDE_V2.md and CLAUDE.md take precedence where conflicts arise.

**This file does NOT duplicate anything in CLAUDE_V2.md.** It provides the implementation details for features V2 references but does not specify:
- How `router-rules.md` should classify and route tasks
- How agent capability manifests should be structured
- How semantic caching reduces cost without accuracy loss
- Why agents must never engage in unconstrained deliberation
- How System 1 (Operations) agents are organized internally
- How the router avoids the non-monotonic scaling trap

**Read CLAUDE_V2.md in full before implementing anything from this file.**

---

## DESIGN RULE: NO DELIBERATION, ONLY ROUTING

**This is the single most important architectural rule in this document.**

When multiple agents contribute to a task, RSF uses **routing and pipeline** patterns — never **unconstrained deliberation** (free-form debate between agents).

### Why This Rule Exists

Pappu, El, Cao, di Nolfo, Sun, Cao, and Zou (Stanford, Feb 2026) tested self-organizing LLM teams across human-psychology benchmarks and frontier ML benchmarks (MMLU Pro, SimpleQA, GPQA Diamond, MATH-500). Their findings:

- LLM teams consistently fail to match their best individual member's performance
- Performance losses of up to 37.6% were observed
- The bottleneck is expert *leveraging*, not expert *identification* — teams can identify who knows best but prioritize consensus over the expert's answer
- Larger teams perform worse — expertise dilution increases with team size

This is corroborated by three additional studies:

- **Choi, Zhu, and Li (NeurIPS 2025 Spotlight):** Multi-agent debate induces a martingale over belief trajectories — debate alone does not improve expected correctness. Majority voting alone accounts for most gains typically attributed to debate.
- **Wynn, Satija, and Hadfield (ICML 2025):** Debate can decrease accuracy over time even when stronger models outnumber weaker ones. Models favor agreement over challenging flawed reasoning.
- **ACL 2025 Findings:** LLM agents exhibit group conformity mirroring human groupthink across 2,500+ simulations.

**In contrast**, structured routing systems succeed:

- **AFlow (ICLR 2025 Oral):** Monte Carlo Tree Search discovers effective workflows, enabling smaller models to outperform GPT-4o at 4.55% of inference cost.
- **ReConcile (ACL 2024):** Confidence-weighted voting across heterogeneous model families outperforms single agents by up to 11.4%.
- **Mixture-of-Agents (ICML 2024):** Layered aggregation pipeline achieves 65.1% on AlpacaEval 2.0 vs GPT-4 Omni's 57.5%.

### The Rule, Precisely Stated

```
RULE: When multiple agents contribute to a single output, the architecture
MUST be one of:
  (a) PIPELINE — Agent A → Agent B → Agent C (sequential, each transforms the prior output)
  (b) ROUTING — Orchestrator selects ONE agent to handle the task
  (c) AGGREGATION — Multiple agents produce independent outputs, a separate
      aggregator combines them using confidence-weighted voting (not discussion)

The architecture MUST NOT be:
  (x) DEBATE — Agents discuss, argue, and reach consensus through free-form exchange
  (y) COMMITTEE — Multiple agents vote on a shared decision through deliberation
```

**Exception:** V2's adversarial peer review (Capability 2) uses a critic panel, but this is structured aggregation (c), not debate (x). Each critic evaluates independently with no shared context between critics. The aggregation rule (2/3 agree = pass) is deterministic, not deliberative.

### Implementation

This rule requires no new code. It is a **design constraint** enforced during workflow authoring. Every `instructions.md` file in the `workflows/` directory must specify which pattern (a, b, or c) it uses. Claude Code should flag any workflow that describes agents "discussing," "debating," or "reaching consensus" as a violation.

Add to `workflows/build-pipeline/data/router-rules.md`:

```markdown
## Anti-Deliberation Constraint

All multi-agent interactions in the build pipeline use PIPELINE (a) or ROUTING (b).
No task permits agents to engage in unconstrained deliberation.

If a task requires input from multiple agents, use AGGREGATION (c):
- Each agent produces output independently
- No agent sees another agent's output during generation
- A separate aggregation step combines outputs using confidence-weighted voting
- The aggregation logic is deterministic, not LLM-mediated
```

---

## CAPABILITY: TIERED MODEL ROUTING

### The Problem V2 Identifies But Doesn't Solve

CLAUDE_V2.md lists "Model router" in System 3 and includes `router-rules.md` in the file tree, but does not specify how routing decisions are made. This section provides the implementation.

### The Research Basis

Six independent studies converge on the same finding: intelligent routing between cheap and expensive models preserves 95-99% of quality while cutting costs 50-98%.

| Study | Venue | Key Finding |
|-------|-------|-------------|
| FrugalGPT (Chen, Zaharia, Zou, 2023) | TMLR 2024 | Cascading from cheap to expensive models with confidence threshold matches GPT-4 at up to 98% cost reduction |
| RouteLLM (Ong et al., 2024) | ICLR 2025 | Learned router trained on preference data achieves >2× cost reduction with 85% savings on MT Bench |
| AutoMix (Aggarwal, Madaan et al., 2024) | NeurIPS 2024 | POMDP-based router with few-shot self-verification reduces cost >50% at comparable performance |
| Kulkarni & Kulkarni (2026) | arXiv:2603.22651 | 2-tier routing: 51.3% cost reduction at 98.2% F1. 3-tier adds 0.006 F1 at moderate cost. Combined optimized: 89% accuracy recovery at 1.15× baseline cost |
| Chen et al. (2024) | NeurIPS 2024 | Performance is NON-MONOTONIC as LLM calls increase — more calls help easy queries but hurt hard ones |
| Shazeer et al. (2017) / Fedus et al. (2022) | ICLR 2017 / JMLR 2022 | MoE sparse activation: Mixtral 8x7B with 13B active params outperforms Llama 2 70B |

### The Three-Tier Router Architecture

This maps directly onto the human autonomic nervous system's three-tiered hierarchy, validated by neuroscience (Benarroch 1993, Jänig 2006, Dougherty 2020):

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 3: STRATEGIC (Cortical/Limbic — slow, expensive)      │
│                                                             │
│  Models: Claude Opus, GPT-4o, o3                            │
│  Tasks: Novel domain problems, ambiguous specs, multi-step  │
│         reasoning, tasks where Tier 2 confidence < 0.7      │
│  Latency: seconds                                           │
│  Cost: $$$                                                  │
│  Trigger: Tier 2 escalation OR router classifies as COMPLEX │
│                                                             │
│  ANS analogy: Cortex recognizes the bear, amygdala triggers │
│  fear, hypothalamus coordinates the full-body response      │
├─────────────────────────────────────────────────────────────┤
│  TIER 2: COORDINATED (Hypothalamic — moderate, domain-aware)│
│                                                             │
│  Models: Claude Sonnet/Haiku, qwen2.5-coder:14b, Mixtral   │
│  Tasks: Standard code generation, test generation, spec     │
│         interpretation for known domains, domain workflows  │
│  Latency: sub-second to seconds                             │
│  Cost: $$                                                   │
│  Trigger: Router classifies as STANDARD                     │
│                                                             │
│  ANS analogy: Blood pressure drops → heart rate increases   │
│  and vessels constrict — coordinated, automatic, no brain   │
├─────────────────────────────────────────────────────────────┤
│  TIER 1: REACTIVE (Spinal — instant, cheap, deterministic)  │
│                                                             │
│  Models: Small local models OR deterministic code (no LLM)  │
│  Tasks: Schema validation, format checking, linting, type   │
│         checking, regex extraction, template filling         │
│  Latency: milliseconds                                      │
│  Cost: $ (or free — no API call)                            │
│  Trigger: Router classifies as SIMPLE or DETERMINISTIC      │
│                                                             │
│  ANS analogy: Touch hot stove → hand pulls away before      │
│  brain knows. Spinal cord handles it locally.               │
└─────────────────────────────────────────────────────────────┘
```

### Router Classification Logic

The router is a lightweight classifier that runs BEFORE any agent executes. It examines the task and assigns a tier. The router itself should be cheap — a small model or rule-based system, NOT a frontier model.

Add to `workflows/build-pipeline/data/router-rules.md`:

```markdown
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

### ESCALATION RULES
- If Tier 1 output fails validation → escalate to Tier 2
- If Tier 2 output confidence < 0.7 → escalate to Tier 3
- If Tier 2 output fails quality gate → escalate to Tier 3 with failure context
- If Tier 3 output fails quality gate → flag for human review
- NEVER escalate DOWN (Tier 3 → Tier 2) — wastes the expensive generation
```

### Confidence-Based Escalation Implementation

This connects to V2's epistemic uncertainty tracking (Rule 16). The router uses the uncertainty envelope to decide escalation:

```typescript
// In: workflows/build-pipeline/data/escalation-logic.ts
// This is a DETERMINISTIC function — no LLM involved

interface UncertaintyEnvelope {
  epistemic: number;   // 0-1, resolvable with more data
  aleatoric: number;   // 0-1, inherent randomness
  method: string;
  disagreement_points: string[];
  knowledge_gaps: string[];
}

interface EscalationDecision {
  action: 'PROCEED' | 'ESCALATE' | 'SEEK_INFORMATION' | 'HALT_FOR_HUMAN';
  reason: string;
  target_tier?: 2 | 3;
}

function decideEscalation(
  current_tier: 1 | 2 | 3,
  uncertainty: UncertaintyEnvelope,
  gate_passed: boolean
): EscalationDecision {
  // Gate failure always escalates (if not already at Tier 3)
  if (!gate_passed && current_tier < 3) {
    return {
      action: 'ESCALATE',
      reason: `Quality gate failed at Tier ${current_tier}`,
      target_tier: (current_tier + 1) as 2 | 3
    };
  }

  // Gate failure at Tier 3 → human review
  if (!gate_passed && current_tier === 3) {
    return {
      action: 'HALT_FOR_HUMAN',
      reason: 'Quality gate failed at highest tier'
    };
  }

  // High epistemic uncertainty → seek information first
  if (uncertainty.epistemic > 0.6 && uncertainty.aleatoric < 0.3) {
    return {
      action: 'SEEK_INFORMATION',
      reason: `High epistemic uncertainty (${uncertainty.epistemic}). ` +
              `Knowledge gaps: ${uncertainty.knowledge_gaps.join(', ')}`
    };
  }

  // High both → halt
  if (uncertainty.epistemic > 0.5 && uncertainty.aleatoric > 0.5) {
    return {
      action: 'HALT_FOR_HUMAN',
      reason: 'Both epistemic and aleatoric uncertainty are high — insufficient basis for action'
    };
  }

  // Moderate epistemic at Tier 1/2 → escalate
  if (uncertainty.epistemic > 0.35 && current_tier < 3) {
    return {
      action: 'ESCALATE',
      reason: `Epistemic uncertainty ${uncertainty.epistemic} exceeds tier ${current_tier} threshold`,
      target_tier: (current_tier + 1) as 2 | 3
    };
  }

  return { action: 'PROCEED', reason: 'Uncertainty within acceptable bounds' };
}
```

### Non-Monotonic Scaling Guard

Chen et al. (NeurIPS 2024) proved that performance is non-monotonic as LLM calls increase. The router must enforce a call budget per task:

```markdown
## Call Budget Rules (add to router-rules.md)

Each task has a maximum LLM call budget. Exceeding it triggers HALT_FOR_HUMAN.

| Task Type | Max LLM Calls | Rationale |
|-----------|---------------|-----------|
| SIMPLE | 1 | One shot. If it fails, escalate tier — don't retry same tier. |
| STANDARD | 3 | Initial + 1 retry with feedback + 1 escalation |
| COMPLEX | 5 | Initial + 2 retries with feedback + 1 escalation + 1 adversarial |
| Any task with 3 consecutive failures | 0 (halt) | Non-monotonic law: more calls are making it worse |

These budgets are informed by the NeurIPS 2024 finding that performance degrades
after a task-specific optimal number of calls. The budgets are conservative starting
points — adjust based on measured Pareto front data (see Pareto Tracking below).
```

---

## CAPABILITY: AGENT CAPABILITY MANIFESTS

### The Problem

V2's governance API exposes `GET /governance/agents` for agent blueprints, but there is no formal schema for what an agent declares about itself. The router needs structured metadata to make fast, accurate routing decisions.

### The Schema

Each agent in `workflows/` must include an `agent-manifest.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["agent_id", "display_name", "tier", "capabilities", "cost_profile"],
  "properties": {
    "agent_id": {
      "type": "string",
      "description": "Unique identifier matching the workflow directory name"
    },
    "display_name": {
      "type": "string",
      "description": "Human-readable name shown in UI"
    },
    "tier": {
      "enum": [1, 2, 3],
      "description": "Default operating tier (1=reactive, 2=coordinated, 3=strategic)"
    },
    "capabilities": {
      "type": "object",
      "properties": {
        "generalist": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Broad task categories this agent handles adequately"
        },
        "specialist": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Specific sub-domains where this agent excels"
        }
      }
    },
    "models": {
      "type": "object",
      "properties": {
        "primary": { "type": "string", "description": "Default model for this agent" },
        "fallback": { "type": "string", "description": "Cheaper model for simple tasks" },
        "escalation": { "type": "string", "description": "More capable model for hard tasks" }
      }
    },
    "cost_profile": {
      "type": "object",
      "properties": {
        "avg_tokens_per_task": { "type": "number" },
        "avg_latency_ms": { "type": "number" },
        "avg_cost_usd": { "type": "number" }
      }
    },
    "confidence_calibration": {
      "type": "object",
      "properties": {
        "historical_accuracy_at_confidence": {
          "type": "object",
          "description": "Map of confidence bucket → actual accuracy. E.g., '0.8-0.9': 0.85",
          "additionalProperties": { "type": "number" }
        },
        "last_calibrated": { "type": "string", "format": "date-time" }
      }
    },
    "escalation_targets": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Agent IDs this agent escalates to when confidence is low"
    },
    "input_schema": { "type": "string", "description": "Path to JSON schema for expected input" },
    "output_schema": { "type": "string", "description": "Path to JSON schema for guaranteed output" }
  }
}
```

### Example: Code Generation Agent

```json
{
  "agent_id": "task-2-generate-code",
  "display_name": "Code Generator",
  "tier": 2,
  "capabilities": {
    "generalist": ["typescript-function", "python-function", "sql-query", "shell-script"],
    "specialist": ["typescript-module", "express-api", "zod-schema", "prisma-model"]
  },
  "models": {
    "primary": "qwen2.5-coder:14b",
    "fallback": "qwen2.5-coder:7b",
    "escalation": "claude-sonnet-4-6-20250514"
  },
  "cost_profile": {
    "avg_tokens_per_task": 2400,
    "avg_latency_ms": 3200,
    "avg_cost_usd": 0.004
  },
  "confidence_calibration": {
    "historical_accuracy_at_confidence": {
      "0.9-1.0": 0.94,
      "0.8-0.9": 0.82,
      "0.7-0.8": 0.68,
      "0.0-0.7": 0.41
    },
    "last_calibrated": "2026-03-27T00:00:00Z"
  },
  "escalation_targets": ["task-2-generate-code-complex"],
  "input_schema": "data/generation-target.schema.json",
  "output_schema": "data/code-artifact.schema.json"
}
```

### How the Router Uses Manifests

```
1. Task arrives at router
2. Router classifies task → SIMPLE | STANDARD | COMPLEX
3. Router queries manifests: which agents list this task type in capabilities.generalist or capabilities.specialist?
4. Among matching agents, router selects by:
   a. Prefer specialist match over generalist match
   b. Among equal matches, prefer lowest cost_profile.avg_cost_usd
   c. Among equal cost, prefer highest confidence_calibration accuracy
5. Selected agent executes
6. Agent output includes uncertainty envelope (V2 Rule 16)
7. Escalation logic runs (see above)
8. Results logged to audit with workload_id, router_classification_reason (V1 Flyway V2 columns)
```

---

## CAPABILITY: SEMANTIC CACHING LAYER

### The Research Basis

| Study | Finding |
|-------|---------|
| GPTCache (Bang, ACL NLP-OSS 2023) | BERT/Sentence-BERT semantic cache increases response speed 2-10× on cache hits |
| GPT Semantic Cache (Regmi & Pun, 2024, arXiv:2411.05276) | Reduces API calls by up to 68.8% with hit rate >97% |
| Kulkarni & Kulkarni (2026, arXiv:2603.22651) | Field-level caching achieves 34.5% cost reduction with only 0.005 F1 decrease |

### Implementation: New MCP Server

Add to `infrastructure/mcp-servers/`:

```
mcp-servers/
└── semantic-cache-mcp/
    ├── package.json
    ├── src/
    │   ├── index.ts          # MCP server entry
    │   ├── cache-store.ts    # Redis-backed with embedding keys
    │   ├── embedder.ts       # Sentence-BERT embedding for cache keys
    │   └── similarity.ts     # Cosine similarity threshold (configurable)
    └── tests/
        └── cache.test.ts
```

### Cache Logic

```
1. Agent sends request to model via MCP tool
2. MCP tool computes embedding of the request
3. Check Redis for cached response with cosine similarity > THRESHOLD
   - THRESHOLD default: 0.92 (tune based on measured accuracy)
   - Key format: rsf:cache:{agent_id}:{embedding_hash}
   - TTL: 24 hours (configurable per agent in manifest)
4. If cache HIT:
   - Return cached response
   - Log cache hit to audit (for cost tracking)
   - Tag response with "cached": true in uncertainty envelope
5. If cache MISS:
   - Forward to model
   - Store response + embedding in Redis
   - Log cache miss to audit
```

### Key Constraints

- Cache is per-agent — one agent's cached responses are not returned for a different agent
- Cached responses inherit the original uncertainty envelope — they do NOT get a new one
- Cache entries are invalidated when the agent's `instructions.md` changes (prompt change = different expected behavior)
- Cache is disabled for Tier 3 tasks (COMPLEX tasks are by definition novel enough that caching is risky)
- Cache is disabled during adversarial review (Capability 2) — critics must evaluate fresh

### M3 Safety Note

The semantic cache MCP server must respect the kill switch. If kill switch is active, all cache reads return MISS (forces fresh evaluation). Add kill switch check to the cache-store read path, same pattern as other MCP servers.

---

## CAPABILITY: PARETO FRONT TRACKING

### Why This Matters

The Pareto front between cost and accuracy is not static — it shifts as you add agents, change models, or tune routing thresholds. The router should track where each task lands on the Pareto front and detect when the front is contracting (degradation) or expanding (improvement).

### Implementation

Add columns to the `agent_events` table (Flyway V3 migration):

```sql
-- V3__pareto_tracking_columns.sql
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  task_tier SMALLINT;                              -- 1, 2, or 3
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  task_cost_usd FLOAT;                             -- actual cost of this execution
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  task_quality_score FLOAT;                        -- quality gate score (0-1)
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  cache_hit BOOLEAN DEFAULT FALSE;                 -- was this served from cache?
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  escalated_from_tier SMALLINT;                    -- NULL if first attempt, else prior tier

CREATE INDEX IF NOT EXISTS idx_agent_events_pareto
  ON agent_events (task_tier, task_cost_usd, task_quality_score);
```

**IMPORTANT:** Per CLAUDE_V2.md Rule 14, this migration MUST be accompanied by updates to the DATABASE SCHEMA section in CLAUDE.md. Per existing rules, never SELECT * — always name columns explicitly.

### Dashboard Visualization (UI, post-M3)

A scatter plot in the UI showing:
- X axis: cost per task
- Y axis: quality score
- Color: tier (green=1, yellow=2, red=3)
- Shape: cache hit (circle) vs cache miss (triangle)
- Trend line: the current Pareto front

This gives you a live view of whether your routing is improving (front expanding outward) or degrading (front contracting inward).

---

## IMPLEMENTATION SEQUENCE

All items are M3-safe. Recommended build order:

| # | Task | Depends On | Claude Code Prompt Provided |
|---|------|------------|---------------------------|
| 1 | Add anti-deliberation rule to `router-rules.md` | Nothing | Yes (see Section 1) |
| 2 | Create `agent-manifest.json` schema + first manifest | V2 file-tree exists | Yes (see Section 3) |
| 3 | Implement router classification logic | #2 | Yes (see Section 2) |
| 4 | Implement escalation logic | #3 + V2 epistemic tracking | Yes (see Section 2) |
| 5 | Create semantic cache MCP server | V2 MCP wrappers exist | Yes (see Section 4) |
| 6 | Flyway V3 migration for Pareto columns | V2 Flyway V2 exists | Yes (see Section 5) |
| 7 | Wire router into build pipeline | #3, #4 | After M3 complete |
| 8 | Pareto dashboard in UI | #6 | After M3 complete |

Items 1-6 can proceed during M3. Items 7-8 should wait until M3 is verified.

---

## CLAUDE CODE PROMPTS

### Prompt 1: Anti-Deliberation Rule

```
Create the file workflows/build-pipeline/data/router-rules.md with the anti-deliberation
constraint and task classification rules. See ROUTING_CLAUDE.md Section 1 for the exact
content. After creation, verify the file exists and print its contents.
```

### Prompt 2: Agent Manifest Schema

```
Create the file workflows/build-pipeline/data/agent-manifest.schema.json using the schema
defined in ROUTING_CLAUDE.md Section 3. Then create the first manifest at
workflows/build-pipeline/task-2-generate-code/agent-manifest.json using the Code Generator
example from the same section. Validate both against the schema. Print results.
```

### Prompt 3: Router + Escalation Logic

```
Create workflows/build-pipeline/data/escalation-logic.ts with the confidence-based
escalation function from ROUTING_CLAUDE.md Section 2. Write tests first (tests for
PROCEED, ESCALATE, SEEK_INFORMATION, and HALT_FOR_HUMAN paths). Run tsc --noEmit
to verify. Print test results.
```

### Prompt 4: Semantic Cache MCP Server

```
Create the semantic cache MCP server at infrastructure/mcp-servers/semantic-cache-mcp/
following the structure in ROUTING_CLAUDE.md Section 4. The server must: (1) check kill
switch before every cache read, (2) use Redis for storage with configurable TTL,
(3) compute cosine similarity for cache key matching, (4) log all hits/misses to audit.
Write tests first. Verify tsc --noEmit passes. Print summary.
```

### Prompt 5: Pareto Tracking Migration

```
Write and run Flyway migration V3__pareto_tracking_columns.sql as defined in
ROUTING_CLAUDE.md Section 5. After migration, verify all columns exist. Add an index
on (task_tier, task_cost_usd, task_quality_score). Update the DATABASE SCHEMA section
in CLAUDE.md per Rule 14. Print verification.
```

---

## CITED SOURCES (Full References)

| # | Citation | Venue | DOI/ID |
|---|----------|-------|--------|
| 1 | Pappu, El, Cao, di Nolfo, Sun, Cao, Zou. "Multi-Agent Teams Hold Experts Back." 2026. | Preprint (Stanford) | arXiv:2602.01011 |
| 2 | Choi, Zhu, Li. "Debate or Vote: Which Yields Better Decisions in Multi-Agent LLMs?" 2025. | NeurIPS 2025 Spotlight | arXiv:2508.17536 |
| 3 | Wynn, Satija, Hadfield. "Talk Isn't Always Cheap: Understanding Failure Modes in Multi-Agent Debate." 2025. | ICML 2025 | arXiv:2509.05396 |
| 4 | Chen, Zaharia, Zou. "FrugalGPT: How to Use LLMs While Reducing Cost and Improving Performance." 2023/2024. | TMLR 2024 | arXiv:2305.05176 |
| 5 | Ong et al. "RouteLLM: Learning to Route LLMs from Preference Data." 2024. | ICLR 2025 | arXiv:2406.18665 |
| 6 | Aggarwal, Madaan et al. "AutoMix: Automatically Mixing Language Models." 2024. | NeurIPS 2024 | arXiv:2310.12963 |
| 7 | Kulkarni & Kulkarni. "Benchmarking Multi-Agent LLM Architectures for Financial Document Processing." 2026. | Preprint | arXiv:2603.22651 |
| 8 | Chen et al. "Are More LLM Calls All You Need? Scaling Properties of Compound AI Systems." 2024. | NeurIPS 2024 | arXiv:2403.02419 |
| 9 | Shazeer et al. "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer." 2017. | ICLR 2017 | arXiv:1701.06538 |
| 10 | Fedus, Zoph, Shazeer. "Switch Transformers: Scaling to Trillion Parameter Models." 2022. | JMLR 23(120):1-39 | arXiv:2101.03961 |
| 11 | Jiang et al. "Mixtral of Experts." 2024. | Preprint (Mistral AI) | arXiv:2401.04088 |
| 12 | Bang. "GPTCache: An Open-Source Semantic Cache for LLM Applications." 2023. | ACL NLP-OSS Workshop | DOI:10.18653/v1/2023.nlposs-1.24 |
| 13 | Regmi & Pun. "GPT Semantic Cache: Reducing LLM Costs and Latency." 2024. | Preprint | arXiv:2411.05276 |
| 14 | Zhang et al. "AFlow: Automating Agentic Workflow Generation." 2025. | ICLR 2025 Oral | arXiv:2410.10762 |
| 15 | Chen, Saha, Bansal. "ReConcile: Round-Table Conference Improves Reasoning via Consensus." 2024. | ACL 2024 | arXiv:2309.13007 |
| 16 | Wang et al. "Mixture-of-Agents Enhances Large Language Model Capabilities." 2024. | ICML 2024 | arXiv:2406.04692 |
| 17 | Benarroch. "The Central Autonomic Network." 1993. | Mayo Clinic Proc. 68(10) | PMID:8412366 |
| 18 | Jänig. *The Integrative Action of the Autonomic Nervous System.* 2006. | Cambridge Univ. Press | ISBN:9780521845182 |
| 19 | Dougherty. "Central Control of the ANS." 2020. | UTH Neuroscience Online | Ch. 3, Section 4 |
| 20 | Kephart & Chess. "The Vision of Autonomic Computing." 2003. | IEEE Computer 36(1) | DOI:10.1109/MC.2003.1160055 |
| 21 | Wolpert & Macready. "No Free Lunch Theorems for Optimization." 1997. | IEEE Trans. Evol. Comp. 1(1) | DOI:10.1109/4235.585893 |
| 22 | Goldblum, Finzi, Rowan, Wilson. "NFL Theorem, Kolmogorov Complexity, and Inductive Biases." 2024. | ICML 2024, PMLR 235 | arXiv:2304.05366 |
| 23 | Deb et al. "NSGA-II: A Fast and Elitist Multi-Objective Genetic Algorithm." 2002. | IEEE Trans. Evol. Comp. 6(2) | DOI:10.1109/4235.996017 |
| 24 | Kapoor et al. "AI Agents That Matter." 2024/2025. | TMLR 2025 | arXiv:2407.01502 |
| 25 | ACL 2025 Findings. "Empirical Study of Group Conformity in Multi-Agent Systems." 2025. | ACL Findings | aclanthology.org/2025.findings-acl.265 |
| 26 | "Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate." 2025. | Preprint | arXiv:2509.23055 |
| 27 | Yang et al. "AgentNet: Decentralized Evolutionary Coordination." 2025. | NeurIPS 2025 | arXiv:2504.00587 |

---

*ROUTING_CLAUDE.md v1.0.0 — Tiered Agent Routing & Cost-Aware Orchestration*
*Supplement to CLAUDE_V2.md v2.0.0-draft*
*All architectural decisions cite peer-reviewed or institutional preprint research.*
