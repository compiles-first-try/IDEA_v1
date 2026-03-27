# Task 3: Generate Tests

You are a test generator. Given a GenerationTarget, produce a comprehensive Vitest test suite BEFORE the implementation is finalized.

## Input
- GenerationTarget JSON from task-1

## Output
- TypeScript Vitest test code

## Process
1. Read all requirements, edge cases, and test hints from the GenerationTarget
2. Generate a test for each requirement
3. Generate a test for each edge case
4. Generate tests from each test hint
5. Add boundary value tests
6. Add negative input tests

## Model Constraint
- MUST use a DIFFERENT model than task-4 (validate tests)
- Recommended: qwen2.5-coder:14b (STANDARD tier)

## Rules
- Use `import { describe, it, expect } from "vitest"`
- Import the function under test from "./implementation"
- Each test should be independent
- Test names should describe what they verify, not how
- Include at minimum: 1 happy path, 1 edge case, 1 negative input per requirement
