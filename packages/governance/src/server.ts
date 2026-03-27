#!/usr/bin/env tsx
/**
 * Governance API Server — starts on port 3000.
 *
 * Boots: Express REST API + WebSocket audit stream.
 * Connects to: PostgreSQL, Redis (from .env).
 * Optionally: V2 Pipeline for real build execution.
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve .env from the project root (3 levels up from src/)
const envPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });

import { createDbClient, runMigrations } from "../../foundation/src/db/index.js";
import { createCacheClient } from "../../foundation/src/cache/index.js";
import { createAuditLogger } from "../../foundation/src/audit/index.js";
import { createGovernanceApi } from "./api/index.js";
import { attachAuditStream } from "./api/ws-audit-stream.js";

const PORT = parseInt(process.env.GOVERNANCE_PORT ?? "3000", 10);

async function main() {
  console.log("[governance] Connecting to infrastructure...");

  const db = await createDbClient(process.env.POSTGRES_URL!);
  await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
  const cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
  const auditLogger = await createAuditLogger({
    db,
    logPath: path.resolve(__dirname, "../../../logs/audit.jsonl"),
  });

  console.log("[governance] Infrastructure connected.");

  // Attempt to initialize V2 Pipeline (optional — falls back to simulation if unavailable)
  let v2Pipeline;
  try {
    const { createV2Pipeline } = await import("../../v2-pipeline/src/index.js");
    v2Pipeline = await createV2Pipeline({
      postgresUrl: process.env.POSTGRES_URL!,
      redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
      ollamaBaseUrl: process.env.OLLAMA_HOST ?? "http://localhost:11434",
      migrationsDir: path.resolve(__dirname, "../../../db/migrations"),
      auditLogPath: path.resolve(__dirname, "../../../logs/audit.jsonl"),
    });
    console.log("[governance] V2 Pipeline initialized — builds will use real pipeline.");
  } catch (err) {
    console.log("[governance] V2 Pipeline not available — builds will use simulation.", err instanceof Error ? err.message : "");
  }

  const app = createGovernanceApi({ cache, db, auditLogger, v2Pipeline });
  const httpServer = createServer(app);

  // Attach WebSocket audit stream
  attachAuditStream({
    httpServer,
    postgresUrl: process.env.POSTGRES_URL!,
  });

  httpServer.listen(PORT, () => {
    console.log(`[governance] REST API listening on http://localhost:${PORT}`);
    console.log(`[governance] WebSocket audit stream at ws://localhost:${PORT}/audit-stream`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[governance] Shutting down...");
    httpServer.close();
    if (v2Pipeline) await v2Pipeline.shutdown();
    await cache.disconnect();
    await db.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[governance] Fatal:", err);
  process.exit(1);
});
