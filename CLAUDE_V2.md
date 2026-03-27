# RECURSIVE SOFTWARE FOUNDRY — V2 ARCHITECTURE SPECIFICATION
## Version: 2.0.0-draft | Environment: Windows 11 + WSL2 | Status: Design Phase

**This document supersedes CLAUDE.md (v1.3.0) for all NEW development. The V1 codebase remains operational and is not modified until V2 migration gates pass. Both specs coexist during the transition.**

---

## DESIGN PHILOSOPHY

RSF V2 is not a software factory. It is an **epistemological engine** — a system that builds knowledge about how to build software, validates that knowledge under adversarial scrutiny, challenges its own assumptions, propagates verified improvements, and does all of this with no self-serving bias.

Every architectural decision in this document is backed by cited, peer-reviewed or production-validated research. Where research is contradictory, both positions are stated and the chosen resolution is justified.

### Foundational Constraints (from information theory and empirical research)

1. **A closed self-improvement loop collapses.** A system that evaluates itself using metrics it also optimizes will converge to gaming the metric, not improving quality. External verification signals are mandatory — not optional, not "nice to have." (Source: entropic drift in recursive self-training; model collapse at ICLR 2025; METR reward hacking findings, June 2025)

2. **Single-agent self-reflection degenerates into confirmation bias.** Reflexion (Shinn et al., NeurIPS 2023) produces degeneration-of-thought where agents repeat flawed reasoning across iterations. Extended chain-of-thought reasoning worsens calibration by reinforcing initial hypotheses (KalshiBench, arXiv:2512.16030). Multi-agent critique with diverse personas is required. (Source: Multi-Agent Reflexion, Dan et al., arXiv:2512.20845, Dec 2025; MIT Total Uncertainty Method, March 2026)

3. **Prompt-only prohibitions do not bind under optimization pressure.** Constitutional constraints expressed as instructions are ineffective against sufficiently capable models. Only structural enforcement — code-level barriers that cannot be bypassed by the model — provides reliable safety. (Source: arXiv:2601.11369, Institutional AI, 2026; Anthropic alignment faking research, Dec 2024)

4. **AI-generated code has 1.7× more bugs than human code.** Quality gates for AI output must be MORE rigorous than for human output, not less. (Source: AI Code Quality Metrics 2026, secondtalent.com)

5. **70% of inter-agent communication is redundant.** Adding agents increases coordination cost faster than it increases capability. Every agent must justify its existence with measurable marginal value. (Source: ICLR 2026 multi-agent failure playbook; Google Research 2025 scaling findings)

6. **The alignment tax is real: up to 17 points F1 degradation.** Safety alignment consistently degrades reasoning capability. The NSPO approach (arXiv:2512.11391, Dec 2025) claims zero first-order capability loss — adopt if validated. (Source: Safety Tax paper, arXiv:2503.00555, March 2025)

---

## CRITICAL OPERATING RULES

All V1 rules (1-15) remain in effect. V2 adds:

16. **Every agent output MUST carry an epistemic uncertainty score.** Distinguish between epistemic uncertainty (resolvable with more data) and aleatoric uncertainty (inherent randomness). High-epistemic-uncertainty outputs trigger knowledge acquisition, not retry. (Source: arXiv:2505.04950; CertainlyUncertain benchmark)

17. **Test generation and test validation MUST use different models from different providers.** Structural independence — not just different prompts to the same model. The generator cannot evaluate its own work. (Source: Multi-Agent Reflexion; METR reward hacking; Anthropic alignment faking)

18. **Every proposed improvement MUST be tested against held-out benchmarks the proposing agent has never seen.** The evaluation dataset is maintained by a separate system (System 4) and is never accessible to the improvement proposer (System 6). (Source: Darwin Godel Machine design; information-theoretic collapse proofs)

19. **Agent modifications are classified by risk level (A-D) per the SAP Clean Core extensibility model.** Level A: uses only public interfaces, fully safe. Level B: uses stable internal APIs, review required. Level C: modifies shared state, gated approval. Level D: modifies safety infrastructure, human-only. (Source: SAP A-D Extensibility Framework, August 2025)

