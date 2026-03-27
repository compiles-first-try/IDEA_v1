/**
 * V2 Pipeline Orchestrator — End-to-End Tests
 *
 * Verifies the full pipeline: spec → router → generate → test → validate → quality → review
 * with epistemic tracking, kill switch respect, audit logging, Pareto columns.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("V2 Pipeline Orchestrator", () => {
  let pipeline: typeof import("../src/index.js");
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;

  beforeAll(async () => {
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    // Clear kill switch
    await cache.del("rsf:kill:global");
    pipeline = await import("../src/index.js");
  });

  afterAll(async () => {
    await db.query("DELETE FROM agent_events WHERE agent_id LIKE 'v2-pipeline-%'").catch(() => {});
    await cache.disconnect();
    await db.disconnect();
  });

  describe("Pipeline creation", () => {
    it("should create a pipeline instance", async () => {
      const p = await pipeline.createV2Pipeline({
        postgresUrl: process.env.POSTGRES_URL!,
        redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        migrationsDir: path.resolve(__dirname, "../../../db/migrations"),
        auditLogPath: path.resolve(__dirname, "../../../logs/audit-v2-pipeline-test.jsonl"),
      });
      expect(p).toBeDefined();
      expect(typeof p.run).toBe("function");
      expect(typeof p.getStatus).toBe("function");
      await p.shutdown();
    });
  });

  describe("Router classification", () => {
    it("should classify a simple function spec as STANDARD (Tier 2)", async () => {
      const p = await pipeline.createV2Pipeline({
        postgresUrl: process.env.POSTGRES_URL!,
        redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        migrationsDir: path.resolve(__dirname, "../../../db/migrations"),
        auditLogPath: path.resolve(__dirname, "../../../logs/audit-v2-pipeline-test.jsonl"),
      });

      const classification = p.classify("Write a function that adds two numbers");
      expect(classification.tier).toBe(2);
      expect(classification.taskType).toBe("STANDARD");
      await p.shutdown();
    });

    it("should classify schema validation as DETERMINISTIC (Tier 1)", async () => {
      const p = await pipeline.createV2Pipeline({
        postgresUrl: process.env.POSTGRES_URL!,
        redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        migrationsDir: path.resolve(__dirname, "../../../db/migrations"),
        auditLogPath: path.resolve(__dirname, "../../../logs/audit-v2-pipeline-test.jsonl"),
      });

      const classification = p.classify("Validate this JSON against the schema");
      expect(classification.tier).toBe(1);
      await p.shutdown();
    });
  });

  describe("Full pipeline execution", () => {
    it("should run the full pipeline for a simple spec", async () => {
      const p = await pipeline.createV2Pipeline({
        postgresUrl: process.env.POSTGRES_URL!,
        redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        migrationsDir: path.resolve(__dirname, "../../../db/migrations"),
        auditLogPath: path.resolve(__dirname, "../../../logs/audit-v2-pipeline-test.jsonl"),
      });

      const result = await p.run("Write a TypeScript function called double that takes a number and returns it multiplied by 2");

      // Verify all pipeline stages completed
      expect(result.stages.specInterpreter.status).toBe("completed");
      expect(result.stages.codeGenerator.status).toBe("completed");
      expect(result.stages.testGenerator.status).toBe("completed");

      // Verify artifacts produced
      expect(result.artifacts.code).toBeDefined();
      expect(result.artifacts.code.length).toBeGreaterThan(0);
      expect(result.artifacts.code).toContain("double");
      expect(result.artifacts.tests).toBeDefined();

      // Verify epistemic tracking
      expect(result.uncertainty).toBeDefined();
      expect(result.uncertainty.epistemic).toBeDefined();
      expect(result.uncertainty.aleatoric).toBeDefined();

      // Verify audit trail
      expect(result.auditTrail.length).toBeGreaterThanOrEqual(3);

      // Verify routing metadata
      expect(result.routing.tier).toBeDefined();
      expect(result.routing.classification).toBeDefined();

      await p.shutdown();
    }, 120_000);

    it("should refuse to run when kill switch is active", async () => {
      const p = await pipeline.createV2Pipeline({
        postgresUrl: process.env.POSTGRES_URL!,
        redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        migrationsDir: path.resolve(__dirname, "../../../db/migrations"),
        auditLogPath: path.resolve(__dirname, "../../../logs/audit-v2-pipeline-test.jsonl"),
      });

      // Activate kill switch
      await cache.set("rsf:kill:global", "1");

      await expect(p.run("Any spec")).rejects.toThrow(/kill switch/i);

      // Deactivate
      await cache.del("rsf:kill:global");
      await p.shutdown();
    });

    it("should log events with Pareto tracking columns", async () => {
      const p = await pipeline.createV2Pipeline({
        postgresUrl: process.env.POSTGRES_URL!,
        redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        migrationsDir: path.resolve(__dirname, "../../../db/migrations"),
        auditLogPath: path.resolve(__dirname, "../../../logs/audit-v2-pipeline-test.jsonl"),
      });

      await p.run("Write a function that returns true");

      // Check audit events have Pareto columns
      const events = await db.query(
        `SELECT event_id, agent_id, task_tier, task_cost_usd, task_quality_score, cache_hit
         FROM agent_events
         WHERE agent_id LIKE 'v2-pipeline-%'
         ORDER BY timestamp DESC LIMIT 5`
      );
      expect(events.rows.length).toBeGreaterThanOrEqual(1);
      // At least one event should have task_tier set
      const withTier = events.rows.filter((r: { task_tier: number | null }) => r.task_tier !== null);
      expect(withTier.length).toBeGreaterThanOrEqual(1);

      await p.shutdown();
    }, 120_000);
  });
});
