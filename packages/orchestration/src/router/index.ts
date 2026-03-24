import type { CacheClient } from "@rsf/foundation";

export type TaskComplexity = "TRIVIAL" | "STANDARD" | "COMPLEX" | "CRITICAL";

export interface ModelResolution {
  provider: "ollama" | "anthropic";
  model: string;
  maxTokens: number;
}

export interface ModelRouter {
  /** Classify a task description into a complexity tier */
  classify: (description: string, override?: TaskComplexity) => TaskComplexity;
  /** Resolve the model for a given tier, respecting spend guardrails */
  resolveModel: (tier: TaskComplexity, dailySpend?: number) => ModelResolution;
  /** Record a cloud API spend amount */
  recordSpend: (amountUsd: number) => Promise<void>;
  /** Get the current daily spend */
  getDailySpend: () => Promise<number>;
}

interface ModelRouterDeps {
  cache: CacheClient;
  maxDailySpendUsd: number;
  pauseThresholdUsd: number;
  ollamaBaseUrl: string;
}

const SPEND_KEY = "rsf:daily-spend";

const MODEL_MAP: Record<TaskComplexity, ModelResolution> = {
  TRIVIAL: { provider: "ollama", model: "llama3.3:8b", maxTokens: 512 },
  STANDARD: { provider: "ollama", model: "qwen2.5-coder:14b", maxTokens: 2048 },
  COMPLEX: { provider: "anthropic", model: "claude-haiku-4-5-20251001", maxTokens: 8192 },
  CRITICAL: { provider: "anthropic", model: "claude-sonnet-4-6-20250514", maxTokens: 32768 },
};

// Keyword-based classification heuristic
const CRITICAL_PATTERNS = [
  /architect/i, /self-improvement/i, /security review/i, /formal spec/i,
  /agent blueprint/i, /foundry.*infrastructure/i, /improvement propos/i,
];
const COMPLEX_PATTERNS = [
  /multi-file/i, /integration/i, /debug/i, /REST API/i, /authentication/i,
  /generate.*(?:api|service|module)/i, /refactor/i,
];
const STANDARD_PATTERNS = [
  /function/i, /write.*(?:code|test|doc)/i, /implement/i, /single/i,
  /sort/i, /parse/i, /convert/i, /calculate/i,
];
// Everything else defaults to TRIVIAL

/**
 * Create a difficulty-aware model router.
 * Classifies tasks → selects model → enforces spend guardrails.
 */
export async function createModelRouter(
  deps: ModelRouterDeps
): Promise<ModelRouter> {
  const { cache, maxDailySpendUsd, pauseThresholdUsd } = deps;

  function classify(
    description: string,
    override?: TaskComplexity
  ): TaskComplexity {
    if (override) return override;

    if (CRITICAL_PATTERNS.some((p) => p.test(description))) return "CRITICAL";
    if (COMPLEX_PATTERNS.some((p) => p.test(description))) return "COMPLEX";
    if (STANDARD_PATTERNS.some((p) => p.test(description))) return "STANDARD";
    return "TRIVIAL";
  }

  function resolveModel(
    tier: TaskComplexity,
    dailySpend?: number
  ): ModelResolution {
    const spend = dailySpend ?? 0;

    // Guardrail: if over pause threshold, force all cloud calls to local
    if (spend > pauseThresholdUsd && MODEL_MAP[tier].provider === "anthropic") {
      return { ...MODEL_MAP.STANDARD, maxTokens: MODEL_MAP[tier].maxTokens };
    }

    // Guardrail: if over max daily spend, escalate COMPLEX to CRITICAL-only
    if (spend > maxDailySpendUsd && tier === "COMPLEX") {
      return MODEL_MAP.CRITICAL;
    }

    return MODEL_MAP[tier];
  }

  async function recordSpend(amountUsd: number): Promise<void> {
    await cache.incrByFloat(SPEND_KEY, amountUsd);
  }

  async function getDailySpend(): Promise<number> {
    const raw = await cache.get(SPEND_KEY);
    return raw ? parseFloat(raw) : 0;
  }

  return { classify, resolveModel, recordSpend, getDailySpend };
}
