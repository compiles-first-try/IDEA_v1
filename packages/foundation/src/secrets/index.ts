import { z } from "zod";

/**
 * Configuration schema validated with Zod.
 * All secrets come from environment variables — never hardcoded.
 */
const configSchema = z.object({
  postgresUrl: z.string().min(1),
  redisUrl: z.string().min(1),
  temporalAddress: z.string().min(1),
  ollamaBaseUrl: z.string().url(),
  anthropicApiKey: z.string().optional(),
  foundryKill: z.boolean().default(false),
  maxDailyCloudSpendUsd: z.number().positive().default(10),
  auditLogPath: z.string().min(1),
  jaegerEndpoint: z.string().optional(),
  otelServiceName: z.string().default("rsf"),
  logLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type AppConfig = z.infer<typeof configSchema>;

const REQUIRED_VARS = [
  "POSTGRES_URL",
  "REDIS_URL",
  "TEMPORAL_ADDRESS",
  "OLLAMA_BASE_URL",
  "AUDIT_LOG_PATH",
] as const;

/**
 * Load and validate configuration from environment variables.
 *
 * - Validates all required vars are present
 * - Never exposes secret values in error messages
 * - Parses boolean and numeric values from strings
 *
 * @throws {Error} if required variables are missing or validation fails
 */
export function loadConfig(): AppConfig {
  // Check required vars first — report names only, never values
  const missing = REQUIRED_VARS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === ""
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Set them in .env or export them before starting.`
    );
  }

  const raw = {
    postgresUrl: process.env.POSTGRES_URL!,
    redisUrl: process.env.REDIS_URL!,
    temporalAddress: process.env.TEMPORAL_ADDRESS!,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL!,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    foundryKill: process.env.FOUNDRY_KILL === "1" || process.env.FOUNDRY_KILL === "true",
    maxDailyCloudSpendUsd: process.env.MAX_DAILY_CLOUD_SPEND_USD
      ? Number(process.env.MAX_DAILY_CLOUD_SPEND_USD)
      : 10,
    auditLogPath: process.env.AUDIT_LOG_PATH!,
    jaegerEndpoint: process.env.JAEGER_ENDPOINT || undefined,
    otelServiceName: process.env.OTEL_SERVICE_NAME || "rsf",
    logLevel: (process.env.LOG_LEVEL as AppConfig["logLevel"]) || "info",
  };

  return configSchema.parse(raw);
}
