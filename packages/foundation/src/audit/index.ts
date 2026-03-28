import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pino from "pino";
import type { DbClient } from "../db/index.js";

const MAX_FIELD_BYTES = 10_240; // 10KB

export interface AuditEvent {
  agentId: string;
  agentType: string;
  actionType: string;
  phase?: string;
  sessionId?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  modelUsed?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  durationMs: number;
  status: "SUCCESS" | "FAILURE" | "KILLED" | "TIMEOUT";
  errorMessage?: string;
  parentEventId?: string;
  reasoningTrace?: string;
}

export interface AuditResult {
  eventId: string;
  timestamp: string;
}

export interface AuditLogger {
  log: (event: AuditEvent) => Promise<AuditResult>;
}

interface AuditLoggerOptions {
  db: DbClient;
  logPath: string;
}

function truncateJson(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj) return obj;
  const str = JSON.stringify(obj);
  if (str.length <= MAX_FIELD_BYTES) return obj;
  return { _truncated: true, _original_bytes: str.length, summary: str.slice(0, MAX_FIELD_BYTES - 100) };
}

/**
 * Create a dual-write audit logger that writes to both a JSONL file
 * and the PostgreSQL agent_events table atomically.
 */
export async function createAuditLogger(
  options: AuditLoggerOptions
): Promise<AuditLogger> {
  const { db, logPath } = options;

  // Ensure log directory exists
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return {
    async log(event: AuditEvent): Promise<AuditResult> {
      const eventId = randomUUID();
      const timestamp = new Date().toISOString();

      const record = {
        event_id: eventId,
        timestamp,
        agent_id: event.agentId,
        agent_type: event.agentType,
        action_type: event.actionType,
        phase: event.phase ?? null,
        session_id: event.sessionId ?? null,
        inputs: truncateJson(event.inputs) ?? null,
        outputs: truncateJson(event.outputs) ?? null,
        model_used: event.modelUsed ?? null,
        tokens_in: event.tokensIn ?? null,
        tokens_out: event.tokensOut ?? null,
        cost_usd: event.costUsd ?? null,
        duration_ms: event.durationMs,
        status: event.status,
        error_message: event.errorMessage ?? null,
        parent_event_id: event.parentEventId ?? null,
        reasoning_trace: event.reasoningTrace ?? null,
      };

      // Atomic dual-write: PostgreSQL transaction + JSONL append
      try {
        await db.query("BEGIN");

        await db.query(
          `INSERT INTO agent_events
            (event_id, timestamp, agent_id, agent_type, action_type, phase,
             session_id, inputs, outputs, model_used, tokens_in, tokens_out,
             cost_usd, duration_ms, status, error_message, parent_event_id,
             reasoning_trace)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
            record.event_id,
            record.timestamp,
            record.agent_id,
            record.agent_type,
            record.action_type,
            record.phase,
            record.session_id,
            record.inputs ? JSON.stringify(record.inputs) : null,
            record.outputs ? JSON.stringify(record.outputs) : null,
            record.model_used,
            record.tokens_in,
            record.tokens_out,
            record.cost_usd,
            record.duration_ms,
            record.status,
            record.error_message,
            record.parent_event_id,
            record.reasoning_trace,
          ]
        );

        fs.appendFileSync(logPath, JSON.stringify(record) + "\n");

        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK").catch(() => {});
        throw error;
      }

      return { eventId, timestamp };
    },
  };
}

/**
 * Create a structured Pino JSON logger for a named component.
 */
export function createLogger(component: string): pino.Logger {
  return pino({
    name: component,
    level: process.env.LOG_LEVEL ?? "info",
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