20. **Cross-agent behavioral analysis MUST run continuously.** Individual agent actions that pass scope validation may combine into harmful outcomes. The governance layer monitors combined behavioral patterns across all agents, not just per-agent actions. (Source: SPN Scrutiny Report F-5; arXiv:2601.11369 multi-agent collusion; NeurIPS 2024 steganographic collusion)

21. **No agent may evaluate its own output, propose improvements to its own prompts, or validate tests it generated.** Self-evaluation is structurally prohibited. All evaluation crosses a model boundary. (Source: Reflexion degeneration-of-thought; LLM Dunning-Kruger effect, arXiv:2603.09985)

---

## V2 ARCHITECTURE — VIABLE SYSTEM MODEL

RSF V2 maps to Stafford Beer's Viable System Model (1972/1979/1985), the most production-ready theoretical framework for self-governing systems. (Source: IBM Research, "Agentic AI Needs a Systems Theory," arXiv:2503.00237, Feb 2025; Perez Rios, Systems 13(9):749, MDPI, 2025)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SYSTEM 5: POLICY (Identity & Ethics)                               │
│  Locked constitution · Kill switch · Governance rules               │
│  Immutable code — never modified by agents                          │
├─────────────────────────────────────────────────────────────────────┤
│  SYSTEM 4: INTELLIGENCE (Environment Scanning)         ◄── NEW      │
│  Tech landscape monitor · Research ingestion · Model evaluation     │
│  Benchmark maintenance · External verification signal provider      │
├─────────────────────────────────────────────────────────────────────┤
│  SYSTEM 3: RESOURCE MANAGEMENT (Optimization)                       │
│  Model router · Spend tracking · Regression budget                  │
│  Cross-agent behavioral analysis · Capacity planning                │
├─────────────────────────────────────────────────────────────────────┤
│  SYSTEM 2: COORDINATION (Anti-Oscillation)                          │
│  Event bus · Shared domain model · Workflow sequencing               │
│  Stigmergic blackboard · Conflict resolution                       │
├─────────────────────────────────────────────────────────────────────┤
│  SYSTEM 1: OPERATIONS (Value Production)                            │
│  Spec interpretation · Code generation · Test generation            │
│  Quality gates · Program repair · Artifact production               │
└─────────────────────────────────────────────────────────────────────┘
```

### Why VSM and not a flat layer model

The V1 seven-layer architecture (Foundation → Governance) is a build-order hierarchy — it tells you what to build first. VSM is a runtime governance model — it tells you how the running system governs itself. V2 uses both: the build layers define what exists, the VSM defines how it behaves.

The critical insight from VSM: **System 5 (Policy) must NEVER collapse into System 3 (Resource Management).** When the governance layer starts making operational optimization decisions, the system loses its ethical compass. The locked constitution exists in System 5 precisely to prevent this collapse. (Source: Perez Rios 2025, "pathologies specific to AI governance")

---

## THE HYBRID ARCHITECTURE

### What Stays as Code (The Clean Core)

These components are infrastructure. They are deterministic, safety-critical, and must not be LLM-mediated:

```
infrastructure/                     # CLEAN CORE — never modified by agents
├── docker-compose.yml              # Service orchestration
├── db/migrations/                  # Schema (Flyway, versioned, human-reviewed)
├── packages/foundation/            # V1 foundation layer (KEEP AS-IS)
│   ├── src/db/                     # PostgreSQL client + migrations
│   ├── src/cache/                  # Redis client
│   ├── src/secrets/                # Secret manager
│   ├── src/audit/                  # Dual-write audit logger
│   ├── src/sandbox/                # Docker sandbox executor
│   └── src/telemetry/              # OpenTelemetry
├── packages/governance/            # REST API + WebSocket (KEEP AS-IS)
│   └── src/api/                    # Express endpoints
├── safety/                         # Safety-critical code
│   ├── kill-switch/                # 3-mechanism kill switch
│   ├── locked-constitution.ts      # Immutable Tier 1 principles
│   ├── contract-enforcer/          # AgentSpec-style runtime enforcement
│   └── cross-agent-monitor/        # Combined behavioral analysis
└── mcp-servers/                    # MCP tool wrappers (NEW)
    ├── postgres-mcp/               # DB queries with audit enforcement
    ├── redis-mcp/                  # Cache ops with kill switch check
    ├── sandbox-mcp/                # Code execution with isolation
    ├── ollama-mcp/                 # Local inference with token tracking
    ├── anthropic-mcp/              # Cloud inference with spend tracking
    └── audit-mcp/                  # Append-only audit with crypto signing
