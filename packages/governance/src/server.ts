#!/usr/bin/env tsx
/**
 * Governance API Server — starts on port 3000.
 *
 * Boots: Express REST API + WebSocket audit stream.
 * Connects to: PostgreSQL, Redis (from .env).
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

  const app = createGovernanceApi({ cache, db, auditLogger });
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
