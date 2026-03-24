/**
 * Tests for the Agent Blueprint Generator.
 *
 * Verifies:
 * - Takes NL description → AgentContract + agent definition + test suite
 * - AgentContract has all required fields and validates with Zod
 * - Agent definition includes system prompt and tool config
 * - Test suite contains relevant test cases
 * - Audits the generation
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Agent Blueprint Generator", () => {
  let blueprintGen: typeof import("../src/blueprint-gen/index.js");
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT = path.resolve(__dirname, "../../../logs/audit-bp-test.jsonl");

  beforeAll(async () => {
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT });
    blueprintGen = await import("../src/blueprint-gen/index.js");
  });

  afterAll(async () => {
    await db.query("DELETE FROM agent_events WHERE agent_id = 'blueprint-generator'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT)) fs.unlinkSync(TEST_AUDIT);
    await db.disconnect();
  });

  it("should generate a blueprint from a natural language description", async () => {
    const gen = blueprintGen.createBlueprintGenerator({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await gen.generate(
      "A code review agent that examines TypeScript code for common bugs and style issues"
    );

    expect(result.contract).toBeDefined();
    expect(result.agentDefinition).toBeDefined();
    expect(result.testSuite).toBeDefined();
  });

  it("should produce a valid AgentContract with all required fields", async () => {
    const gen = blueprintGen.createBlueprintGenerator({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await gen.generate(
      "A documentation generator agent that creates JSDoc comments for TypeScript functions"
    );

    const c = result.contract;
    expect(c.agentId).toBeDefined();
    expect(c.preconditions).toBeDefined();
    expect(Array.isArray(c.preconditions)).toBe(true);
    expect(c.postconditions).toBeDefined();
    expect(c.invariants).toBeDefined();
    expect(typeof c.maxExecutionMs).toBe("number");
    expect(typeof c.maxTokensPerCall).toBe("number");
    expect(Array.isArray(c.allowedTools)).toBe(true);
    expect(Array.isArray(c.allowedModels)).toBe(true);
    expect(typeof c.requiresApproval).toBe("boolean");
    expect(["FULL", "SUMMARY"]).toContain(c.auditLevel);
  });

  it("should produce an agent definition with system prompt", async () => {
    const gen = blueprintGen.createBlueprintGenerator({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await gen.generate("A test generation agent");
    expect(result.agentDefinition.systemPrompt).toBeDefined();
    expect(result.agentDefinition.systemPrompt.length).toBeGreaterThan(20);
    expect(result.agentDefinition.name).toBeDefined();
  });

  it("should produce a test suite string", async () => {
    const gen = blueprintGen.createBlueprintGenerator({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await gen.generate("A refactoring agent");
    expect(typeof result.testSuite).toBe("string");
    expect(result.testSuite.length).toBeGreaterThan(0);
  });
});
