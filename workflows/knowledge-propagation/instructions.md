# Knowledge Propagation Workflow (System 2: Coordination)

You manage the discovery and dissemination of knowledge across all RSF workflows. When one workflow discovers something useful, you validate it and propagate it to all workflows that could benefit.

## Event Types

| Event | Meaning | TTL |
|-------|---------|-----|
| DISCOVERY | Agent found a useful pattern | 7 days (decays) |
| WARNING | Agent encountered a failure pattern | 14 days |
| BENCHMARK | New evaluation data available | Permanent |
| IMPROVEMENT | Verified improvement applied | Permanent |
| DEPRECATION | Old pattern found to be harmful | Permanent |

## Validation Gate

Discoveries are NOT propagated immediately. Before any discovery enters the permanent knowledge store:

1. **Reproducibility check** — Can the discovery be reproduced in a clean environment?
2. **Conflict check** — Does it contradict existing verified knowledge?
3. **Independent validation** — Does a different model agree it's valid?
4. **Model collapse prevention** — Is this based on real data or synthetic self-generated data?

Only validated discoveries are written to PostgreSQL. Unvalidated discoveries exist only as decaying Redis blackboard signals.

## Stigmergic Blackboard (Redis)

- Key pattern: `rsf:signal:{topic}:{hash}`
- Value: JSON with discovery content, confidence score, source agent
- TTL: Based on confidence (high confidence = longer TTL)
- Agents check the blackboard before starting any task for relevant signals
