# Quality Gate Thresholds

An artifact must pass ALL gates to be accepted. Any single gate failure → reject and return to code generation with specific feedback.

## Gate 1: AST Validation
- **Tool:** TypeScript compiler API via sandbox-mcp
- **Threshold:** Zero syntax errors AND zero type errors
- **Failure action:** Send errors to repair agent, retry up to 3 times

## Gate 2: Metamorphic Testing
- **Relations to test:** minimum 5 (selected based on function type)
- **Inputs per relation:** minimum 10
- **Threshold:** Zero violations across all relations
- **Failure action:** Report which relation failed and on which input

## Gate 3: Property-Based Testing (fast-check)
- **Properties derived from:** function signature, requirements, edge cases
- **Runs per property:** 100
- **Threshold:** Zero counterexamples
- **Failure action:** Report counterexample with minimal reproducing input

## Gate 4: Differential Testing
- **Versions compared:** generated code vs reference implementation (if available)
- **Inputs:** 20 test vectors including edge cases
- **Threshold:** Unanimous agreement on all inputs
- **Failure action:** Report divergent inputs and both outputs

## Gate 5: Multi-Model Consensus
- **Evaluators:** minimum 2 (one local, one cloud OR two different local models)
- **Threshold:** All evaluators agree PASS
- **Failure action:** Report which evaluator disagreed and why
