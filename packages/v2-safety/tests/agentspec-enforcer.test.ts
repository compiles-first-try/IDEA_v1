/**
 * AgentSpec DSL Runtime Enforcement
 *
 * Lightweight rule-based DSL for specifying and enforcing runtime constraints
 * on agent behavior. Inspired by AgentSpec (ICSE 2026, >90% prevention rate).
 */
import { describe, it, expect } from "vitest";

describe("AgentSpec Runtime Enforcer", () => {
  let enforcer: typeof import("../src/agentspec-enforcer/index.js");

  it("should load module", async () => {
    enforcer = await import("../src/agentspec-enforcer/index.js");
    expect(enforcer).toBeDefined();
  });

  it("should define a rule with trigger, predicate, and action", () => {
    const rule = enforcer.defineRule({
      name: "no-network-access",
      trigger: "TOOL_CALL",
      predicate: (ctx: { toolName: string }) => ctx.toolName === "fetch",
      action: "BLOCK",
      message: "Network access is prohibited in sandbox mode",
    });
    expect(rule.name).toBe("no-network-access");
    expect(rule.action).toBe("BLOCK");
  });

  it("should enforce a blocking rule", () => {
    const rules = [
      enforcer.defineRule({
        name: "no-delete",
        trigger: "TOOL_CALL",
        predicate: (ctx: { toolName: string }) => ctx.toolName === "delete-file",
        action: "BLOCK",
        message: "File deletion requires human approval",
      }),
    ];
    const result = enforcer.enforce(rules, { trigger: "TOOL_CALL", toolName: "delete-file" });
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toBe("no-delete");
  });

  it("should allow actions that match no blocking rules", () => {
    const rules = [
      enforcer.defineRule({
        name: "no-delete",
        trigger: "TOOL_CALL",
        predicate: (ctx: { toolName: string }) => ctx.toolName === "delete-file",
        action: "BLOCK",
        message: "Blocked",
      }),
    ];
    const result = enforcer.enforce(rules, { trigger: "TOOL_CALL", toolName: "read-file" });
    expect(result.allowed).toBe(true);
  });

  it("should support WARN action (allow but log warning)", () => {
    const rules = [
      enforcer.defineRule({
        name: "high-token-warn",
        trigger: "LLM_CALL",
        predicate: (ctx: { tokensRequested: number }) => ctx.tokensRequested > 10000,
        action: "WARN",
        message: "High token request — review recommended",
      }),
    ];
    const result = enforcer.enforce(rules, { trigger: "LLM_CALL", tokensRequested: 15000 });
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("high-token");
  });

  it("should enforce token limit rules", () => {
    const rules = [
      enforcer.defineRule({
        name: "token-limit",
        trigger: "LLM_CALL",
        predicate: (ctx: { tokensRequested: number }) => ctx.tokensRequested > 32768,
        action: "BLOCK",
        message: "Exceeds max token limit",
      }),
    ];
    const result = enforcer.enforce(rules, { trigger: "LLM_CALL", tokensRequested: 50000 });
    expect(result.allowed).toBe(false);
  });

  it("should enforce model whitelist rules", () => {
    const allowedModels = ["qwen2.5-coder:14b", "claude-haiku-4-5-20251001"];
    const rules = [
      enforcer.defineRule({
        name: "model-whitelist",
        trigger: "LLM_CALL",
        predicate: (ctx: { model: string }) => !allowedModels.includes(ctx.model),
        action: "BLOCK",
        message: "Model not in whitelist",
      }),
    ];
    const blocked = enforcer.enforce(rules, { trigger: "LLM_CALL", model: "gpt-4" });
    expect(blocked.allowed).toBe(false);
    const allowed = enforcer.enforce(rules, { trigger: "LLM_CALL", model: "qwen2.5-coder:14b" });
    expect(allowed.allowed).toBe(true);
  });

  it("should check protected components list", () => {
    const result = enforcer.isProtectedPath("packages/foundation/src/audit/index.ts");
    expect(result).toBe(true);
    const safe = enforcer.isProtectedPath("workflows/build-pipeline/task-1-interpret-spec/instructions.md");
    expect(safe).toBe(false);
  });
});
