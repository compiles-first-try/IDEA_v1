/**
 * Semantic Cache MCP Server
 *
 * Provides two tools:
 * - cache-check: checks if a semantically similar request has been cached
 * - cache-store: stores a response in cache
 *
 * Features:
 * - Kill switch integration: if rsf:kill:global is "1", cache-check always returns MISS
 * - Tier 3 bypass: COMPLEX tasks always return MISS (novel by nature)
 * - Audit logging: all hits and misses are logged via the foundation audit module
 * - Text-based similarity: exact hash match first, then substring overlap ratio
 */
import { z } from "zod";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCacheClient, type CacheClient } from "../../../packages/foundation/src/cache/index.js";
import { createAuditLogger, type AuditLogger } from "../../../packages/foundation/src/audit/index.js";
import { createDbClient, type DbClient } from "../../../packages/foundation/src/db/index.js";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const DEFAULT_TTL_SECONDS = 86400; // 24 hours
const SIMILARITY_THRESHOLD = 0.92;
const KILL_SWITCH_KEY = "rsf:kill:global";

// ── Tool Input Schemas ──

const CacheCheckInputSchema = z.object({
  agentId: z.string().min(1),
  request: z.string().min(1),
  tier: z.number().int().min(1).max(4),
});

const CacheStoreInputSchema = z.object({
  agentId: z.string().min(1),
  request: z.string().min(1),
  response: z.string().min(1),
  uncertaintyEnvelope: z.number().min(0).max(1).optional().default(0),
});

// ── Tool Definitions ──

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "cache-check",
      description:
        "Check if a semantically similar request has been cached. Returns hit/miss with optional cached response and similarity score. Tier 3 (COMPLEX) always returns MISS. Kill switch forces MISS.",
      inputSchema: CacheCheckInputSchema,
    },
    {
      name: "cache-store",
      description:
        "Store a response in the semantic cache. Key format: rsf:cache:{agentId}:{sha256(request)}. TTL: 24 hours.",
      inputSchema: CacheStoreInputSchema,
    },
  ];
}

// ── Helpers ──

/**
 * Compute SHA256 hash of the request text for cache key derivation.
 */
export function computeHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Build the Redis key for a given agent and request hash.
 */
export function buildCacheKey(agentId: string, hash: string): string {
  return `rsf:cache:${agentId}:${hash}`;
}

/**
 * Compute a lightweight text similarity score between two strings
 * using bigram overlap (Dice coefficient).
 * Returns a value between 0.0 and 1.0.
 */
export function computeTextSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;

  const aNorm = a.toLowerCase().trim();
  const bNorm = b.toLowerCase().trim();

  if (aNorm === bNorm) return 1.0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < aNorm.length - 1; i++) {
    const bigram = aNorm.substring(i, i + 2);
    bigramsA.set(bigram, (bigramsA.get(bigram) ?? 0) + 1);
  }

  const bigramsB = new Map<string, number>();
  for (let i = 0; i < bNorm.length - 1; i++) {
    const bigram = bNorm.substring(i, i + 2);
    bigramsB.set(bigram, (bigramsB.get(bigram) ?? 0) + 1);
  }

  let intersection = 0;
  for (const [bigram, countA] of bigramsA) {
    const countB = bigramsB.get(bigram) ?? 0;
    intersection += Math.min(countA, countB);
  }

  const totalBigrams = (aNorm.length - 1) + (bNorm.length - 1);
  if (totalBigrams === 0) return 0.0;

  return (2 * intersection) / totalBigrams;
}

// ── Cache entry stored in Redis ──

interface CacheEntry {
  request: string;
  response: string;
  uncertaintyEnvelope: number;
  storedAt: string;
}

// ── Singleton connections ──

let cache: CacheClient | null = null;
let audit: AuditLogger | null = null;
let db: DbClient | null = null;

async function getCache(): Promise<CacheClient> {
  if (!cache) {
    cache = await createCacheClient(process.env.REDIS_URL!);
  }
  return cache;
}

async function getDb(): Promise<DbClient> {
  if (!db) {
    db = await createDbClient(process.env.POSTGRES_URL!);
  }
  return db;
}

async function getAudit(): Promise<AuditLogger> {
  if (!audit) {
    const dbInstance = await getDb();
    audit = await createAuditLogger({
      db: dbInstance,
      logPath: path.resolve(__dirname, "../../../logs/audit.jsonl"),
    });
  }
  return audit;
}

/**
 * Check the kill switch in Redis.
 * Returns true if the kill switch is active.
 */
async function isKillSwitchActive(cacheClient: CacheClient): Promise<boolean> {
  const value = await cacheClient.get(KILL_SWITCH_KEY);
  return value === "1";
}

// ── Tool Execution ──

