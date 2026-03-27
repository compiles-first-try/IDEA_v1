/**
 * Tests for the Semantic Cache MCP Server.
 *
 * Verifies:
 * - Cache miss on first request
 * - Cache hit on second identical request
 * - Kill switch forces miss
 * - Tier 3 forces miss
 * - TTL behavior
 * - Different agents don't share cache
 * - Text similarity scoring
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createCacheClient, type CacheClient } from "../../../packages/foundation/src/cache/index.js";

describe("Semantic Cache MCP Server", () => {
  let cacheMcp: typeof import("../src/index.js");
  let redisClient: CacheClient;
  const TEST_AGENT = "test-agent-cache";
  const TEST_AGENT_B = "test-agent-cache-b";

  beforeAll(async () => {
    cacheMcp = await import("../src/index.js");
    redisClient = await createCacheClient(process.env.REDIS_URL!);
  });

  afterAll(async () => {
    // Clean up all test keys
    await cleanupTestKeys(redisClient, TEST_AGENT);
    await cleanupTestKeys(redisClient, TEST_AGENT_B);
    // Ensure kill switch is off
    await redisClient.del("rsf:kill:global");
    await redisClient.disconnect();
  });

  beforeEach(async () => {
    // Clean state before each test
    await cleanupTestKeys(redisClient, TEST_AGENT);
    await cleanupTestKeys(redisClient, TEST_AGENT_B);
    await redisClient.del("rsf:kill:global");
  });

  // ── Tool definitions ──

  it("should export tool definitions for cache-check and cache-store", () => {
    const tools = cacheMcp.getToolDefinitions();
    expect(tools).toBeDefined();
    expect(tools.length).toBe(2);

    const names = tools.map((t: { name: string }) => t.name);
    expect(names).toContain("cache-check");
    expect(names).toContain("cache-store");
  });

  // ── Cache miss on first request ──

  it("should return cache MISS on first request", async () => {
    const result = await cacheMcp.executeTool("cache-check", {
      agentId: TEST_AGENT,
      request: "What is the meaning of life?",
      tier: 1,
    });

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("no_match");
  });

  // ── Cache hit on second identical request ──

  it("should return cache HIT on second identical request", async () => {
    const request = "Generate a function that sorts an array";
    const response = "function sort(arr) { return arr.sort(); }";

    // Store first
    await cacheMcp.executeTool("cache-store", {
      agentId: TEST_AGENT,
      request,
      response,
      uncertaintyEnvelope: 0.1,
    });

    // Check — should hit
    const result = await cacheMcp.executeTool("cache-check", {
      agentId: TEST_AGENT,
      request,
      tier: 1,
    });

    expect(result.hit).toBe(true);
    expect(result.cachedResponse).toBe(response);
    expect(result.similarity).toBe(1.0);
    expect(result.matchType).toBe("exact");
  });

  // ── Kill switch forces miss ──

  it("should return cache MISS when kill switch is active", async () => {
    const request = "Generate a hello world function";
    const response = "function hello() { return 'hello world'; }";

    // Store a value
    await cacheMcp.executeTool("cache-store", {
      agentId: TEST_AGENT,
      request,
      response,
    });

    // Activate kill switch
    await redisClient.set("rsf:kill:global", "1");

    // Check — should miss due to kill switch
    const result = await cacheMcp.executeTool("cache-check", {
      agentId: TEST_AGENT,
      request,
      tier: 1,
    });

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("kill_switch_active");
  });

  // ── Tier 3 forces miss ──

  it("should return cache MISS when tier is 3 (COMPLEX)", async () => {
    const request = "Design a distributed consensus algorithm";
    const response = "Here is a Raft implementation...";

    // Store a value
    await cacheMcp.executeTool("cache-store", {
      agentId: TEST_AGENT,
      request,
      response,
    });

    // Check with tier 3 — should miss
    const result = await cacheMcp.executeTool("cache-check", {
      agentId: TEST_AGENT,
      request,
      tier: 3,
    });

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("tier_3_bypass");
  });

  // ── TTL behavior ──

  it("should store cache entries with correct TTL", async () => {
    const request = "Check TTL behavior";
    const response = "TTL test response";

    const storeResult = await cacheMcp.executeTool("cache-store", {
      agentId: TEST_AGENT,
      request,
      response,
    });

    expect(storeResult.stored).toBe(true);
    expect(storeResult.ttlSeconds).toBe(86400);

    // Verify TTL is set in Redis
    const hash = cacheMcp.computeHash(request);
    const key = cacheMcp.buildCacheKey(TEST_AGENT, hash);
    const ttl = await redisClient.redis.ttl(key);

    // TTL should be close to 86400 (within a few seconds of setting)
    expect(ttl).toBeGreaterThan(86390);
    expect(ttl).toBeLessThanOrEqual(86400);
  });

  // ── Different agents don't share cache ──

  it("should not return cache hits across different agents", async () => {
    const request = "Shared request text for isolation test";
    const response = "Agent A response";

    // Store under agent A
    await cacheMcp.executeTool("cache-store", {
      agentId: TEST_AGENT,
      request,
      response,
    });

    // Check under agent B — should miss
    const result = await cacheMcp.executeTool("cache-check", {
      agentId: TEST_AGENT_B,
      request,
      tier: 1,
    });

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("no_match");
  });

  // ── Text similarity helper ──

  it("should compute text similarity correctly", () => {
    // Identical strings
    expect(cacheMcp.computeTextSimilarity("hello", "hello")).toBe(1.0);

    // Completely different strings
    const diff = cacheMcp.computeTextSimilarity("abcdef", "zyxwvu");
    expect(diff).toBeLessThan(0.5);

    // Very similar strings
    const similar = cacheMcp.computeTextSimilarity(
      "Generate a function that sorts an array of numbers",
      "Generate a function that sorts an array of integers"
    );
    expect(similar).toBeGreaterThan(0.8);
  });

  // ── Input validation ──

  it("should reject invalid cache-check input", async () => {
    await expect(
      cacheMcp.executeTool("cache-check", { agentId: "", request: "test", tier: 1 })
    ).rejects.toThrow();
  });

  it("should reject invalid cache-store input", async () => {
    await expect(
      cacheMcp.executeTool("cache-store", { agentId: "a", request: "", response: "b" })
    ).rejects.toThrow();
  });

  it("should reject unknown tool names", async () => {
    await expect(
      cacheMcp.executeTool("nonexistent-tool", {})
    ).rejects.toThrow("Unknown tool: nonexistent-tool");
  });

  // ── Cache store returns metadata ──

  it("should return key and hash metadata on cache-store", async () => {
    const request = "Metadata test request";
    const result = await cacheMcp.executeTool("cache-store", {
      agentId: TEST_AGENT,
      request,
      response: "test response",
    });

    expect(result.stored).toBe(true);
    expect(result.hash).toBeDefined();
    expect(typeof result.hash).toBe("string");
    expect(result.key).toBe(`rsf:cache:${TEST_AGENT}:${result.hash}`);
  });
});

/**
 * Clean up all Redis keys for a test agent.
 */
async function cleanupTestKeys(client: CacheClient, agentId: string): Promise<void> {
  const prefix = `rsf:cache:${agentId}:`;
  let cursor = "0";
  do {
    const [nextCursor, keys] = await client.redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } while (cursor !== "0");
}
