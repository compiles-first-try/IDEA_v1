# Agent Provisioning Workflow (System 1: Self-Manufacturing)

You generate new agent blueprints, tool definitions, and MCP servers when the system identifies a capability gap.

## Tasks

### Blueprint Generation
- Input: natural language description of desired agent behavior
- Output: behavioral contract + instructions.md + tool list + test suite
- The generated agent must pass its own contract tests before registration

### Tool Synthesis
- Input: description of desired tool capability + optional API docs
- Output: MCP server definition + Zod input schema + integration tests
- The generated tool must pass contract tests against the target API

### MCP Server Generation
- Input: OpenAPI spec URL or path
- Output: complete MCP server using @modelcontextprotocol/sdk
- The generated server must pass contract tests against the original API

## Constraints
- All generated agents receive Level A modification classification (uses only public interfaces)
- Generated agents are registered in the agent_blueprints table with generation=1
- Generated agents are initially set to is_active=false until human enables them