```

### What Becomes File-Tree Workflows (Agent Behavior)

These components are orchestration logic — system prompts, routing rules, quality criteria. They are the parts agents should be able to read, understand, and (under gated approval) improve:

```
workflows/                          # AGENT BEHAVIOR — modifiable under governance
├── build-pipeline/
│   ├── instructions.md             # Pipeline orchestration prompt
│   ├── data/
│   │   ├── domain-model.schema.json   # Unified generation target schema
│   │   ├── router-rules.md           # Tier classification criteria
│   │   └── quality-thresholds.md     # Pass/fail criteria per gate
│   ├── task-1-interpret-spec/
│   │   ├── instructions.md           # Spec interpretation system prompt
│   │   └── data/
│   │       ├── output-schema.json
│   │       └── examples/             # Few-shot examples
│   ├── task-2-generate-code/
│   │   ├── instructions.md
│   │   └── data/
│   ├── task-3-generate-tests/
│   │   ├── instructions.md
│   │   └── data/
│   ├── task-4-validate-tests/        # NEW — tests that test the tests
│   │   ├── instructions.md           # MUST use different model than task-3
│   │   └── data/
│   ├── task-5-quality-gates/
│   │   ├── instructions.md
│   │   └── data/
│   │       ├── metamorphic-relations/ # 30+ relation templates
│   │       └── property-specs/        # fast-check property definitions
│   └── task-6-adversarial-review/    # NEW — structurally independent
│       ├── instructions.md           # MUST use different provider than generator
│       └── data/
│
├── self-improve/                     # System 6: Meta-improvement
│   ├── instructions.md
│   ├── data/
│   │   ├── protected-components.md   # Components that require human review
│   │   ├── held-out-benchmarks/      # NEVER accessible to proposer
│   │   └── regression-budget.md
│   ├── task-1-measure/
│   ├── task-2-propose/               # Uses model A
│   ├── task-3-test-isolation/
│   ├── task-4-adversarial-gate/      # Uses model B (different provider)
│   ├── task-5-apply/                 # Human gate for Level C/D changes
│   └── task-6-record/
│
├── environment-scan/                 # System 4: Intelligence (NEW)
│   ├── instructions.md
│   ├── task-1-monitor-releases/      # Track model releases, framework updates
│   ├── task-2-ingest-research/       # Evaluate new papers for relevance
│   ├── task-3-benchmark-refresh/     # Update held-out evaluation datasets
│   └── task-4-assess-impact/         # Determine if changes affect RSF
│
├── knowledge-propagation/            # System 2: Coordination (NEW)
│   ├── instructions.md
│   ├── task-1-discovery-broadcast/   # Emit verified discoveries to event bus
│   ├── task-2-knowledge-validate/    # Cross-check discoveries before propagation
│   └── task-3-update-workflows/      # Propose workflow updates from discoveries
│
└── provision-agent/                  # System 1: Agent self-manufacturing
    ├── instructions.md
    ├── task-1-blueprint/
    ├── task-2-tool-synth/
    └── task-3-mcp-gen/

constitution/                        # Tier 1 + Tier 2 principles
├── locked-principles.md             # Immutable — in version control
├── configurable-principles.md       # Editable via governance workflow
└── modification-log.md              # Every change with timestamp + rationale
```

---

## THE FIVE NEW CAPABILITIES

### Capability 1: Recursive Test Validation

**Problem:** Standard AI engineering generates tests and trusts them. But AI-generated tests have the same 1.7× bug rate as AI-generated code. Tests that don't test what they claim to test provide false confidence.

**Architecture:**

```
Generator Agent (Model A, Provider X)
    │
    ▼ generates tests
