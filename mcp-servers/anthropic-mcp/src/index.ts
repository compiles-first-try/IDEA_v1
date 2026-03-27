/**
 * Anthropic MCP Server
 *
 * Wraps the Anthropic SDK for cloud LLM inference as an MCP tool server.
 * Enforces spend limit checking via Redis before each call.
 * Tracks cost per call based on model pricing.
 */
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createCacheClient, type CacheClient } from "../../../packages/foundation/src/cache/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ── Pricing (per 1M tokens, USD) ──

const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-sonnet-4-20250514": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-haiku-3-5": { inputPer1M: 0.25, outputPer1M: 1.25 },
  "claude-3-5-haiku-20241022": { inputPer1M: 0.25, outputPer1M: 1.25 },
};

const DEFAULT_PRICING = { inputPer1M: 3.0, outputPer1M: 15.0 };

// ── Tool Input Schemas ──

const GenerateInputSchema = z.object({
  model: z.string().min(1)
    .default("claude-sonnet-4-6")
    .describe("Anthropic model name, e.g. 'claude-sonnet-4-6' or 'claude-haiku-3-5'"),
  prompt: z.string().min(1).describe("The user prompt to send to the model"),
  system: z.string().optional().describe("Optional system prompt"),
  maxTokens: z.number().int().positive().max(32768).optional()
    .default(4096)
    .describe("Maximum tokens to generate (default 4096)"),
  temperature: z.number().min(0).max(1).optional()
    .default(0.7)
    .describe("Sampling temperature (0-1, default 0.7)"),
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
      name: "generate",
      description:
        "Generate text using an Anthropic cloud model. " +
        "Enforces daily spend limits via Redis before each call. " +
        "Returns the response with cost tracking for audit logging.",
      inputSchema: GenerateInputSchema,
    },
  ];
}

// ── Singletons ──

let anthropicClient: Anthropic | null = null;
let cacheClient: CacheClient | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

async function getCache(): Promise<CacheClient> {
  if (!cacheClient) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }
    cacheClient = await createCacheClient(redisUrl);
  }
  return cacheClient;
}

// ── Helpers ──

function todaySpendKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `rsf:spend:daily:${yyyy}-${mm}-${dd}`;
}

function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  return (tokensIn / 1_000_000) * pricing.inputPer1M +
         (tokensOut / 1_000_000) * pricing.outputPer1M;
}

// ── Tool Execution ──

export async function executeTool(
  toolName: string,
  rawInput: unknown
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "generate": {
      const input = GenerateInputSchema.parse(rawInput);

      // Check spend limit before making the call
      const cache = await getCache();
      const spendKey = todaySpendKey();
      const currentSpendRaw = await cache.get(spendKey);
      const currentSpend = currentSpendRaw !== null ? parseFloat(currentSpendRaw) : 0;

      const maxDailySpend = parseFloat(process.env.MAX_DAILY_CLOUD_SPEND_USD ?? "10");

      if (currentSpend >= maxDailySpend) {
        throw new Error(
          `Daily cloud spend limit reached: $${currentSpend.toFixed(4)} >= $${maxDailySpend.toFixed(2)}. ` +
          `Refusing to make cloud API call. Adjust MAX_DAILY_CLOUD_SPEND_USD to increase limit.`
        );
      }

      const anthropic = getAnthropic();
      const startMs = Date.now();

      const response = await anthropic.messages.create({
        model: input.model,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
      });

      const durationMs = Date.now() - startMs;

      const tokensIn = response.usage.input_tokens;
      const tokensOut = response.usage.output_tokens;
      const costUsd = calculateCost(input.model, tokensIn, tokensOut);

      // Increment daily spend in Redis
      const newTotal = await cache.incrByFloat(spendKey, costUsd);

      // Set TTL to expire at end of UTC day if not already set
      const ttl = await cache.redis.ttl(spendKey);
      if (ttl === -1) {
        const now = new Date();
        const midnight = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0, 0, 0
        ));
        const secondsUntilMidnight = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
        await cache.redis.expire(spendKey, secondsUntilMidnight);
      }

      // Extract text from content blocks
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        response: textContent,
        model: response.model,
        tokensIn,
        tokensOut,
        totalTokens: tokensIn + tokensOut,
        costUsd,
        dailySpendUsd: newTotal,
        durationMs,
        stopReason: response.stop_reason,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
