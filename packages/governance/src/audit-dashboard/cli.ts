#!/usr/bin/env tsx
/**
 * CLI Audit Log Viewer
 * Usage: tsx src/audit-dashboard/cli.ts [--limit N] [--agent ID] [--action TYPE] [--status S] [--stats]
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createDbClient, runMigrations } from "../../../foundation/src/db/index.js";
import { createAuditViewer } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = "true";
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const limit = parseInt(args.limit ?? "20", 10);
  const agentId = args.agent;
  const actionType = args.action;
  const status = args.status;
  const showStats = args.stats === "true";

  const db = await createDbClient(process.env.POSTGRES_URL!);
  await runMigrations(db, path.resolve(__dirname, "../../../../db/migrations"));
  const viewer = createAuditViewer({ db });

  if (showStats) {
    const stats = await viewer.getStats();
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║         AUDIT LOG — STATISTICS               ║");
    console.log("╚══════════════════════════════════════════════╝\n");
    console.log(`  Total events:    ${stats.totalEvents}`);
    console.log(`  Unique agents:   ${stats.uniqueAgents}`);
    console.log(`  Success rate:    ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`  Avg duration:    ${stats.avgDurationMs.toFixed(0)}ms`);
    console.log("");
  }

  const report = await viewer.formatReport({ limit, agentId, actionType, status });
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║         AUDIT LOG — RECENT EVENTS            ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  console.log(report);

  // Also print a detailed table with timestamps
  const { events } = await viewer.query({ limit, agentId, actionType, status });
  if (events.length > 0) {
    console.log("\n  Detailed view:\n");
    for (const e of events) {
      const ts = new Date(e.timestamp).toISOString();
      const dur = e.duration_ms !== null ? `${e.duration_ms}ms` : "—";
      const model = e.model_used ?? "—";
      const tokens = (e.tokens_in ?? 0) + (e.tokens_out ?? 0) > 0
        ? `${e.tokens_in ?? 0}→${e.tokens_out ?? 0} tokens`
        : "";
      const cost = e.cost_usd && e.cost_usd > 0 ? `$${e.cost_usd}` : "";
      const err = e.error_message ? ` ERR: ${e.error_message.slice(0, 60)}` : "";

      console.log(`  ${ts}  ${e.status.padEnd(8)}  ${e.agent_id}`);
      console.log(`    ${e.action_type}  model=${model}  dur=${dur}  ${tokens}  ${cost}${err}`);
      if (e.phase) console.log(`    phase=${e.phase}`);
      console.log("");
    }
  }

  await db.disconnect();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
