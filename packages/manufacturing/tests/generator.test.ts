/**
 * Tests for the Code Generation Engine with AST validation.
 *
 * Verifies:
 * - Generates TypeScript code from a DetailedTarget
 * - AST validation catches syntax errors
 * - AST validation catches type errors
 * - Valid code passes AST validation
 * - Generated code matches the function signature from the target
 * - Audits the generation call
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DetailedTarget } from "../src/spec-interpreter/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Code Generation Engine", () => {
  let generator: typeof import("../src/generator/index.js");
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT_PATH = path.resolve(__dirname, "../../../logs/audit-mfg-gen-test.jsonl");

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");

    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT_PATH });
    generator = await import("../src/generator/index.js");
  });

  afterAll(async () => {
    await cache.del("rsf:daily-spend");
    await db.query("DELETE FROM agent_events WHERE agent_id = 'code-generator'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT_PATH)) fs.unlinkSync(TEST_AUDIT_PATH);
    await cache.disconnect();
    await db.disconnect();
  });

  describe("AST Validation", () => {
    it("should validate syntactically correct TypeScript", () => {
      const code = `function add(a: number, b: number): number { return a + b; }`;
      const result = generator.validateTypeScript(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject code with syntax errors", () => {
      const code = `function add(a: number, b: number): number { return a + `;
      const result = generator.validateTypeScript(code);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject code with type errors", () => {
      const code = `function add(a: number, b: number): string { return a + b; }`;
      const result = generator.validateTypeScript(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("type"))).toBe(true);
    });

    it("should validate multi-function code", () => {
      const code = `
        function helper(x: number): number { return x * 2; }
        function main(a: number): number { return helper(a) + 1; }
      `;
      const result = generator.validateTypeScript(code);
      expect(result.valid).toBe(true);
    });
  });

  describe("Code Generation", () => {
    const sampleTarget: DetailedTarget = {
      name: "isPrime",
      description: "Check if a number is prime",
      language: "typescript",
      type: "function",
      functionSignature: "function isPrime(n: number): boolean",
      parameters: [{ name: "n", type: "number", description: "Number to check" }],
      returnType: "boolean",
      requirements: [
        "Return true if n is prime, false otherwise",
        "Handle edge cases: n <= 1 returns false",
        "Handle n = 2 as prime",
      ],
      edgeCases: ["n <= 1", "n = 2", "Large primes"],
      testHints: ["isPrime(1)===false", "isPrime(2)===true", "isPrime(7)===true", "isPrime(4)===false"],
    };

    it("should generate TypeScript code from a target", async () => {
      const gen = generator.createCodeGenerator({
        auditLogger,
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      });

      const result = await gen.generate(sampleTarget);
      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.code).toContain("isPrime");
    });

    it("should produce AST-valid code", async () => {
      const gen = generator.createCodeGenerator({
        auditLogger,
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      });

      const result = await gen.generate(sampleTarget);
      const validation = generator.validateTypeScript(result.code);
      expect(validation.valid).toBe(true);
    });

    it("should audit the generation", async () => {
      const events = await db.query(
        `SELECT * FROM agent_events
         WHERE agent_id = 'code-generator'
         ORDER BY timestamp DESC LIMIT 1`
      );
      expect(events.rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