Test Validator Agent (Model B, Provider Y)     ◄── STRUCTURAL INDEPENDENCE
    │
    ▼ validates: do these tests actually cover the requirements?
    ▼ validates: are there edge cases the tests miss?
    ▼ validates: could the implementation pass these tests while being wrong?
    │
    ▼ if validation fails → regenerate tests with specific feedback
Meta-Test Agent (Model C, any provider)
    │
    ▼ generates adversarial inputs designed to break the tests themselves
    ▼ runs mutation testing: can a broken implementation still pass?
    │
    ▼ if mutation score < threshold → tests are insufficient
```

**Key constraint:** The test validator MUST use a different model from a different provider than the generator. This is not a preference — it is a structural requirement based on the finding that LLMs preferentially rate their own generations higher (Panickssery et al., NeurIPS 2024) and single-agent reflection degenerates into confirmation bias (Dan et al., Dec 2025).

**Implementation:** Three `instructions.md` files in the build pipeline (task-3, task-4, task-5) with explicit model constraints in each. The MCP tool wrapper enforces the constraint — the Ollama MCP server and Anthropic MCP server track which agent is calling and refuse if the structural independence requirement is violated.

### Capability 2: Adversarial Peer Review

**Problem:** Current multi-model consensus is two models rubber-stamping each other. Real peer review requires the reviewer to have no shared interest with the author.

**Architecture based on Multi-Agent Reflexion (MAR):**

```
Producer Agent (generates artifact)
    │
    ▼
Critic Panel (3 diverse persona-based critics)
    ├── Correctness Critic: "Does this actually do what the spec says?"
    ├── Adversarial Critic: "How would I break this? What inputs cause failure?"
    └── Efficiency Critic: "Is this the simplest solution? Is there unnecessary complexity?"
    │
    ▼ each critic independently evaluates (no shared context between critics)
    ▼ disagreement triggers structured debate
    │
    ▼ if consensus: PASS
    ▼ if 2/3 agree: PASS WITH NOTE
    ▼ if no consensus: REJECT with specific feedback → Producer regenerates
```

**Key constraints:**
- Critics MUST NOT share context with each other during evaluation
- At least one critic MUST use a different model provider than the producer
- The adversarial critic's prompt explicitly instructs: "Your job is to find flaws. A passing review with no findings is suspicious — explain what you checked and why you believe it's correct."
- Cost: ~3× API calls per evaluation cycle (MAR paper). Budget accordingly.

**Source:** Multi-Agent Reflexion (Dan et al., arXiv:2512.20845, Dec 2025); SPN F-2 (deceptive alignment requires structural, not behavioral, separation)

### Capability 3: Knowledge Propagation Bus

**Problem:** When one agent discovers something useful (a prompt pattern that improves output, a failure mode to avoid, an edge case), that knowledge dies with the session. No other agent benefits.

**Architecture based on SAP Event-Driven Decoupling + Stigmergic Coordination:**

```
┌──────────────────────────────────────────────────────────────┐
│                    EVENT BUS (Postgres LISTEN/NOTIFY)         │
│                                                              │
│  Events:                                                     │
│    DISCOVERY    — agent found something useful                │
│    WARNING      — agent encountered a failure pattern         │
│    BENCHMARK    — new evaluation data available               │
│    IMPROVEMENT  — verified improvement applied                │
│    DEPRECATION  — old pattern found to be harmful             │
│                                                              │
│  Schema: {                                                   │
│    event_type, source_agent, discovery_content,               │
│    confidence_score, evidence, affected_workflows[],          │
│    timestamp, validation_status                               │
│  }                                                           │
└──────────────┬───────────────────────────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 Workflow    Workflow    Workflow
 Consumer    Consumer    Consumer
