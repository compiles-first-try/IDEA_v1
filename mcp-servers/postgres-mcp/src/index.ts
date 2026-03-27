/**
 * PostgreSQL MCP Server
 *
 * Wraps the RSF foundation PostgreSQL client as an MCP tool server.
 * Enforces Rule 11: no SELECT * queries.
 * Includes schema_version in all responses.
 * Provides audit-aware query and write tools.
 */
import { z } from "zod";
import { createDbClient, runMigrations, type DbClient } from "../../../packages/foundation/src/db/index.js";
import { createAuditLogger, type AuditLogger } from "../../../packages/foundation/src/audit/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_VERSION = "2";

// ── Tool Input Schemas ──

const QueryInputSchema = z.object({
  sql: z.string().min(1),
  params: z.array(z.unknown()).optional().default([]),
});

const AuditQueryInputSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(20),
  offset: z.number().int().min(0).default(0),
  agentId: z.string().optional(),
  actionType: z.string().optional(),
  status: z.string().optional(),
});

const WriteAuditInputSchema = z.object({
  agentId: z.string().min(1),
  agentType: z.string().min(1),
  actionType: z.string().min(1),
  status: z.enum(["SUCCESS", "FAILURE", "KILLED", "TIMEOUT"]),
  durationMs: z.number().int().min(0),
  phase: z.string().optional(),
  inputs: z.record(z.unknown()).optional(),
  outputs: z.record(z.unknown()).optional(),
  modelUsed: z.string().optional(),
  tokensIn: z.number().int().optional(),
  tokensOut: z.number().int().optional(),
  costUsd: z.number().optional(),
  errorMessage: z.string().optional(),
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
      name: "query",
      description: "Execute a read-only SQL query. SELECT * is REJECTED (Rule 11). Always name columns explicitly.",
      inputSchema: QueryInputSchema,
    },
    {
      name: "query-audit-events",
      description: "Query the agent_events audit table with optional filtering by agent, action, or status.",
      inputSchema: AuditQueryInputSchema,
    },
    {
      name: "write-audit-event",
      description: "Record an audit event to both PostgreSQL and JSONL (dual-write, append-only).",
      inputSchema: WriteAuditInputSchema,
    },
  ];
}

// ── Singleton connections ──

let db: DbClient | null = null;
let audit: AuditLogger | null = null;

async function getDb(): Promise<DbClient> {
  if (!db) {
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
  }
  return db;
}

async function getAudit(): Promise<AuditLogger> {
  if (!audit) {
    const dbInstance = await getDb();
    const { createAuditLogger: createAL } = await import(
      "../../../packages/foundation/src/audit/index.js"
    );
    audit = await createAL({
      db: dbInstance,
      logPath: path.resolve(__dirname, "../../../logs/audit.jsonl"),
    });
  }
  return audit;
}

// ── Tool Execution ──

export async function executeTool(
  toolName: string,
  rawInput: unknown
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "query": {
      const input = QueryInputSchema.parse(rawInput);

      // Rule 11 enforcement: reject SELECT *
      if (/SELECT\s+\*/i.test(input.sql)) {
        throw new Error(
          "SELECT * is prohibited (Rule 11: CDC-readiness). Name columns explicitly."
        );
      }

      // Block write operations via the query tool
      if (/^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)/i.test(input.sql)) {
        throw new Error(
          "Write operations are not allowed via the query tool. Use write-audit-event for audit writes."
        );
      }

      const dbInstance = await getDb();
      const result = await dbInstance.query(input.sql, input.params as unknown[]);
      return { rows: result.rows, rowCount: result.rowCount, schema_version: SCHEMA_VERSION };
    }

    case "query-audit-events": {
      const input = AuditQueryInputSchema.parse(rawInput);
      const dbInstance = await getDb();

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (input.agentId) { conditions.push(`agent_id = $${idx++}`); params.push(input.agentId); }
      if (input.actionType) { conditions.push(`action_type = $${idx++}`); params.push(input.actionType); }
      if (input.status) { conditions.push(`status = $${idx++}`); params.push(input.status); }

      // Rule 11: explicit column list
      let sql = `SELECT event_id, timestamp, agent_id, agent_type, action_type, phase,
                        status, model_used, tokens_in, tokens_out, cost_usd, duration_ms,
                        error_message, workload_id, reasoning_trace,
                        context_utilization_pct, router_classification_reason
                 FROM agent_events`;

      if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
      sql += ` ORDER BY timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(input.limit, input.offset);

      const result = await dbInstance.query(sql, params);
      return { events: result.rows, count: result.rowCount, schema_version: SCHEMA_VERSION };
    }

    case "write-audit-event": {
      const input = WriteAuditInputSchema.parse(rawInput);
      const auditLogger = await getAudit();

      const result = await auditLogger.log({
        agentId: input.agentId,
        agentType: input.agentType,
        actionType: input.actionType,
        status: input.status,
        durationMs: input.durationMs,
        phase: input.phase,
        inputs: input.inputs,
        outputs: input.outputs,
        modelUsed: input.modelUsed,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        costUsd: input.costUsd,
        errorMessage: input.errorMessage,
      });

      return { eventId: result.eventId, timestamp: result.timestamp, schema_version: SCHEMA_VERSION };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
