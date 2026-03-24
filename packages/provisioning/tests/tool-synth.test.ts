/**
 * Tests for the Tool Synthesizer.
 *
 * Verifies:
 * - Generates a TypeScript tool function from a description
 * - Generates a Zod input schema
 * - Generates unit tests for the tool
 * - Generated code passes AST validation
 * - Audits the synthesis
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Tool Synthesizer", () => {
  let toolSynth: typeof import("../src/tool-synth/index.js");
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT = path.resolve(__dirname, "../../../logs/audit-tool-test.jsonl");

  beforeAll(async () => {
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT });
    toolSynth = await import("../src/tool-synth/index.js");
  });

  afterAll(async () => {
    await db.query("DELETE FROM agent_events WHERE agent_id = 'tool-synthesizer'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT)) fs.unlinkSync(TEST_AUDIT);
    await db.disconnect();
  });

  it("should synthesize a tool from a description", async () => {
    const synth = toolSynth.createToolSynthesizer({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await synth.synthesize(
      "A tool that converts a temperature from Celsius to Fahrenheit"
    );

    expect(result.toolCode).toBeDefined();
    expect(result.toolCode).toContain("function");
    expect(result.zodSchema).toBeDefined();
    expect(result.zodSchema).toContain("z.");
    expect(result.testCode).toBeDefined();
    expect(result.testCode).toContain("expect");
  });

  it("should produce AST-valid tool code", async () => {
    const { validateTypeScript } = await import("../../manufacturing/src/generator/index.js");
    const synth = toolSynth.createToolSynthesizer({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await synth.synthesize(
      "A tool that calculates the factorial of a non-negative integer"
    );

    const validation = validateTypeScript(result.toolCode);
    expect(validation.valid).toBe(true);
  });

  it("should generate a Zod schema for input validation", async () => {
    const synth = toolSynth.createToolSynthesizer({
      auditLogger,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    const result = await synth.synthesize(
      "A tool that formats a date string from ISO to human-readable"
    );

    expect(result.zodSchema).toContain("z.object");
    expect(result.zodSchema).toContain("z.string");
  });

  it("should audit the synthesis", async () => {
    const events = await db.query(
      `SELECT * FROM agent_events WHERE agent_id = 'tool-synthesizer' ORDER BY timestamp DESC LIMIT 1`
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(1);
  });
});
