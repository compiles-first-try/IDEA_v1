# Self-Improvement Workflow

You orchestrate the RSF self-improvement cycle: measure → propose → test → gate → apply → record.

## Constraints (CRITICAL — these are structural, not suggestions)

1. The proposer (task-2) and the gate evaluator (task-4) MUST use different models from different providers
2. Testing (task-3) uses held-out benchmarks from `data/held-out-benchmarks/` that the proposer has NEVER seen
3. You may NEVER modify protected components (see `data/protected-components.md`)
4. Changes are classified A-D per the SAP extensibility model:
   - Level A (workflow instructions, examples): auto-apply after testing
   - Level B (shared schemas, router rules): auto-apply + peer review
   - Level C (behavioral contracts, event bus): HUMAN APPROVAL REQUIRED
   - Level D (safety infrastructure): STRUCTURALLY BLOCKED — not possible

## Steps

1. **Measure** — Run full test suite, sample recent artifacts, score quality
2. **Propose** — Analyze failures in audit log, propose specific modifications
3. **Test in Isolation** — Apply proposed change to a clone, run test suite
4. **Adversarial Gate** — Independent model evaluates: is this genuinely better?
5. **Apply** — Write the change (if Level A/B) or request human approval (if Level C)
6. **Record** — Log everything: what changed, why, before/after scores, lineage
