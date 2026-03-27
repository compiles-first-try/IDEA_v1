/**
 * Audit MCP Server
 *
 * Wraps the RSF foundation audit logger as an MCP tool server.
 * Provides dual-write event logging (PostgreSQL + JSONL) and querying
 * of recent audit events. This is the primary audit interface for workflows.
 */
import { z } from "zod";
import { createAuditLogger, type AuditLogger } from "../../../packages/foundation/src/audit/index.js";
import { createDbClient, runMigrations, type DbClient } from "../../../packages/foundation/src/db/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ── Tool Input Schemas ──

const LogEventInputSchema = z.object({
  agentId: z.string().min(1),
  agentType: z.string().min(1),
  actionType: z.enum([
    "LLM_CALL", "TOOL_CALL", "CODE_EXECUTE", "TEST_RUN",
    "DECISION", "KILL_SWITCH", "ERROR",
  ]),
  status: z.enum(["SUCCESS", "FAILURE", "KILLED", "TIMEOUT"]),
  durationMs: z.number().int().min(0),
  phase: z.string().optional(),
  sessionId: z.string().optional(),
  inputs: z.record(z.unknown()).optional(),
  outputs: z.record(z.unknown()).optional(),
  modelUsed: z.string().optional(),
  tokensIn: z.number().int().min(0).optional(),
  tokensOut: z.number().int().min(0).optional(),
  costUsd: z.number().min(0).optional(),
  errorMessage: z.string().optional(),
  parentEventId: z.string().optional(),
});

const QueryRecentInputSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional().default(20),
  agentId: z.string().optional(),
  actionType: z.string().optional(),
  status: z.string().optional(),
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
      name: "log-event",
      description:
        "Log an audit event with dual-write to both PostgreSQL agent_events table and JSONL file. " +
        "Both writes succeed atomically. This is the primary way to record agent actions.",
      inputSchema: LogEventInputSchema,
    },
    {
      name: "query-recent",
      description:
        "Query the most recent N audit events from PostgreSQL, optionally filtered by agent, action type, or status. " +
        "Returns events sorted by timestamp descending.",
      inputSchema: QueryRecentInputSchema,
    },
  ];
}

// ── Singleton connections ──

let db: DbClient | null = null;
let audit: AuditLogger | null = null;

async function getDb(): Promise<DbClient> {
  if (!db) {
    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
      throw new Error("POSTGRES_URL environment variable is not set");
    }
    db = await createDbClient(postgresUrl);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
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

// ── Tool Execution ──

export async function executeTool(
  toolName: string,
  rawInput: unknown
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "log-event": {
      const input = LogEventInputSchema.parse(rawInput);
      const auditLogger = await getAudit();

      const result = await auditLogger.log({
        agentId: input.agentId,
        agentType: input.agentType,
        actionType: input.actionType,
        status: input.status,
        durationMs: input.durationMs,
        phase: input.phase,
        sessionId: input.sessionId,
        inputs: input.inputs,
        outputs: input.outputs,
        modelUsed: input.modelUsed,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        costUsd: input.costUsd,
        errorMessage: input.errorMessage,
        parentEventId: input.parentEventId,
      });

      return { eventId: result.eventId, timestamp: result.timestamp };
    }

    case "query-recent": {
      const input = QueryRecentInputSchema.parse(rawInput);
      const dbInstance = await getDb();

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (input.agentId) {
        conditions.push(`agent_id = $${idx++}`);
        params.push(input.agentId);
      }
      if (input.actionType) {
        conditions.push(`action_type = $${idx++}`);
        params.push(input.actionType);
      }
      if (input.status) {
        conditions.push(`status = $${idx++}`);
        params.push(input.status);
      }

      // Explicit column list — no SELECT *
      let sql = `SELECT event_id, timestamp, agent_id, agent_type, action_type, phase,
                        session_id, status, model_used, tokens_in, tokens_out, cost_usd,
                        duration_ms, error_message, parent_event_id
                 FROM agent_events`;

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }
      sql += ` ORDER BY timestamp DESC LIMIT $${idx++}`;
      params.push(input.limit);

      const result = await dbInstance.query(sql, params);
      return { events: result.rows, count: result.rowCount };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
