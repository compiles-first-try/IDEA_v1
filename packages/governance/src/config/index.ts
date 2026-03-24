import { z } from "zod";
import type { CacheClient, AuditLogger } from "@rsf/foundation";

const CONFIG_PREFIX = "rsf:config:";

const ConfigSchema = z.object({
  maxDailySpendUsd: z.number().positive().default(10),
  pauseThresholdUsd: z.number().positive().default(20),
  autonomyLevel: z.enum(["autonomous", "supervised", "manual"]).default("supervised"),
  improvementAutoTrigger: z.boolean().default(false),
});

const ConfigUpdateSchema = z.object({
  maxDailySpendUsd: z.number().positive().optional(),
  pauseThresholdUsd: z.number().positive().optional(),
  autonomyLevel: z.enum(["autonomous", "supervised", "manual"]).optional(),
  improvementAutoTrigger: z.boolean().optional(),
});

export type RuntimeConfig = z.infer<typeof ConfigSchema>;
export type ConfigUpdate = z.input<typeof ConfigUpdateSchema>;

interface ConfigManagerDeps {
  cache: CacheClient;
  auditLogger: AuditLogger;
}

export interface ConfigManager {
  getAll: () => Promise<RuntimeConfig>;
  update: (changes: ConfigUpdate) => Promise<RuntimeConfig>;
}

const FIELDS: (keyof RuntimeConfig)[] = [
  "maxDailySpendUsd",
  "pauseThresholdUsd",
  "autonomyLevel",
  "improvementAutoTrigger",
];

const DEFAULTS: RuntimeConfig = {
  maxDailySpendUsd: 10,
  pauseThresholdUsd: 20,
  autonomyLevel: "supervised",
  improvementAutoTrigger: false,
};

/**
 * Create a configuration manager that validates changes with Zod
 * and persists to Redis.
 */
export function createConfigManager(deps: ConfigManagerDeps): ConfigManager {
  const { cache, auditLogger } = deps;

  async function getAll(): Promise<RuntimeConfig> {
    const values: Record<string, unknown> = {};

    for (const field of FIELDS) {
      const raw = await cache.get(`${CONFIG_PREFIX}${field}`);
      if (raw !== null) {
        if (field === "maxDailySpendUsd" || field === "pauseThresholdUsd") {
          values[field] = parseFloat(raw);
        } else if (field === "improvementAutoTrigger") {
          values[field] = raw === "true";
        } else {
          values[field] = raw;
        }
      }
    }

    return ConfigSchema.parse({ ...DEFAULTS, ...values });
  }

  async function update(changes: ConfigUpdate): Promise<RuntimeConfig> {
    // Validate the update
    const validated = ConfigUpdateSchema.parse(changes);

    // Persist each changed field
    for (const [key, value] of Object.entries(validated)) {
      if (value !== undefined) {
        await cache.set(`${CONFIG_PREFIX}${key}`, String(value));
      }
    }

    await auditLogger.log({
      agentId: "config-manager",
      agentType: "GOVERNANCE",
      actionType: "CONFIG_UPDATE",
      phase: "GOVERNANCE",
      inputs: validated as Record<string, unknown>,
      status: "SUCCESS",
      durationMs: 0,
    });

    return getAll();
  }

  return { getAll, update };
}
