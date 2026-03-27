/**
 * System 4: Environment Scanner
 *
 * Monitors external tech landscape. Maintains held-out benchmarks.
 * Structurally separate from the improvement proposer (System 6).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Environment Scanner", () => {
  let scanner: typeof import("../src/environment-scan/index.js");
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;

  beforeAll(async () => {
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    scanner = await import("../src/environment-scan/index.js");
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it("should check Ollama for available models", async () => {
    const result = await scanner.checkOllamaModels(
      process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
    );
    expect(result.models).toBeDefined();
    expect(Array.isArray(result.models)).toBe(true);
    expect(result.checkedAt).toBeDefined();
  });

  it("should assess relevance of a finding", () => {
    const finding = {
      source: "ollama",
      title: "New model: qwen3-coder:32b",
      content: "A new coding model with improved TypeScript support",
    };
    const assessment = scanner.assessRelevance(finding);
    expect(assessment.relevant).toBeDefined();
    expect(typeof assessment.relevant).toBe("boolean");
    expect(assessment.confidence).toBeGreaterThanOrEqual(0);
    expect(assessment.confidence).toBeLessThanOrEqual(1);
    expect(assessment.affectedWorkflows).toBeDefined();
  });

  it("should manage held-out benchmarks", async () => {
    const benchmarks = await scanner.getHeldOutBenchmarks(db);
    expect(benchmarks).toBeDefined();
    expect(Array.isArray(benchmarks)).toBe(true);
  });

  it("should add a benchmark entry", async () => {
    await scanner.addBenchmark(db, {
      name: "test-benchmark",
      category: "code-generation",
      input: "Write a function that adds two numbers",
      expectedOutput: "function add(a: number, b: number): number { return a + b; }",
    });

    const benchmarks = await scanner.getHeldOutBenchmarks(db);
    const found = benchmarks.find((b: { name: string }) => b.name === "test-benchmark");
    expect(found).toBeDefined();

    // Cleanup
    await db.query("DELETE FROM held_out_benchmarks WHERE name = $1", ["test-benchmark"]);
  });

  it("should produce a scan report", async () => {
    const report = await scanner.runScan({
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      db,
    });
    expect(report.findings).toBeDefined();
    expect(report.scannedAt).toBeDefined();
    expect(report.sourcesChecked).toBeGreaterThanOrEqual(1);
  });
});
