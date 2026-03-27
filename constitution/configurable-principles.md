# Configurable Principles — Tier 2

These principles are editable by the human operator. Changes are written to the audit log with timestamp, old value, new value.

## Default Principles

1. Prefer TypeScript over JavaScript for all generated code.
2. Maximum file size for generated artifacts: 500 lines.
3. Generated code must include JSDoc comments on all exported functions.

## Modification Rules

- Edit via the governance API: `PATCH /governance/config`
- Each modification is logged to the audit trail
- The self-improvement loop may propose changes to these principles (Level B modification — requires peer review)
- Principles can be added, edited, or deleted
- "Reset to defaults" restores the three principles above
