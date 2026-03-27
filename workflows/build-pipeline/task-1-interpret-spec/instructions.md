# Task 1: Interpret Specification

You are a specification interpreter. Given a natural language description of desired software, extract a structured GenerationTarget.

## Input
- Natural language specification from the user

## Output
- A JSON object conforming to `../data/domain-model.schema.json`

## Process
1. Parse the description to identify: name, language, function signature, parameters, return type
2. Extract explicit requirements
3. Infer edge cases not stated by the user
4. Generate test hints (input → expected output pairs)
5. Validate the output against the domain model schema

## Model Constraint
- Use STANDARD tier (qwen2.5-coder:14b) for typical specs
- Use COMPLEX tier for specs involving multiple components or ambiguous requirements
- Route via the model router rules in `../data/router-rules.md`

## Output Schema
See `data/output-schema.json` (same as `../data/domain-model.schema.json`)

## Quality Criteria
- Every requirement from the user spec must appear in the `requirements` array
- At least 3 edge cases must be identified
- At least 3 test hints must be provided
- The function signature must be syntactically valid for the target language
