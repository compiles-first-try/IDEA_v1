import type { DbClient } from "@rsf/foundation";

interface AuditEvent {
  id: number;
  event_id: string;
  timestamp: Date;
  agent_id: string;
  agent_type: string;
  action_type: string;
  phase: string | null;
  status: string;
  model_used: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  error_message: string | null;
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  agentId?: string;
  actionType?: string;
  status?: string;
}

interface QueryResult {
  events: AuditEvent[];
  count: number;
}

interface AuditStats {
  totalEvents: number;
  uniqueAgents: number;
  successRate: number;
  avgDurationMs: number;
}

export interface AuditViewer {
  query: (opts: QueryOptions) => Promise<QueryResult>;
  formatReport: (opts: QueryOptions) => Promise<string>;
  getStats: () => Promise<AuditStats>;
}

interface AuditViewerDeps {
  db: DbClient;
}

/**
 * Create an audit log viewer that queries agent_events
 * and formats results as a readable CLI report.
 */
export function createAuditViewer(deps: AuditViewerDeps): AuditViewer {
  const { db } = deps;

  async function query(opts: QueryOptions): Promise<QueryResult> {
    const { limit = 20, offset = 0, agentId, actionType, status } = opts;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (agentId) { conditions.push(`agent_id = $${idx++}`); params.push(agentId); }
    if (actionType) { conditions.push(`action_type = $${idx++}`); params.push(actionType); }
    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }

    let sql = "SELECT * FROM agent_events";
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
    sql += ` ORDER BY timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await db.query<AuditEvent>(sql, params);
    return { events: result.rows, count: result.rows.length };
  }

  async function formatReport(opts: QueryOptions): Promise<string> {
    const { events } = await query(opts);

    if (events.length === 0) {
      return "No events found matching the criteria.";
    }

    const lines: string[] = [];
    lines.push("┌──────────────────────────────────────────────────────────────────┐");
    lines.push("│  Agent              Action            Status    Duration  Model  │");
    lines.push("├──────────────────────────────────────────────────────────────────┤");

    for (const e of events) {
      const agent = e.agent_id.padEnd(18).slice(0, 18);
      const action = e.action_type.padEnd(16).slice(0, 16);
      const status = e.status.padEnd(8).slice(0, 8);
      const dur = e.duration_ms !== null ? `${e.duration_ms}ms`.padEnd(8) : "—".padEnd(8);
      const model = (e.model_used ?? "—").padEnd(6).slice(0, 6);
      lines.push(`│  ${agent}  ${action}  ${status}  ${dur}  ${model}  │`);
    }

    lines.push("└──────────────────────────────────────────────────────────────────┘");
    lines.push(`  Showing ${events.length} events`);

    return lines.join("\n");
  }

  async function getStats(): Promise<AuditStats> {
    const result = await db.query<{
      total: string;
      unique_agents: string;
      success_count: string;
      avg_duration: string;
    }>(`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT agent_id) AS unique_agents,
        COUNT(*) FILTER (WHERE status = 'SUCCESS') AS success_count,
        COALESCE(AVG(duration_ms), 0) AS avg_duration
      FROM agent_events
    `);

    const row = result.rows[0];
    const total = parseInt(row.total, 10);

    return {
      totalEvents: total,
      uniqueAgents: parseInt(row.unique_agents, 10),
      successRate: total > 0 ? parseInt(row.success_count, 10) / total : 0,
      avgDurationMs: parseFloat(row.avg_duration),
    };
  }

  return { query, formatReport, getStats };
}
