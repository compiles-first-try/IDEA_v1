/**
 * Tests for Agent Behavioral Contracts runtime.
 *
 * Verifies:
 * - Defines contracts with pre/post conditions, invariants
 * - Validates preconditions before agent runs
 * - Validates postconditions after agent completes
 * - Enforces max execution time
 * - Enforces allowed tools/models whitelists
 * - Blocks disallowed tool/model usage
 * - Supports requiresApproval flag
 */
import { describe, it, expect } from "vitest";

describe("Agent Behavioral Contracts", () => {
  let contracts: typeof import("../src/contracts/index.js");

  it("should load module", async () => {
    contracts = await import("../src/contracts/index.js");
    expect(contracts).toBeDefined();
  });

  it("should define a valid contract", async () => {
    const contract = contracts.defineContract({
      agentId: "test-agent-001",
      preconditions: ["database is connected", "config is loaded"],
      postconditions: ["output is valid JSON"],
      invariants: ["no secrets in output"],
      maxExecutionMs: 30_000,
      maxTokensPerCall: 4096,
      allowedTools: ["read-file", "write-file"],
      allowedModels: ["qwen2.5-coder:14b"],
      requiresApproval: false,
      auditLevel: "FULL",
    });

    expect(contract.agentId).toBe("test-agent-001");
    expect(contract.allowedTools).toContain("read-file");
  });

  it("should validate passing preconditions", async () => {
    const contract = contracts.defineContract({
      agentId: "precon-agent",
      preconditions: ["input is defined"],
      postconditions: [],
      invariants: [],
      maxExecutionMs: 10_000,
      maxTokensPerCall: 1000,
      allowedTools: [],
      allowedModels: ["qwen2.5-coder:14b"],
      requiresApproval: false,
      auditLevel: "SUMMARY",
    });

    const context = { input: "hello" };
    const checkers = {
      "input is defined": (ctx: Record<string, unknown>) => ctx.input !== undefined,
    };

    const result = contracts.checkPreconditions(contract, context, checkers);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("should reject failing preconditions", async () => {
    const contract = contracts.defineContract({
      agentId: "precon-fail-agent",
      preconditions: ["input is defined", "user is authenticated"],
      postconditions: [],
      invariants: [],
      maxExecutionMs: 10_000,
      maxTokensPerCall: 1000,
      allowedTools: [],
      allowedModels: [],
      requiresApproval: false,
      auditLevel: "SUMMARY",
    });

    const context = { input: "hello" };
    const checkers = {
      "input is defined": (ctx: Record<string, unknown>) => ctx.input !== undefined,
      "user is authenticated": () => false,
    };

    const result = contracts.checkPreconditions(contract, context, checkers);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("user is authenticated");
  });

  it("should validate postconditions", async () => {
    const contract = contracts.defineContract({
      agentId: "postcon-agent",
      preconditions: [],
      postconditions: ["output is valid JSON"],
      invariants: [],
      maxExecutionMs: 10_000,
      maxTokensPerCall: 1000,
      allowedTools: [],
      allowedModels: [],
      requiresApproval: false,
      auditLevel: "FULL",
    });

    const output = { result: '{"key":"value"}' };
    const checkers = {
      "output is valid JSON": (ctx: Record<string, unknown>) => {
        try {
          JSON.parse(ctx.result as string);
          return true;
        } catch {
          return false;
        }
      },
    };

    const result = contracts.checkPostconditions(contract, output, checkers);
    expect(result.passed).toBe(true);
  });

  it("should enforce allowed tools whitelist", async () => {
    const contract = contracts.defineContract({
      agentId: "tool-check-agent",
      preconditions: [],
      postconditions: [],
      invariants: [],
      maxExecutionMs: 10_000,
      maxTokensPerCall: 1000,
      allowedTools: ["read-file", "search"],
      allowedModels: [],
      requiresApproval: false,
      auditLevel: "FULL",
    });

    expect(contracts.isToolAllowed(contract, "read-file")).toBe(true);
    expect(contracts.isToolAllowed(contract, "search")).toBe(true);
    expect(contracts.isToolAllowed(contract, "delete-database")).toBe(false);
  });

  it("should enforce allowed models whitelist", async () => {
    const contract = contracts.defineContract({
      agentId: "model-check-agent",
      preconditions: [],
      postconditions: [],
      invariants: [],
      maxExecutionMs: 10_000,
      maxTokensPerCall: 1000,
      allowedTools: [],
      allowedModels: ["qwen2.5-coder:14b", "llama3.3:8b"],
      requiresApproval: false,
      auditLevel: "FULL",
    });

    expect(contracts.isModelAllowed(contract, "qwen2.5-coder:14b")).toBe(true);
    expect(contracts.isModelAllowed(contract, "claude-sonnet-4-6-20250514")).toBe(false);
  });

  it("should enforce max execution time", async () => {
    const contract = contracts.defineContract({
      agentId: "timeout-agent",
      preconditions: [],
      postconditions: [],
      invariants: [],
      maxExecutionMs: 100,
      maxTokensPerCall: 1000,
      allowedTools: [],
      allowedModels: [],
      requiresApproval: false,
      auditLevel: "SUMMARY",
    });

    const guard = contracts.createExecutionGuard(contract);
    await new Promise((r) => setTimeout(r, 150));
    expect(guard.isExpired()).toBe(true);
  });

  it("should not expire before max execution time", async () => {
    const contract = contracts.defineContract({
      agentId: "no-timeout-agent",
      preconditions: [],
      postconditions: [],
      invariants: [],
      maxExecutionMs: 60_000,
      maxTokensPerCall: 1000,
      allowedTools: [],
      allowedModels: [],
      requiresApproval: false,
      auditLevel: "SUMMARY",
    });

    const guard = contracts.createExecutionGuard(contract);
    expect(guard.isExpired()).toBe(false);
  });

  it("should track token usage against limit", async () => {
    const contract = contracts.defineContract({
      agentId: "token-agent",
      preconditions: [],
      postconditions: [],
      invariants: [],
      maxExecutionMs: 60_000,
      maxTokensPerCall: 100,
      allowedTools: [],
      allowedModels: [],
      requiresApproval: false,
      auditLevel: "FULL",
    });

    expect(contracts.isWithinTokenLimit(contract, 50)).toBe(true);
    expect(contracts.isWithinTokenLimit(contract, 100)).toBe(true);
    expect(contracts.isWithinTokenLimit(contract, 101)).toBe(false);
  });
});