export async function executeTool(
  toolName: string,
  rawInput: unknown
): Promise<Record<string, unknown>> {
  const startTime = Date.now();

  switch (toolName) {
    case "cache-check": {
      const input = CacheCheckInputSchema.parse(rawInput);
      const cacheClient = await getCache();

      // Tier 3 bypass: COMPLEX tasks are novel, always MISS
      if (input.tier === 3) {
        await logCacheEvent(input.agentId, "CACHE_MISS", {
          reason: "tier_3_bypass",
          request: input.request.slice(0, 200),
          tier: input.tier,
          durationMs: Date.now() - startTime,
        });
        return { hit: false, reason: "tier_3_bypass" };
      }

      // Kill switch check
      if (await isKillSwitchActive(cacheClient)) {
        await logCacheEvent(input.agentId, "CACHE_MISS", {
          reason: "kill_switch_active",
          request: input.request.slice(0, 200),
          tier: input.tier,
          durationMs: Date.now() - startTime,
        });
        return { hit: false, reason: "kill_switch_active" };
      }

      // Exact hash match
      const hash = computeHash(input.request);
      const key = buildCacheKey(input.agentId, hash);
      const entry = await cacheClient.getJson<CacheEntry>(key);

      if (entry) {
        const durationMs = Date.now() - startTime;
        await logCacheEvent(input.agentId, "CACHE_HIT", {
          reason: "exact_hash_match",
          similarity: 1.0,
          request: input.request.slice(0, 200),
          tier: input.tier,
          durationMs,
        });
        return {
          hit: true,
          cachedResponse: entry.response,
          similarity: 1.0,
          matchType: "exact",
        };
      }

      // Fuzzy search: scan for keys matching this agent's cache prefix
      // and check text similarity against stored requests
      const prefix = `rsf:cache:${input.agentId}:`;
      const keys = await scanKeys(cacheClient, prefix);

      for (const candidateKey of keys) {
        const candidateEntry = await cacheClient.getJson<CacheEntry>(candidateKey);
        if (!candidateEntry) continue;

        const similarity = computeTextSimilarity(input.request, candidateEntry.request);
        if (similarity >= SIMILARITY_THRESHOLD) {
          const durationMs = Date.now() - startTime;
          await logCacheEvent(input.agentId, "CACHE_HIT", {
            reason: "similarity_match",
            similarity,
            request: input.request.slice(0, 200),
            tier: input.tier,
            durationMs,
          });
          return {
            hit: true,
            cachedResponse: candidateEntry.response,
            similarity,
            matchType: "similar",
          };
        }
      }

      // No match found
      const durationMs = Date.now() - startTime;
      await logCacheEvent(input.agentId, "CACHE_MISS", {
        reason: "no_match",
        request: input.request.slice(0, 200),
        tier: input.tier,
        durationMs,
      });
      return { hit: false, reason: "no_match" };
    }

    case "cache-store": {
      const input = CacheStoreInputSchema.parse(rawInput);
      const cacheClient = await getCache();

      const hash = computeHash(input.request);
      const key = buildCacheKey(input.agentId, hash);

      const entry: CacheEntry = {
        request: input.request,
        response: input.response,
        uncertaintyEnvelope: input.uncertaintyEnvelope,
        storedAt: new Date().toISOString(),
      };

      await cacheClient.setJson(key, entry, DEFAULT_TTL_SECONDS);

      const durationMs = Date.now() - startTime;
      await logCacheEvent(input.agentId, "CACHE_STORE", {
        request: input.request.slice(0, 200),
        uncertaintyEnvelope: input.uncertaintyEnvelope,
        hash,
        durationMs,
      });

      return {
        stored: true,
        key,
        hash,
        ttlSeconds: DEFAULT_TTL_SECONDS,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Scan Redis for keys matching a given prefix.
 * Uses SCAN to avoid blocking on large keyspaces.
 */
async function scanKeys(cacheClient: CacheClient, prefix: string): Promise<string[]> {
  const results: string[] = [];
  let cursor = "0";
  const maxIterations = 100; // safety limit
  let iterations = 0;

  do {
    const [nextCursor, keys] = await cacheClient.redis.scan(
      cursor,
      "MATCH",
      `${prefix}*`,
      "COUNT",
      100
    );
    cursor = nextCursor;
    results.push(...keys);
    iterations++;
  } while (cursor !== "0" && iterations < maxIterations);

  return results;
}

/**
 * Log a cache event to the audit system.
 * Failures in audit logging are caught and logged to stderr
 * to avoid breaking cache operations.
 */
async function logCacheEvent(
  agentId: string,
  actionType: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const auditLogger = await getAudit();
    await auditLogger.log({
      agentId,
      agentType: "SEMANTIC_CACHE",
      actionType,
      status: "SUCCESS",
      durationMs: (details.durationMs as number) ?? 0,
      inputs: details,
    });
  } catch (_err) {
    // Audit logging failure should not break cache operations
    process.stderr.write(
      `[semantic-cache-mcp] Audit log failed: ${_err instanceof Error ? _err.message : String(_err)}\n`
    );
  }
}
