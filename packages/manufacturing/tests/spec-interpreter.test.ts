/**
 * Tests for the Manufacturing Spec Interpreter.
 *
 * Verifies:
 * - Converts natural language specs into detailed GenerationTargets
 * - Handles structured/formal spec inputs (JSON)
 * - Produces function signatures, parameters, return types
 * - Identifies edge cases and test hints
 * - Validates output with Zod
 * - Uses the model router
 * - Audits all LLM calls
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Manufacturing Spec Interpreter", () => {
  let specInterpreter: typeof import("../src/spec-interpreter/index.js");
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT_PATH = path.resolve(__dirname, "../../../logs/audit-mfg-spec-test.jsonl");

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");

    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT_PATH });
    specInterpreter = await import("../src/spec-interpreter/index.js");
  });

  afterAll(async () => {
    await cache.del("rsf:daily-spend");
    await db.query("DELETE FROM agent_events WHERE agent_id = 'mfg-spec-interpreter'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT_PATH)) fs.unlinkSync(TEST_AUDIT_PATH);
    await cache.disconnect();
    await db.disconnect();
  });

  it("should convert a natural language spec to a DetailedTarget", async () => {
    const interpreter = specInterpreter.createManufacturingSpecInterpreter({
      cache,
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const target = await interpreter.interpret(
      "Create a TypeScript function called isPrime that takes a number and returns true if it is a prime number"
    );

    expect(target.name).toBeDefined();
    expect(target.language).toBe("typescript");
    expect(target.functionSignature).toBeDefined();
    expect(target.parameters).toBeDefined();
    expect(target.parameters.length).toBeGreaterThan(0);
    expect(target.returnType).toBeDefined();
    expect(target.requirements.length).toBeGreaterThan(0);
  });

  it("should produce edge cases and test hints", async () => {
    const interpreter = specInterpreter.createManufacturingSpecInterpreter({
      cache,
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const target = await interpreter.interpret(
      "Write a function that divides two numbers and handles division by zero"
    );

    expect(target.edgeCases).toBeDefined();
    expect(target.edgeCases.length).toBeGreaterThan(0);
    expect(target.testHints).toBeDefined();
    expect(target.testHints.length).toBeGreaterThan(0);
  });

  it("should accept a pre-structured JSON spec", async () => {
    const interpreter = specInterpreter.createManufacturingSpecInterpreter({
      cache,
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const jsonSpec = JSON.stringify({
      name: "fibonacci",
      description: "Compute the nth Fibonacci number",
      language: "typescript",
      functionSignature: "function fibonacci(n: number): number",
      parameters: [{ name: "n", type: "number", description: "Index in the sequence" }],
      returnType: "number",
      requirements: ["Return the nth Fibonacci number", "Handle n=0 and n=1 as base cases"],
      edgeCases: ["Negative input"],
      testHints: ["fibonacci(0)===0", "fibonacci(1)===1", "fibonacci(10)===55"],
    });

    const target = await interpreter.interpret(jsonSpec);
    expect(target.name).toBe("fibonacci");
    expect(target.parameters).toHaveLength(1);
    expect(target.testHints.length).toBeGreaterThan(0);
  });

  it("should audit the LLM call", async () => {
    const interpreter = specInterpreter.createManufacturingSpecInterpreter({
      cache,
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    await interpreter.interpret("Write a function to reverse a string");

    const events = await db.query(
      `SELECT * FROM agent_events
       WHERE agent_id = 'mfg-spec-interpreter'
       ORDER BY timestamp DESC LIMIT 1`
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(1);
  });
});