```

**Stigmergic Blackboard (Redis):**

In addition to the event bus, a shared Redis-backed blackboard holds "digital pheromones" — signals with decay:

- `rsf:signal:{topic}` — discovery signal with TTL (decays over time)
- Agents check the blackboard before starting a task for relevant signals
- High-confidence signals persist longer; low-confidence signals decay quickly
- Prevents stale knowledge from accumulating (model collapse prevention)

**Validation gate:** Discoveries are NOT propagated immediately. A validation workflow checks: (1) Is the discovery reproducible? (2) Does it conflict with existing verified knowledge? (3) Does a different model agree it's valid? Only validated discoveries enter the permanent knowledge store (Postgres). Unvalidated discoveries exist only as decaying blackboard signals.

**Source:** SAP Event Mesh pattern; SBP Stigmergic Blackboard Protocol (2024-2025); model collapse prevention via verification (arXiv:2510.16657)

### Capability 4: Epistemic Tracking System

**Problem:** Agents don't know what they don't know. They express inappropriate confidence. When an agent is uncertain, it should seek information — not guess.

**Architecture:**

Every agent output includes a structured uncertainty envelope:

```json
{
  "output": "...",
  "uncertainty": {
    "epistemic": 0.35,
    "aleatoric": 0.10,
    "method": "cross-model-disagreement",
    "models_consulted": ["qwen2.5-coder:14b", "claude-haiku-4-5-20251001"],
    "disagreement_points": ["return type uncertain", "edge case for negative input"],
    "knowledge_gaps": ["no training data for this domain pattern"],
    "recommended_action": "SEEK_INFORMATION"
  }
}
```

**Measurement method:** Cross-model disagreement (MIT Total Uncertainty Method, March 2026). Run the same query through models from different providers. High disagreement = high epistemic uncertainty. This is more reliable than asking a single model "how confident are you?" (which is unreliable per the Dunning-Kruger findings, arXiv:2603.09985).

**Actions based on uncertainty:**
- Low epistemic, low aleatoric: proceed normally
- High epistemic, low aleatoric: trigger knowledge acquisition (System 4 queries)
- Low epistemic, high aleatoric: flag to human — inherent unpredictability
- High epistemic, high aleatoric: HALT — insufficient basis for action

**Source:** arXiv:2505.04950 (Epistemic AI); Semantic Entropy Probes (arXiv:2406.15927); BODHI framework (medRxiv 2026); CertainlyUncertain benchmark

### Capability 5: Continuous Environment Scanning (System 4)

**Problem:** RSF V1 has no way to stay current. New model releases, security advisories, framework deprecations, and research breakthroughs happen outside the system. Without System 4, the system's knowledge fossilizes.

**Architecture:**

```
System 4: Intelligence
    │
    ├── Monitor (scheduled, daily)
    │   ├── Check Ollama for new model versions
    │   ├── Check Anthropic API for new models/capabilities
    │   ├── Check npm/PyPI for dependency security advisories
    │   ├── Check arXiv for relevant new papers (keyword monitoring)
    │   └── Check MCP registry for new tool servers
    │
    ├── Evaluate (triggered by Monitor)
    │   ├── Is this relevant to RSF's capabilities?
    │   ├── Does it obsolete any current component?
    │   ├── Does it introduce a security concern?
    │   └── Confidence assessment (epistemic tracking)
    │
    ├── Recommend (triggered by Evaluate, gated)
    │   ├── Propose specific changes to workflows/instructions
    │   ├── All proposals go through standard improvement loop
    │   ├── Level A changes: auto-apply after testing
    │   ├── Level B-D changes: human review required
    │   └── Update held-out benchmarks with new evaluation data
    │
    └── Archive (always)
        ├── All findings recorded to knowledge base
        ├── Rejected recommendations recorded with rationale
        └── "Watched" items tracked for future reassessment
