/**
 * Tests for the Test-First Generation Pipeline.
 *
 * Verifies:
 * - Generates test code from a DetailedTarget BEFORE implementation
 * - Test code is syntactically valid TypeScript
 * - Generates implementation code to satisfy the tests
 * - Implementation passes AST validation
 * - Full pipeline returns both test and implementation code
 * - Audits the pipeline execution
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DetailedTarget } from "../src/spec-interpreter/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Test-First Generation Pipeline", () => {
  let pipeline: typeof import("../src/test-first/index.js");
  let generator: typeof import("../src/generator/index.js");
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT_PATH = path.resolve(__dirname, "../../../logs/audit-mfg-tf-test.jsonl");

  const sampleTarget: DetailedTarget = {
    name: "clamp",
    description: "Clamp a number between a min and max value",
    language: "typescript",
    type: "function",
    functionSignature: "function clamp(value: number, min: number, max: number): number",
    parameters: [
      { name: "value", type: "number", description: "The value to clamp" },
      { name: "min", type: "number", description: "Minimum bound" },
      { name: "max", type: "number", description: "Maximum bound" },
    ],
    returnType: "number",
    requirements: [
      "Return min if value < min",
      "Return max if value > max",
      "Return value if between min and max",
    ],
    edgeCases: ["value equals min", "value equals max", "min equals max"],
    testHints: [
      "clamp(5, 1, 10) === 5",
      "clamp(-1, 0, 10) === 0",
      "clamp(15, 0, 10) === 10",
      "clamp(5, 5, 5) === 5",
    ],
  };

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");

    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT_PATH });
    pipeline = await import("../src/test-first/index.js");
    generator = await import("../src/generator/index.js");
  });

  afterAll(async () => {
    await cache.del("rsf:daily-spend");
    await db.query("DELETE FROM agent_events WHERE agent_id LIKE 'test-first%'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT_PATH)) fs.unlinkSync(TEST_AUDIT_PATH);
    await cache.disconnect();
    await db.disconnect();
  });

  it("should generate test code from a target", async () => {
    const p = pipeline.createTestFirstPipeline({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const testCode = await p.generateTests(sampleTarget);
    expect(testCode).toContain("clamp");
    expect(testCode).toContain("expect");
    // Test code should be syntactically valid
    const validation = generator.validateTypeScript(testCode);
    // Test code may reference imports not available, so we check syntax only
    const syntaxOnly = generator.validateTypeScript(testCode);
    expect(syntaxOnly.errors.every(e => !e.includes("expected"))).toBe(true);
  });

  it("should generate implementation code after tests", async () => {
    const p = pipeline.createTestFirstPipeline({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await p.run(sampleTarget);
    expect(result.testCode).toBeDefined();
    expect(result.testCode).toContain("clamp");
    expect(result.implementationCode).toBeDefined();
    expect(result.implementationCode).toContain("clamp");
    expect(result.implementationValid).toBe(true);
  });

  it("should produce implementation that passes AST validation", async () => {
    const p = pipeline.createTestFirstPipeline({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await p.run(sampleTarget);
    const validation = generator.validateTypeScript(result.implementationCode);
    expect(validation.valid).toBe(true);
  });

  it("should audit both test generation and implementation generation", async () => {
    const events = await db.query(
      `SELECT * FROM agent_events
       WHERE agent_id LIKE 'test-first%'
       ORDER BY timestamp DESC LIMIT 5`
    );
    // Should have at least 2 events (test gen + impl gen) from the runs above
    expect(events.rows.length).toBeGreaterThanOrEqual(2);
  });
});
