import express, { type Request, type Response } from "express";
import helmet from "helmet";
import { z } from "zod";
import type { CacheClient, DbClient, AuditLogger } from "@rsf/foundation";

const KILL_KEY = "rsf:kill:global";
const SPEND_KEY = "rsf:daily-spend";
const CONFIG_PREFIX = "rsf:config:";

const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  agentId: z.string().optional(),
  actionType: z.string().optional(),
});

const ConfigPatchSchema = z.object({
  maxDailySpendUsd: z.number().positive().optional(),
  autonomyLevel: z.enum(["autonomous", "supervised", "manual"]).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

interface GovernanceApiDeps {
  cache: CacheClient;
  db: DbClient;
  auditLogger: AuditLogger;
}

/**
 * Create the Governance REST API (Express + Zod + Helmet).
 */
/** Current schema version — increment after each Flyway migration. */
const SCHEMA_VERSION = "2";

export function createGovernanceApi(deps: GovernanceApiDeps): express.Express {
  const { cache, db, auditLogger } = deps;
  const app = express();

  app.use(helmet());
  app.use(express.json());

  // Inject schema_version into every JSON response
  app.use((_req: Request, res: Response, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (body && typeof body === "object" && !Array.isArray(body)) {
        return originalJson({ ...(body as Record<string, unknown>), schema_version: SCHEMA_VERSION });
      }
      return originalJson(body);
    };
    next();
  });

  // ── GET /health ──
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── POST /governance/stop ──
  app.post("/governance/stop", async (_req: Request, res: Response) => {
    try {
      await cache.set(KILL_KEY, "1");
      await auditLogger.log({
        agentId: "kill-switch",
        agentType: "GOVERNANCE",
        actionType: "KILL_SWITCH_ACTIVATED",
        phase: "GOVERNANCE",
        inputs: { triggered_by: "http-api", mechanism: "HTTP" },
        status: "SUCCESS",
        durationMs: 0,
      });
      res.json({ killed: true, timestamp: new Date().toISOString() });
    } catch {
      res.status(500).json({ error: "Failed to activate kill switch" });
    }
  });

  // ── GET /governance/status ──
  app.get("/governance/status", async (_req: Request, res: Response) => {
    try {
      const killFlag = await cache.get(KILL_KEY);
      const spendRaw = await cache.get(SPEND_KEY);
      const autonomy = await cache.get(`${CONFIG_PREFIX}autonomyLevel`) ?? "supervised";

      res.json({
        killSwitchActive: killFlag === "1",
        dailySpend: spendRaw ? parseFloat(spendRaw) : 0,
        autonomyLevel: autonomy,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // ── GET /governance/audit ──
  app.get("/governance/audit", async (req: Request, res: Response) => {
    const parsed = AuditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const { limit, offset, agentId, actionType } = parsed.data;
    try {
      let query = "SELECT * FROM agent_events";
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (agentId) {
        conditions.push(`agent_id = $${paramIdx++}`);
        params.push(agentId);
      }
      if (actionType) {
        conditions.push(`action_type = $${paramIdx++}`);
        params.push(actionType);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += ` ORDER BY timestamp DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      res.json({ events: result.rows, count: result.rows.length });
    } catch {
      res.status(500).json({ error: "Failed to query audit events" });
    }
  });

  // ── POST /governance/improve ──
  app.post("/governance/improve", async (_req: Request, res: Response) => {
    // In V1 this is a stub that reports readiness
    // Full implementation would wire up the improvement cycle orchestrator
    try {
      await auditLogger.log({
        agentId: "governance-api",
        agentType: "GOVERNANCE",
        actionType: "IMPROVEMENT_TRIGGERED",
        phase: "GOVERNANCE",
        inputs: { trigger: "manual" },
        status: "SUCCESS",
        durationMs: 0,
      });

      res.json({
        status: "triggered",
        message: "Improvement cycle queued. Check /governance/audit for progress.",
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: "Failed to trigger improvement" });
    }
  });

  // ── GET /governance/config ──
  app.get("/governance/config", async (_req: Request, res: Response) => {
    try {
      const maxSpend = await cache.get(`${CONFIG_PREFIX}maxDailySpendUsd`);
      const autonomy = await cache.get(`${CONFIG_PREFIX}autonomyLevel`);

      res.json({
        maxDailySpendUsd: maxSpend ? parseFloat(maxSpend) : 10,
        autonomyLevel: autonomy ?? "supervised",
      });
    } catch {
      res.status(500).json({ error: "Failed to get config" });
    }
  });

  // ── PATCH /governance/config ──
  app.patch("/governance/config", async (req: Request, res: Response) => {
    const parsed = ConfigPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    try {
      const updates = parsed.data;

      if (updates.maxDailySpendUsd !== undefined) {
        await cache.set(`${CONFIG_PREFIX}maxDailySpendUsd`, String(updates.maxDailySpendUsd));
      }
      if (updates.autonomyLevel !== undefined) {
        await cache.set(`${CONFIG_PREFIX}autonomyLevel`, updates.autonomyLevel);
      }

      await auditLogger.log({
        agentId: "governance-api",
        agentType: "GOVERNANCE",
        actionType: "CONFIG_UPDATE",
        phase: "GOVERNANCE",
        inputs: updates as Record<string, unknown>,
        status: "SUCCESS",
        durationMs: 0,
      });

      // Return the full current config
      const maxSpend = await cache.get(`${CONFIG_PREFIX}maxDailySpendUsd`);
      const autonomy = await cache.get(`${CONFIG_PREFIX}autonomyLevel`);

      res.json({
        maxDailySpendUsd: maxSpend ? parseFloat(maxSpend) : 10,
        autonomyLevel: autonomy ?? "supervised",
      });
    } catch {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  return app;
}