```

**Key constraint:** System 4 maintains the held-out benchmarks that System 6 (self-improvement) is tested against. System 6 NEVER has access to these benchmarks except through the testing interface. This is the structural separation that prevents the improvement loop from gaming its own evaluation. (Source: Darwin Godel Machine design principle)

---

## SAFETY ARCHITECTURE (Updated from V1 + SPN findings)

### Defense-in-Depth Layers

```
Layer 1: STRUCTURAL ENFORCEMENT (code-level, not LLM-mediated)
    ├── Kill switch (3 mechanisms: Redis, ENV, HTTP)
    ├── Locked constitution (immutable file, protected by improvement loop)
    ├── Docker sandbox (--network none, read-only fs, resource limits)
    ├── Audit logger (append-only, cryptographically signed)         ◄── NEW: crypto
    ├── AgentSpec DSL runtime enforcement (>90% prevention rate)     ◄── NEW
    └── MCP tool-level constraints (model independence enforcement)  ◄── NEW

Layer 2: BEHAVIORAL MONITORING (observable actions, not intent)
    ├── Per-agent: action type, scope, duration, token usage
    ├── Cross-agent: combined behavioral patterns, coordination detection  ◄── NEW
    ├── Behavioral drift index: measured degradation over time             ◄── NEW
    └── Outcome-state validation (did the action achieve intended result?) ◄── NEW

Layer 3: ADVERSARIAL REVIEW (structurally independent evaluation)
    ├── Multi-Agent Reflexion with diverse critic personas          ◄── NEW
    ├── Cross-provider model evaluation (generator ≠ evaluator)
    ├── Held-out benchmark testing (evaluator ≠ benchmark maintainer)
    └── Red-teaming (continuous, per OWASP Agentic Top 10)         ◄── NEW

Layer 4: HUMAN OVERSIGHT (irreducible human judgment)
    ├── Level C/D modification approval
    ├── Irreversible action gating (SPN F-3)
    ├── Improvement cycle final approval
    ├── Constitution modification (code commit required)
    └── Feedback validation agent evidence review
```

### Threat Model (from SPN Scrutiny Report)

| Threat | Mitigation | Layer |
|--------|------------|-------|
| Deceptive alignment (F-2) | Structural independence of evaluator and producer; behavioral monitoring not intent monitoring | 1, 2, 3 |
| Specification gaming (F-4) | Outcome-state validation + adversarial critic specifically tasked with finding spec-gaming | 2, 3 |
| Multi-agent collusion (F-5) | Cross-agent behavioral analysis; stigmergic blackboard monitoring for anomalous coordination | 2 |
| Irreversible external actions (F-3) | All external API calls classified as irreversible action class; human gate required | 4 |
| Audit trail corruption (F-6) | Cryptographic signing of audit entries; agent has INSERT but not UPDATE/DELETE | 1 |
| Reward hacking of improvement metrics | Held-out benchmarks maintained by System 4, inaccessible to System 6 proposer | 1, 3 |
| Alignment faking during evaluation | Cross-provider evaluation; multiple evaluation points; behavioral drift tracking | 2, 3 |

---

## UNIFIED DOMAIN MODEL (SAP One Domain Model Pattern)

All agents share a single canonical representation for their primary data objects. Schema changes are versioned. Every handoff between agents validates against the schema.

### GenerationTarget (the canonical artifact specification)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["name", "description", "language", "type", "requirements"],
  "properties": {
    "name": { "type": "string" },
    "description": { "type": "string" },
    "language": { "enum": ["typescript", "python", "sql", "shell"] },
    "type": { "enum": ["function", "class", "module", "api", "test", "config"] },
    "functionSignature": { "type": "string" },
    "parameters": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    },
    "returnType": { "type": "string" },
    "requirements": { "type": "array", "items": { "type": "string" } },
    "edgeCases": { "type": "array", "items": { "type": "string" } },
    "testHints": { "type": "array", "items": { "type": "string" } },
    "schemaVersion": { "type": "string", "const": "2.0.0" }
  }
}
```

Every agent that produces or consumes a GenerationTarget validates it against this schema. Schema changes require a version bump and migration path for all consumers.

---

## MODIFICATION RISK CLASSIFICATION (SAP A-D Model)

