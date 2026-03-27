/**
 * Redis MCP Server
 *
 * Wraps the RSF foundation Redis cache client as an MCP tool server.
 * Provides key-value operations, JSON helpers, kill-switch check,
 * and daily spend tracking for the model router budget guardrail.
 */
import { z } from "zod";
import { createCacheClient, type CacheClient } from "../../../packages/foundation/src/cache/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ── Tool Input Schemas ──

const GetInputSchema = z.object({
  key: z.string().min(1),
});

const SetInputSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  ttlSeconds: z.number().int().positive().optional(),
});

const GetJsonInputSchema = z.object({
  key: z.string().min(1),
});

const SetJsonInputSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  ttlSeconds: z.number().int().positive().optional(),
});

const DeleteInputSchema = z.object({
  key: z.string().min(1),
});

const CheckKillSwitchInputSchema = z.object({});

const GetDailySpendInputSchema = z.object({});

const IncrementSpendInputSchema = z.object({
  amount: z.number().positive(),
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
      name: "get",
      description: "Get a string value by key from Redis.",
      inputSchema: GetInputSchema,
    },
    {
      name: "set",
      description: "Set a string value in Redis with optional TTL in seconds.",
      inputSchema: SetInputSchema,
    },
    {
      name: "get-json",
      description: "Get a JSON-parsed value by key from Redis.",
      inputSchema: GetJsonInputSchema,
    },
    {
      name: "set-json",
      description: "Set a JSON-serialized value in Redis with optional TTL in seconds.",
      inputSchema: SetJsonInputSchema,
    },
    {
      name: "delete",
      description: "Delete a key from Redis.",
      inputSchema: DeleteInputSchema,
    },
    {
      name: "check-kill-switch",
      description: "Check if the global kill switch is active. Reads rsf:kill:global from Redis and returns boolean.",
      inputSchema: CheckKillSwitchInputSchema,
    },
    {
      name: "get-daily-spend",
      description: "Get the current daily cloud spend in USD. Reads rsf:spend:daily:{YYYY-MM-DD} from Redis.",
      inputSchema: GetDailySpendInputSchema,
    },
    {
      name: "increment-spend",
      description: "Increment the daily cloud spend by a given USD amount. Uses atomic INCRBYFLOAT with auto-expiry at midnight.",
      inputSchema: IncrementSpendInputSchema,
    },
  ];
}

// ── Singleton connection ──

let cache: CacheClient | null = null;

async function getCache(): Promise<CacheClient> {
  if (!cache) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }
    cache = await createCacheClient(redisUrl);
  }
  return cache;
}

// ── Helpers ──

function todayKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `rsf:spend:daily:${yyyy}-${mm}-${dd}`;
}

// ── Tool Execution ──

export async function executeTool(
  toolName: string,
  rawInput: unknown
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "get": {
      const input = GetInputSchema.parse(rawInput);
      const client = await getCache();
      const value = await client.get(input.key);
      return { key: input.key, value, exists: value !== null };
    }

    case "set": {
      const input = SetInputSchema.parse(rawInput);
      const client = await getCache();
      await client.set(input.key, input.value, input.ttlSeconds);
      return { key: input.key, success: true };
    }

    case "get-json": {
      const input = GetJsonInputSchema.parse(rawInput);
      const client = await getCache();
      const value = await client.getJson(input.key);
      return { key: input.key, value, exists: value !== null };
    }

    case "set-json": {
      const input = SetJsonInputSchema.parse(rawInput);
      const client = await getCache();
      await client.setJson(input.key, input.value, input.ttlSeconds);
      return { key: input.key, success: true };
    }

    case "delete": {
      const input = DeleteInputSchema.parse(rawInput);
      const client = await getCache();
      await client.del(input.key);
      return { key: input.key, deleted: true };
    }

    case "check-kill-switch": {
      CheckKillSwitchInputSchema.parse(rawInput);
      const client = await getCache();
      const value = await client.get("rsf:kill:global");
      const active = value === "1";
      return { active, rawValue: value };
    }

    case "get-daily-spend": {
      GetDailySpendInputSchema.parse(rawInput);
      const client = await getCache();
      const key = todayKey();
      const raw = await client.get(key);
      const spendUsd = raw !== null ? parseFloat(raw) : 0;
      return { key, spendUsd };
    }

    case "increment-spend": {
      const input = IncrementSpendInputSchema.parse(rawInput);
      const client = await getCache();
      const key = todayKey();
      const newTotal = await client.incrByFloat(key, input.amount);

      // Set TTL to expire at end of UTC day if not already set
      const ttl = await client.redis.ttl(key);
      if (ttl === -1) {
        // No expiry set yet — calculate seconds until midnight UTC
        const now = new Date();
        const midnight = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0, 0, 0
        ));
        const secondsUntilMidnight = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
        await client.redis.expire(key, secondsUntilMidnight);
      }

      return { key, spendUsd: newTotal, incrementedBy: input.amount };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
