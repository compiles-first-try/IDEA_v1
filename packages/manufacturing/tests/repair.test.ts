/**
 * Tests for the Automated Program Repair Agent.
 *
 * Verifies:
 * - Takes broken code + error info and produces a fix
 * - Repaired code passes AST validation
 * - Handles syntax errors
 * - Handles logic errors (wrong output)
 * - Audits repair attempts
 * - Limits repair attempts (no infinite loops)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Program Repair Agent", () => {
  let repair: typeof import("../src/repair/index.js");
  let generator: typeof import("../src/generator/index.js");
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT_PATH = path.resolve(__dirname, "../../../logs/audit-mfg-repair-test.jsonl");

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");

    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT_PATH });
    repair = await import("../src/repair/index.js");
    generator = await import("../src/generator/index.js");
  });

  afterAll(async () => {
    await db.query("DELETE FROM agent_events WHERE agent_id = 'program-repair'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT_PATH)) fs.unlinkSync(TEST_AUDIT_PATH);
    await cache.disconnect();
    await db.disconnect();
  });

  it("should repair code with a syntax error", async () => {
    const brokenCode = `function add(a: number, b: number): number {
  return a +
}`;
    const errorInfo = "Expression expected.";

    const agent = repair.createRepairAgent({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await agent.repair({
      code: brokenCode,
      errors: [errorInfo],
      functionName: "add",
      expectedSignature: "function add(a: number, b: number): number",
    });

    expect(result.repaired).toBe(true);
    expect(result.code).toContain("add");
    expect(result.code).toContain("return");
    const validation = generator.validateTypeScript(result.code);
    expect(validation.valid).toBe(true);
  });

  it("should repair code with a logic error", async () => {
    const brokenCode = `function multiply(a: number, b: number): number {
  return a + b;
}`;
    const errorInfo = "Test failed: multiply(3, 4) expected 12 but got 7";

    const agent = repair.createRepairAgent({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await agent.repair({
      code: brokenCode,
      errors: [errorInfo],
      functionName: "multiply",
      expectedSignature: "function multiply(a: number, b: number): number",
    });

    expect(result.repaired).toBe(true);
    expect(result.code).toContain("*"); // Should use multiplication
    const validation = generator.validateTypeScript(result.code);
    expect(validation.valid).toBe(true);
  });

  it("should enforce max repair attempts", async () => {
    const agent = repair.createRepairAgent({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      maxAttempts: 1,
    });

    // This is unrepairable garbage
    const result = await agent.repair({
      code: "asdf 1234 @@@ !!!! {{{",
      errors: ["Everything is wrong"],
      functionName: "unknown",
      expectedSignature: "function unknown(): void",
    });

    expect(result.attempts).toBeLessThanOrEqual(1);
  });

  it("should audit repair attempts", async () => {
    const events = await db.query(
      `SELECT * FROM agent_events
       WHERE agent_id = 'program-repair'
       ORDER BY timestamp DESC LIMIT 3`
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(1);
  });
});
