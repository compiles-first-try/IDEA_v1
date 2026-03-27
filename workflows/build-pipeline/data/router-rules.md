# Model Router Classification Rules

Classify every task before dispatching to an LLM. Never bypass the router.

## Tiers

| Tier | Model | Provider | Max Tokens | Cost |
|------|-------|----------|------------|------|
| TRIVIAL | llama3.3:8b | ollama (local) | 512 | $0.00 |
| STANDARD | qwen2.5-coder:14b | ollama (local) | 2048 | $0.00 |
| COMPLEX | claude-haiku-4-5-20251001 | anthropic (cloud) | 8192 | ~$0.001/call |
| CRITICAL | claude-sonnet-4-6-20250514 | anthropic (cloud) | 32768 | ~$0.015/call |

## Classification Heuristics

**CRITICAL** — architecture decisions, self-improvement proposals, security review, formal spec generation, agent blueprint design, anything touching foundry infrastructure
- Keywords: architect, self-improvement, security review, formal spec, agent blueprint, foundry infrastructure

**COMPLEX** — multi-file code generation, debugging, integration logic, REST API generation, refactoring
- Keywords: multi-file, integration, debug, REST API, authentication, refactor

**STANDARD** — single-function code generation, test writing, documentation, simple implementation
- Keywords: function, write, implement, single, sort, parse, convert, calculate

**TRIVIAL** — formatting, JSON extraction, classification, routing decisions
- Default tier if no other pattern matches

## Spend Guardrails

- Daily cloud spend tracked in Redis key `rsf:daily-spend`
- If daily spend exceeds `MAX_DAILY_CLOUD_SPEND_USD` ($10 default): escalate COMPLEX to CRITICAL-only mode
- If daily spend exceeds `PAUSE_THRESHOLD_USD` ($20 default): pause all cloud calls, local only
- Local models (TRIVIAL, STANDARD) have no spend limit