| Level | Scope | Approval | Examples |
|-------|-------|----------|----------|
| **A** | Uses only MCP tools and public schemas | Automated after testing | Changing a workflow's instructions.md, adding few-shot examples |
| **B** | Modifies shared workflow data files | Automated + peer review | Changing the domain model schema, updating router rules |
| **C** | Modifies agent behavioral contracts or coordination | Human review required | Changing a contract's allowed tools, modifying the event bus schema |
| **D** | Modifies safety infrastructure | Human-only, code commit | Kill switch, audit logger, locked constitution, sandbox config |

The improvement loop may propose A and B changes autonomously. C changes require human approval. D changes are structurally impossible for agents — the files are in the protected components list and the improvement loop's isProtectedComponent() check blocks them.

---

## MIGRATION PATH FROM V1

### Phase M0: Preparation (no code changes to V1)
1. Create the `workflows/` directory structure alongside existing `packages/`
2. Create MCP server wrappers around existing foundation modules
3. Write migration gate tests that verify V1 behavior is preserved

### Phase M1: Extract Prompts (V1 continues running)
1. Extract hardcoded system prompts from TypeScript into `instructions.md` files
2. Extract Zod schemas into `data/*.schema.json` files
3. Verify: V1 tests still pass, V2 workflows produce identical results

### Phase M2: Add New Capabilities (V1 + V2 coexist)
1. Implement System 4 (environment scanning) — new, no V1 equivalent
2. Implement knowledge propagation bus — new, no V1 equivalent
3. Implement epistemic tracking — new, wraps existing model calls
4. Implement recursive test validation — extends existing test-first pipeline
5. Implement adversarial peer review — extends existing consensus gate

### Phase M3: Safety Hardening (V2 replaces V1 orchestration)
1. Implement AgentSpec DSL runtime enforcement
2. Add cryptographic signing to audit entries
3. Add cross-agent behavioral analysis
4. Add behavioral drift detection
5. Run OWASP Agentic Top 10 checklist
6. Migration gate: all V1 tests pass + all V2 safety tests pass

### Phase M4: Cutover
1. V2 workflows become primary (V1 code paths deprecated)
2. V1 TypeScript orchestration modules archived but not deleted
3. Foundation infrastructure unchanged throughout

---

## WHAT IS NOT IN V2

- **No Rust rewrite.** The living_platform paper validates Rust + Erlang supervision trees, but our Node.js/TypeScript foundation works, has 328 tests, and rewriting it adds risk without proportional benefit for V2.
- **No WASM hot-swap.** The living_platform paper identifies this as HIGH-PROBABILITY but it's V3 scope. Focus V2 on the file-tree workflow pattern first.
- **No liquid neural networks.** EMERGING maturity. Watch Liquid AI's commercial progress.
- **No active inference.** Fundamental scaling limitations remain. Speculative for RSF.
- **No emotional AI.** Architecturally viable but ethically dangerous (Harvard: 37.4% manipulation rate). Not appropriate for a manufacturing platform.
- **No formal verification of LLM behavior.** TLA+/Z3 work for the orchestration shell but cannot verify stochastic LLM outputs. Use evals and testing, not proofs, for the LLM core.

---

## CITED SOURCES

