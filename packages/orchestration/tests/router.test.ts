/**
 * Tests for the difficulty-aware model router.
 *
 * Verifies:
 * - Classifies tasks into 4 tiers: TRIVIAL, STANDARD, COMPLEX, CRITICAL
 * - Routes to correct model per tier
 * - Enforces max token limits per tier
 * - Tracks daily cloud spend in Redis
 * - Escalates to CRITICAL-only when spend > $10
 * - Pauses cloud calls when spend > $20
 * - Dispatches to local Ollama for TRIVIAL/STANDARD
 * - Dispatches to Anthropic API for COMPLEX/CRITICAL
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Model Router", () => {
  let router: Awaited<ReturnType<typeof import("../src/router/index.js")["createModelRouter"]>>;
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");

    const { createModelRouter } = await import("../src/router/index.js");
    router = await createModelRouter({
      cache,
      maxDailySpendUsd: 10,
      pauseThresholdUsd: 20,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });
  });

  afterEach(async () => {
    await cache.del("rsf:daily-spend", "rsf:daily-spend-date");
  });

  afterAll(async () => {
    await cache.disconnect();
  });

  describe("Task classification", () => {
    it("should classify formatting tasks as TRIVIAL", () => {
      const tier = router.classify("Format this JSON string");
      expect(tier).toBe("TRIVIAL");
    });

    it("should classify single-function generation as STANDARD", () => {
      const tier = router.classify("Write a function to sort an array");
      expect(tier).toBe("STANDARD");
    });

    it("should classify multi-file generation as COMPLEX", () => {
      const tier = router.classify("Generate a REST API with authentication and database models");
      expect(tier).toBe("COMPLEX");
    });

    it("should classify architecture decisions as CRITICAL", () => {
      const tier = router.classify("Review the foundry's agent blueprint architecture and propose improvements");
      expect(tier).toBe("CRITICAL");
    });

    it("should allow explicit tier override", () => {
      const tier = router.classify("Simple task", "CRITICAL");
      expect(tier).toBe("CRITICAL");
    });
  });

  describe("Model resolution", () => {
    it("should resolve TRIVIAL to llama3.3:8b", () => {
      const model = router.resolveModel("TRIVIAL");
      expect(model).toEqual({
        provider: "ollama",
        model: "llama3.3:8b",
        maxTokens: 512,
      });
    });

    it("should resolve STANDARD to qwen2.5-coder:14b", () => {
      const model = router.resolveModel("STANDARD");
      expect(model).toEqual({
        provider: "ollama",
        model: "qwen2.5-coder:14b",
        maxTokens: 2048,
      });
    });

    it("should resolve COMPLEX to claude-haiku-4-5-20251001", () => {
      const model = router.resolveModel("COMPLEX");
      expect(model).toEqual({
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        maxTokens: 8192,
      });
    });

    it("should resolve CRITICAL to claude-sonnet-4-6-20250514", () => {
      const model = router.resolveModel("CRITICAL");
      expect(model).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-6-20250514",
        maxTokens: 32768,
      });
    });
  });

  describe("Spend tracking and guardrails", () => {
    it("should track daily cloud spend", async () => {
      await router.recordSpend(0.015);
      const spend = await router.getDailySpend();
      expect(spend).toBeCloseTo(0.015, 3);
    });

    it("should accumulate spend across calls", async () => {
      await router.recordSpend(0.005);
      await router.recordSpend(0.003);
      const spend = await router.getDailySpend();
      expect(spend).toBeCloseTo(0.008, 3);
    });

    it("should escalate to CRITICAL-only when spend exceeds threshold", async () => {
      await router.recordSpend(11.0); // Over $10
      const model = router.resolveModel("COMPLEX", await router.getDailySpend());
      // COMPLEX should be escalated to CRITICAL model
      expect(model.model).toBe("claude-sonnet-4-6-20250514");
    });

    it("should pause cloud calls when spend exceeds pause threshold", async () => {
      await router.recordSpend(21.0); // Over $20
      const model = router.resolveModel("COMPLEX", await router.getDailySpend());
      // Should fall back to local model
      expect(model.provider).toBe("ollama");
    });

    it("should allow local models regardless of spend", async () => {
      await router.recordSpend(25.0); // Way over budget
      const model = router.resolveModel("TRIVIAL", await router.getDailySpend());
      expect(model.provider).toBe("ollama");
    });
  });
});