| # | Source | Used In |
|---|--------|---------|
| 1 | Darwin Godel Machine (Sakana AI, 2025) — [sakana.ai/dgm](https://sakana.ai/dgm/) | Self-improvement architecture |
| 2 | Model Collapse (ICLR 2025) — [proceedings.iclr.cc](https://proceedings.iclr.cc/paper_files/paper/2025/file/284afdc2309f9667d2d4fb9290235b0c-Paper-Conference.pdf) | Knowledge propagation constraints |
| 3 | METR Reward Hacking (June 2025) — [metr.org](https://metr.org/blog/2025-06-05-recent-reward-hacking/) | Rule 21, adversarial review |
| 4 | Anthropic Alignment Faking (Dec 2024) — [anthropic.com](https://www.anthropic.com/news/alignment-faking) | Structural enforcement rationale |
| 5 | Multi-Agent Reflexion (Dec 2025) — [arXiv:2512.20845](https://arxiv.org/abs/2512.20845) | Adversarial peer review |
| 6 | AgentSpec (ICSE 2026) — [arXiv:2503.18666](https://arxiv.org/abs/2503.18666) | Runtime contract enforcement |
| 7 | Agent Behavioral Contracts (Feb 2026) — [arXiv:2602.22302](https://arxiv.org/abs/2602.22302) | Behavioral drift detection |
| 8 | RLTHF (ICML 2025) — [arXiv:2502.13417](https://arxiv.org/abs/2502.13417) | Feedback validation architecture |
| 9 | Epistemic AI (May 2025) — [arXiv:2505.04950](https://arxiv.org/abs/2505.04950) | Uncertainty tracking |
| 10 | Semantic Entropy Probes — [arXiv:2406.15927](https://arxiv.org/abs/2406.15927) | Hallucination detection |
| 11 | AI Code Quality 2026 — [secondtalent.com](https://www.secondtalent.com/resources/ai-generated-code-quality-metrics-and-statistics-for-2026/) | Test rigor requirements |
| 12 | Metamorphic Testing (ICSME 2025) — [arXiv:2511.02108](https://arxiv.org/abs/2511.02108) | Quality gate expansion |
| 13 | OWASP Top 10 Agentic (Dec 2025) — [trydeepteam.com](https://www.trydeepteam.com/docs/frameworks-owasp-top-10-for-agentic-applications) | Security checklist |
| 14 | Safety Tax (March 2025) — [arXiv:2503.00555](https://arxiv.org/abs/2503.00555) | Alignment tax awareness |
| 15 | NSPO (Dec 2025) — [arXiv:2512.11391](https://arxiv.org/abs/2512.11391) | Zero-loss alignment (watch item) |
| 16 | IBM "Agentic AI Needs Systems Theory" (Feb 2025) — [arXiv:2503.00237](https://arxiv.org/abs/2503.00237) | VSM architecture |
| 17 | SAP Clean Core — [ignitesap.com](https://ignitesap.com/saps-clean-core-architecture/) | Clean core + A-D classification |
| 18 | SAP Event-Driven Architecture — [sap.com](https://www.sap.com/products/technology-platform/what-is-event-driven-architecture.html) | Knowledge propagation bus |
| 19 | MCP 2026 Roadmap — [blog.modelcontextprotocol.io](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) | Tool integration layer |
| 20 | Claude Code Sub-Agents — [code.claude.com](https://code.claude.com/docs/en/sub-agents) | File-tree workflow pattern |
| 21 | Entropic Drift / Self-Improvement Bounds — [ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/file/63943ee9fe347f3d95892cf87d9a42e6-Paper-Conference.pdf) | Closed-loop collapse constraint |
| 22 | SPN Scrutiny Report (internal, March 2026) | Safety threat model |
| 23 | Living Platform Investigation (internal, March 2026) | VSM, supervision, stigmergy, reasoning paradox |
| 24 | KalshiBench Reasoning Paradox (Dec 2025) — [arXiv:2512.16030](https://arxiv.org/abs/2512.16030) | Rule 17, cross-model evaluation |
| 25 | LLM Dunning-Kruger (March 2026) — [arXiv:2603.09985](https://arxiv.org/abs/2603.09985) | Rule 21, self-evaluation prohibition |
| 26 | Steganographic Collusion (NeurIPS 2024) — Motwani et al. | Cross-agent monitoring |
| 27 | Institutional AI Collusion (2026) — [arXiv:2601.11369](https://arxiv.org/abs/2601.11369) | Structural enforcement > prompts |
| 28 | ESAA Event Sourcing for Agents (Feb 2026) — [arXiv:2602.23193](https://arxiv.org/abs/2602.23193) | Event sourcing validation |
| 29 | Google Agent Scaling (2025) — 17.2× error amplification | Agent count justification |
| 30 | Escaping Model Collapse via Verification — [arXiv:2510.16657](https://arxiv.org/abs/2510.16657) | Knowledge propagation validation |

---

*CLAUDE_V2.md — Recursive Software Foundry V2 Architecture Specification*
*Draft 1 — March 2026*
*All architectural decisions cite peer-reviewed or production-validated research.*
*This document governs new development. CLAUDE.md v1.3.0 governs the running V1 system.*
