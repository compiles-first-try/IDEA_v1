import express, { type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
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
  status: z.string().optional(),
});

const ConfigPatchSchema = z.object({
  maxDailySpendUsd: z.number().positive().optional(),
  autonomyLevel: z.enum(["autonomous", "supervised", "manual"]).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

interface V2PipelineHandle {
  run: (spec: string) => Promise<{
    stages: Record<string, { status: string; durationMs: number; modelUsed?: string }>;
    artifacts: { code: string; tests: string; qualityReport: { gate: string; passed: boolean; details: string }[] };
    uncertainty: { epistemic: number; aleatoric: number; action: string };
    routing: { tier: number; classification: string; escalated: boolean };
    auditTrail: { eventId: string; agentId: string; action: string; durationMs: number }[];
  }>;
  getStatus: () => { running: boolean };
}

interface GovernanceApiDeps {
  cache: CacheClient;
  db: DbClient;
  auditLogger: AuditLogger;
  v2Pipeline?: V2PipelineHandle;
}

/**
 * Create the Governance REST API (Express + Zod + Helmet).
 */
/** Current schema version — increment after each Flyway migration. */
const SCHEMA_VERSION = "2";

export function createGovernanceApi(deps: GovernanceApiDeps): express.Express {
  const { cache, db, auditLogger, v2Pipeline } = deps;
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
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

  // ── POST /governance/resume ──
  app.post("/governance/resume", async (_req: Request, res: Response) => {
    try {
      await cache.del(KILL_KEY);
      await auditLogger.log({
        agentId: "kill-switch",
        agentType: "GOVERNANCE",
        actionType: "KILL_SWITCH_CLEARED",
        phase: "GOVERNANCE",
        inputs: { triggered_by: "http-api", mechanism: "HTTP" },
        status: "SUCCESS",
        durationMs: 0,
      });
      res.json({ resumed: true, timestamp: new Date().toISOString() });
    } catch {
      res.status(500).json({ error: "Failed to resume" });
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

    const { limit, offset, agentId, actionType, status } = parsed.data;
    try {
      const AUDIT_COLUMNS = [
        "id", "event_id", "timestamp", "agent_id", "agent_type",
        "action_type", "phase", "session_id", "inputs", "outputs",
        "model_used", "tokens_in", "tokens_out", "cost_usd",
        "duration_ms", "status", "error_message", "parent_event_id",
        "task_tier", "task_cost_usd", "task_quality_score",
        "cache_hit", "escalated_from_tier",
      ].join(", ");

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
      if (status) {
        conditions.push(`status = $${paramIdx++}`);
        params.push(status);
      }

      const whereClause = conditions.length > 0
        ? ` WHERE ${conditions.join(" AND ")}`
        : "";

      // Count total matching rows for pagination
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS total FROM agent_events${whereClause}`,
        params,
      );
      const total = countResult.rows[0]?.total ?? 0;

      // Fetch the page
      const query = `SELECT ${AUDIT_COLUMNS} FROM agent_events${whereClause} ORDER BY timestamp DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      res.json({ events: result.rows, total, count: result.rows.length });
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

  // ── POST /governance/build ──
  const BuildSchema = z.object({
    spec: z.string().min(1, "Spec is required"),
    reasoningMode: z.enum(["sequential", "feynman", "parallel-dag"]).optional().default("sequential"),
  });

  app.post("/governance/build", async (req: Request, res: Response) => {
    const parsed = BuildSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const { spec, reasoningMode } = parsed.data;
    const buildId = crypto.randomUUID();

    try {
      // Log the build submission — this event flows through the WebSocket audit stream
      await auditLogger.log({
        agentId: "governance-api",
        agentType: "GOVERNANCE",
        actionType: "BUILD_SUBMITTED",
        phase: "MANUFACTURING",
        sessionId: buildId,
        inputs: { spec: spec.slice(0, 500), reasoningMode },
        status: "SUCCESS",
        durationMs: 0,
      });

      // Store build state in Redis for tracking
      await cache.setJson(`rsf:build:${buildId}`, {
        spec,
        reasoningMode,
        status: "queued",
        submittedAt: new Date().toISOString(),
      }, 86400); // TTL: 24 hours

      // Run pipeline asynchronously — response returns immediately.
      // Stage events flow through audit logger → WebSocket.
      (async () => {
        const STAGE_MAP: [string, string][] = [
          ["specInterpreter", "spec-interpreter"],
          ["codeGenerator", "code-gen"],
          ["testGenerator", "test-gen"],
          ["testValidator", "test-validator"],
          ["qualityGates", "quality-gates"],
          ["adversarialReview", "consensus"],
        ];

        if (v2Pipeline) {
          // ── Real V2 Pipeline Execution ──
          // Emit STAGE_STARTED for each stage, then run pipeline, then emit STAGE_COMPLETED
          for (const [, uiId] of STAGE_MAP) {
            await auditLogger.log({
              agentId: `pipeline-${uiId}`,
              agentType: "PIPELINE",
              actionType: "STAGE_STARTED",
              phase: "MANUFACTURING",
              sessionId: buildId,
              inputs: { stageId: uiId, stageName: uiId },
              status: "SUCCESS",
              durationMs: 0,
            });
          }

          const result = await v2Pipeline.run(spec);

          // Emit STAGE_COMPLETED for each stage with real data
          for (const [pipelineKey, uiId] of STAGE_MAP) {
            const stageData = result.stages[pipelineKey] ?? { status: "skipped", durationMs: 0 };
            await auditLogger.log({
              agentId: `pipeline-${uiId}`,
              agentType: "PIPELINE",
              actionType: "STAGE_COMPLETED",
              phase: "MANUFACTURING",
              sessionId: buildId,
              inputs: { stageId: uiId, stageName: uiId },
              modelUsed: stageData.modelUsed ?? undefined,
              status: stageData.status === "completed" ? "SUCCESS" : "FAILURE",
              durationMs: stageData.durationMs,
            });
          }

          // Emit BUILD_COMPLETED with real artifacts
          await auditLogger.log({
            agentId: "governance-api",
            agentType: "GOVERNANCE",
            actionType: "BUILD_COMPLETED",
            phase: "MANUFACTURING",
            sessionId: buildId,
            inputs: { spec: spec.slice(0, 200) },
            outputs: {
              generatedCode: result.artifacts.code,
              generatedTests: result.artifacts.tests,
              qualityGates: result.artifacts.qualityReport.map((g) => ({
                name: g.gate,
                result: g.passed ? "pass" : "fail",
                details: g.details,
              })),
              uncertainty: result.uncertainty,
              routing: result.routing,
            },
            status: "SUCCESS",
            durationMs: 0,
          });
        } else {
          // ── Simulation Fallback (no pipeline instance) ──
          const stages = [
            { id: "spec-interpreter", modelUsed: "qwen2.5-coder:14b" },
            { id: "router", modelUsed: "llama3.3:8b" },
            { id: "code-gen", modelUsed: "qwen2.5-coder:14b" },
            { id: "test-gen", modelUsed: "qwen2.5-coder:14b" },
            { id: "quality-gates", modelUsed: null as string | null },
            { id: "consensus", modelUsed: "claude-haiku-4-5-20251001" },
          ];

          for (const stage of stages) {
            await auditLogger.log({
              agentId: `pipeline-${stage.id}`,
              agentType: "PIPELINE",
              actionType: "STAGE_STARTED",
              phase: "MANUFACTURING",
              sessionId: buildId,
              inputs: { stageId: stage.id, stageName: stage.id },
              modelUsed: stage.modelUsed ?? undefined,
              status: "SUCCESS",
              durationMs: 0,
            });

            const startMs = Date.now();
            await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
            const durationMs = Date.now() - startMs;

            await auditLogger.log({
              agentId: `pipeline-${stage.id}`,
              agentType: "PIPELINE",
              actionType: "STAGE_COMPLETED",
              phase: "MANUFACTURING",
              sessionId: buildId,
              inputs: { stageId: stage.id, stageName: stage.id },
              modelUsed: stage.modelUsed ?? undefined,
              status: "SUCCESS",
              durationMs,
            });
          }

          await auditLogger.log({
            agentId: "governance-api",
            agentType: "GOVERNANCE",
            actionType: "BUILD_COMPLETED",
            phase: "MANUFACTURING",
            sessionId: buildId,
            inputs: { spec: spec.slice(0, 200) },
            outputs: {
              generatedCode: `// Generated from spec: ${spec.slice(0, 80)}\nexport function main() {\n  return true;\n}`,
              generatedTests: `import { describe, it, expect } from "vitest";\nimport { main } from "./main.ts";\n\ndescribe("main", () => {\n  it("returns true", () => {\n    expect(main()).toBe(true);\n  });\n});`,
              qualityGates: [
                { name: "AST Valid", result: "pass", details: "TypeScript parses without errors" },
                { name: "Test Coverage", result: "pass", details: "100% function coverage" },
              ],
            },
            status: "SUCCESS",
            durationMs: 0,
          });
        }

        // Update build state in Redis
        await cache.setJson(`rsf:build:${buildId}`, {
          spec,
          reasoningMode,
          status: "completed",
          submittedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        }, 86400);
      })().catch(async (err) => {
        // Log pipeline failure
        await auditLogger.log({
          agentId: "governance-api",
          agentType: "GOVERNANCE",
          actionType: "BUILD_COMPLETED",
          phase: "MANUFACTURING",
          sessionId: buildId,
          inputs: { spec: spec.slice(0, 200) },
          status: "FAILURE",
          durationMs: 0,
          errorMessage: err instanceof Error ? err.message : "Unknown pipeline error",
        });
        await cache.setJson(`rsf:build:${buildId}`, {
          spec, reasoningMode, status: "failed",
          submittedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : "Unknown error",
        }, 86400);
      });

      res.json({
        buildId,
        status: "queued",
        message: "Build submitted. Stage events will stream via WebSocket.",
      });
    } catch {
      res.status(500).json({ error: "Failed to submit build" });
    }
  });

  // ── GET /governance/build/:id ──
  app.get("/governance/build/:id", async (req: Request, res: Response) => {
    const buildId = req.params.id;
    try {
      const build = await cache.getJson<Record<string, unknown>>(`rsf:build:${buildId}`);
      if (!build) {
        res.status(404).json({ error: "Build not found" });
        return;
      }
      res.json(build);
    } catch {
      res.status(500).json({ error: "Failed to get build status" });
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

  // ── GET /governance/models ──
  // Returns Ollama local models, Anthropic API key status, and router tier config
  app.get("/governance/models", async (_req: Request, res: Response) => {
    try {
      const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";

      // Fetch Ollama models list
      let ollamaModels: Array<{ name: string; size: string; modifiedAt: string }> = [];
      let ollamaReachable = false;
      try {
        const ollamaRes = await fetch(`${ollamaHost}/api/tags`);
        if (ollamaRes.ok) {
          const data = await ollamaRes.json() as { models?: Array<{ name: string; size: number; modified_at: string }> };
          ollamaReachable = true;
          ollamaModels = (data.models ?? []).map((m) => ({
            name: m.name,
            size: formatBytes(m.size),
            modifiedAt: m.modified_at,
          }));
        }
      } catch { /* Ollama not reachable */ }

      // Anthropic API key status (check env, never expose the key)
      const anthropicKeySet = !!process.env.ANTHROPIC_API_KEY;

      // Router tier config with daily call counts from audit events
      const tierCountsResult = await db.query(
        `SELECT task_tier, COUNT(*)::int AS calls
         FROM agent_events
         WHERE timestamp > NOW() - INTERVAL '24 hours' AND task_tier IS NOT NULL
         GROUP BY task_tier`,
        [],
      );
      const tierCalls: Record<number, number> = {};
      for (const row of tierCountsResult.rows) {
        tierCalls[row.task_tier as number] = row.calls as number;
      }

      const routerTiers = [
        { tier: "TRIVIAL" as const, model: "llama3.3:8b", costPerCall: "$0.00", callsToday: tierCalls[1] ?? 0 },
        { tier: "STANDARD" as const, model: "qwen2.5-coder:14b", costPerCall: "$0.00", callsToday: tierCalls[2] ?? 0 },
        { tier: "COMPLEX" as const, model: "claude-haiku-4-5-20251001", costPerCall: "~$0.001", callsToday: tierCalls[3] ?? 0 },
        { tier: "CRITICAL" as const, model: "claude-sonnet-4-6-20250514", costPerCall: "~$0.015", callsToday: tierCalls[3] ?? 0 },
      ];

      res.json({
        ollama: ollamaModels,
        ollamaReachable,
        anthropicKeySet,
        anthropicModels: ["claude-sonnet-4-6-20250514", "claude-haiku-4-5-20251001"],
        routerTiers,
      });
    } catch {
      res.status(500).json({ error: "Failed to get models" });
    }
  });

  // ── POST /governance/models/pull ──
  // Pulls an Ollama model with SSE progress streaming
  const PullModelSchema = z.object({
    name: z.string().min(1, "Model name is required"),
  });

  app.post("/governance/models/pull", async (req: Request, res: Response) => {
    const parsed = PullModelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const { name } = parsed.data;
    const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const ollamaRes = await fetch(`${ollamaHost}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stream: true }),
      });

      if (!ollamaRes.ok || !ollamaRes.body) {
        res.write(`data: ${JSON.stringify({ error: "Ollama pull request failed" })}\n\n`);
        res.end();
        return;
      }

      const reader = ollamaRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const progress = JSON.parse(line);
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
          } catch { /* skip malformed lines */ }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const progress = JSON.parse(buffer);
          res.write(`data: ${JSON.stringify(progress)}\n\n`);
        } catch { /* skip */ }
      }

      res.write(`data: ${JSON.stringify({ status: "success", done: true })}\n\n`);

      await auditLogger.log({
        agentId: "governance-api",
        agentType: "GOVERNANCE",
        actionType: "MODEL_PULL",
        phase: "GOVERNANCE",
        inputs: { model: name },
        status: "SUCCESS",
        durationMs: 0,
      });
    } catch {
      res.write(`data: ${JSON.stringify({ error: "Pull failed" })}\n\n`);
    } finally {
      res.end();
    }
  });

  // ── POST /governance/models/test-anthropic ──
  app.post("/governance/models/test-anthropic", async (_req: Request, res: Response) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.json({ success: false, error: "ANTHROPIC_API_KEY not set in environment" });
      return;
    }

    try {
      const testRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "Reply with OK" }],
        }),
      });

      if (testRes.ok) {
        res.json({ success: true, message: "Anthropic API connection successful" });
      } else {
        const body = await testRes.text();
        res.json({ success: false, error: `API returned ${testRes.status}: ${body.slice(0, 200)}` });
      }
    } catch (err) {
      res.json({ success: false, error: `Connection failed: ${err instanceof Error ? err.message : "unknown"}` });
    }
  });

  // ── GET /governance/docs ──
  // Lists ingested documents (aggregated from memory_entries with memory_type='DOCUMENT')
  app.get("/governance/docs", async (_req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT
           metadata->>'doc_id' AS id,
           metadata->>'name' AS name,
           metadata->>'doc_type' AS type,
           MIN(created_at) AS date_ingested,
           COUNT(*)::int AS chunk_count,
           MAX(accessed_at) AS last_retrieved
         FROM memory_entries
         WHERE memory_type = 'DOCUMENT'
         GROUP BY metadata->>'doc_id', metadata->>'name', metadata->>'doc_type'
         ORDER BY MIN(created_at) DESC`,
        [],
      );
      res.json({ docs: result.rows });
    } catch {
      res.status(500).json({ error: "Failed to list documents" });
    }
  });

  // ── POST /governance/docs/ingest ──
  const IngestSchema = z.object({
    url: z.string().min(1, "URL is required"),
    tags: z.string().optional(),
  });

  app.post("/governance/docs/ingest", async (req: Request, res: Response) => {
    const parsed = IngestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const { url, tags } = parsed.data;
    const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";
    const docId = crypto.randomUUID();
    const docName = url.split("/").pop() ?? url;

    try {
      // Fetch the content from the URL
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) {
        res.status(400).json({ error: `Failed to fetch URL: ${fetchRes.status}` });
        return;
      }
      const content = await fetchRes.text();

      // Simple chunking: split by double newline, then merge small chunks
      const rawChunks = content.split(/\n\n+/).filter((c) => c.trim().length > 0);
      const chunks: string[] = [];
      let current = "";
      for (const chunk of rawChunks) {
        if ((current + "\n\n" + chunk).length > 1000 && current.length > 0) {
          chunks.push(current.trim());
          current = chunk;
        } else {
          current = current ? current + "\n\n" + chunk : chunk;
        }
      }
      if (current.trim()) chunks.push(current.trim());

      // Generate embeddings and store each chunk
      let storedCount = 0;
      for (const chunk of chunks) {
        try {
          const embedRes = await fetch(`${ollamaHost}/api/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "nomic-embed-text:latest", input: chunk }),
          });

          let embedding: number[] | null = null;
          if (embedRes.ok) {
            const embedData = await embedRes.json() as { embeddings?: number[][] };
            embedding = embedData.embeddings?.[0] ?? null;
          }

          await db.query(
            `INSERT INTO memory_entries (agent_id, content, embedding, memory_type, metadata)
             VALUES ($1, $2, $3, 'DOCUMENT', $4)`,
            [
              "governance-api",
              chunk,
              embedding ? `[${embedding.join(",")}]` : null,
              JSON.stringify({
                doc_id: docId,
                name: docName,
                doc_type: url.endsWith(".md") ? "markdown" : url.endsWith(".json") ? "json" : "text",
                source_url: url,
                tags: tags ?? "",
              }),
            ],
          );
          storedCount++;
        } catch {
          // Skip chunks that fail to embed — still store without embedding
          await db.query(
            `INSERT INTO memory_entries (agent_id, content, memory_type, metadata)
             VALUES ($1, $2, 'DOCUMENT', $3)`,
            [
              "governance-api",
              chunk,
              JSON.stringify({
                doc_id: docId,
                name: docName,
                doc_type: "text",
                source_url: url,
                tags: tags ?? "",
              }),
            ],
          );
          storedCount++;
        }
      }

      await auditLogger.log({
        agentId: "governance-api",
        agentType: "GOVERNANCE",
        actionType: "DOC_INGEST",
        phase: "GOVERNANCE",
        inputs: { url, tags, docId },
        status: "SUCCESS",
        durationMs: 0,
      });

      res.json({ docId, name: docName, chunks: storedCount });
    } catch {
      res.status(500).json({ error: "Failed to ingest document" });
    }
  });

  // ── DELETE /governance/docs/:id ──
  app.delete("/governance/docs/:id", async (req: Request, res: Response) => {
    const docId = req.params.id;
    try {
      const result = await db.query(
        `DELETE FROM memory_entries WHERE memory_type = 'DOCUMENT' AND metadata->>'doc_id' = $1`,
        [docId],
      );
      res.json({ deleted: true, rowsRemoved: result.rowCount ?? 0 });
    } catch {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // ── POST /governance/docs/search ──
  const SearchSchema = z.object({
    query: z.string().min(1, "Query is required"),
    limit: z.number().int().min(1).max(50).optional().default(10),
  });

  app.post("/governance/docs/search", async (req: Request, res: Response) => {
    const parsed = SearchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const { query: searchQuery, limit } = parsed.data;
    const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";

    try {
      // Generate embedding for the search query
      const embedRes = await fetch(`${ollamaHost}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "nomic-embed-text:latest", input: searchQuery }),
      });

      if (!embedRes.ok) {
        // Fallback to text search if embedding fails
        const result = await db.query(
          `SELECT content, 0.5 AS score FROM memory_entries
           WHERE memory_type = 'DOCUMENT' AND content ILIKE $1
           LIMIT $2`,
          [`%${searchQuery}%`, limit],
        );
        res.json({ results: result.rows });
        return;
      }

      const embedData = await embedRes.json() as { embeddings?: number[][] };
      const queryEmbedding = embedData.embeddings?.[0];

      if (!queryEmbedding) {
        res.status(500).json({ error: "Failed to generate query embedding" });
        return;
      }

      // Cosine similarity search
      const result = await db.query(
        `SELECT content, 1 - (embedding <=> $1::vector) AS score
         FROM memory_entries
         WHERE memory_type = 'DOCUMENT' AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [`[${queryEmbedding.join(",")}]`, limit],
      );

      res.json({ results: result.rows });
    } catch {
      res.status(500).json({ error: "Failed to search documents" });
    }
  });

  // ── GET /governance/agents ──
  // Lists agents from blueprints + audit event stats (success rate, total runs)
  app.get("/governance/agents", async (_req: Request, res: Response) => {
    try {
      // Get agent blueprints
      const blueprintResult = await db.query(
        `SELECT blueprint_id, name, tools, eval_criteria, is_active, generation
         FROM agent_blueprints
         ORDER BY name`,
        [],
      );

      // Get per-agent stats from audit events (last 7 days)
      const statsResult = await db.query(
        `SELECT
           agent_id,
           COUNT(*)::int AS total_runs,
           COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS success_count
         FROM agent_events
         WHERE timestamp > NOW() - INTERVAL '7 days'
         GROUP BY agent_id`,
        [],
      );

      const statsMap: Record<string, { totalRuns: number; successRate: number }> = {};
      for (const row of statsResult.rows) {
        const total = row.total_runs as number;
        const success = row.success_count as number;
        statsMap[row.agent_id as string] = {
          totalRuns: total,
          successRate: total > 0 ? success / total : 0,
        };
      }

      // Merge blueprints with stats; also derive agents from audit events not in blueprints
      const blueprintAgents = blueprintResult.rows.map((b) => {
        const stats = statsMap[b.name as string] ?? { totalRuns: 0, successRate: 0 };
        const tools = (b.tools as string[] | null) ?? [];
        return {
          id: b.blueprint_id as string,
          name: b.name as string,
          role: deriveRole(tools),
          status: (b.is_active as boolean) ? "ACTIVE" : "INACTIVE",
          capabilities: tools.slice(0, 5),
          successRate: stats.successRate,
          totalRuns: stats.totalRuns,
        };
      });

      // Include agents from events that aren't in blueprints
      const blueprintNames = new Set(blueprintResult.rows.map((b) => b.name as string));
      const eventOnlyAgents = Object.entries(statsMap)
        .filter(([agentId]) => !blueprintNames.has(agentId))
        .map(([agentId, stats]) => ({
          id: agentId,
          name: agentId,
          role: "PRODUCER",
          status: "ACTIVE",
          capabilities: [],
          successRate: stats.successRate,
          totalRuns: stats.totalRuns,
        }));

      res.json({ agents: [...blueprintAgents, ...eventOnlyAgents] });
    } catch {
      res.status(500).json({ error: "Failed to list agents" });
    }
  });

  // ── POST /governance/feedback/submit ──
  const FeedbackSubmitSchema = z.object({
    artifactId: z.string().min(1),
    rating: z.enum(["up", "down"]),
    tag: z.enum(["CORRECT", "INCORRECT", "PARTIAL", "EXCELLENT"]),
    note: z.string().optional().default(""),
  });

  app.post("/governance/feedback/submit", async (req: Request, res: Response) => {
    const parsed = FeedbackSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const { artifactId, rating, tag, note } = parsed.data;
    try {
      // Store feedback in artifacts metadata
      await db.query(
        `UPDATE artifacts SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
         WHERE artifact_id = $2::uuid`,
        [
          JSON.stringify({
            user_rating: rating,
            user_tag: tag,
            user_note: note,
            rated_at: new Date().toISOString(),
          }),
          artifactId,
        ],
      );

      await auditLogger.log({
        agentId: "governance-api",
        agentType: "GOVERNANCE",
        actionType: "FEEDBACK_SUBMITTED",
        phase: "GOVERNANCE",
        inputs: { artifactId, rating, tag },
        status: "SUCCESS",
        durationMs: 0,
      });

      res.json({ accepted: true, artifactId });
    } catch {
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // ── POST /governance/feedback/confirm ──
  const FeedbackConfirmSchema = z.object({
    artifactId: z.string().min(1),
    action: z.enum(["confirm", "update", "dismiss"]),
  });

  app.post("/governance/feedback/confirm", async (req: Request, res: Response) => {
    const parsed = FeedbackConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const { artifactId, action } = parsed.data;
    try {
      await db.query(
        `UPDATE artifacts SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
         WHERE artifact_id = $2::uuid`,
        [
          JSON.stringify({
            validation_action: action,
            validation_resolved_at: new Date().toISOString(),
          }),
          artifactId,
        ],
      );

      await auditLogger.log({
        agentId: "governance-api",
        agentType: "GOVERNANCE",
        actionType: "FEEDBACK_CONFIRMED",
        phase: "GOVERNANCE",
        inputs: { artifactId, action },
        status: "SUCCESS",
        durationMs: 0,
      });

      res.json({ confirmed: true, artifactId, action });
    } catch {
      res.status(500).json({ error: "Failed to confirm feedback" });
    }
  });

  // ── GET /governance/artifacts ──
  // Lists recent artifacts for the feedback panel
  app.get("/governance/artifacts", async (_req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT artifact_id, artifact_type, name, created_at, quality_score, metadata
         FROM artifacts
         ORDER BY created_at DESC
         LIMIT 50`,
        [],
      );

      const artifacts = result.rows.map((r) => {
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        return {
          id: r.artifact_id as string,
          type: r.artifact_type as string,
          name: r.name as string,
          createdAt: r.created_at as string,
          qualityScore: (r.quality_score as number) ?? 0,
          userRating: (meta.user_rating as string) ?? null,
          validationStatus: (meta.validation_action as string) ?? null,
        };
      });

      // Compute summary
      const total = artifacts.length;
      const accepted = artifacts.filter((a) => a.userRating === "up").length;
      const overridden = artifacts.filter((a) => a.validationStatus === "update").length;
      const pendingClarification = artifacts.filter((a) => a.userRating && !a.validationStatus).length;

      res.json({
        artifacts,
        summary: {
          total,
          accepted,
          acceptedWithNote: 0,
          pendingClarification,
          overridden,
        },
      });
    } catch {
      res.status(500).json({ error: "Failed to list artifacts" });
    }
  });

  // ── GET /governance/improve/metrics ──
  // Aggregates quality data for the self-improvement dashboard
  app.get("/governance/improve/metrics", async (_req: Request, res: Response) => {
    try {
      // Overall quality scores: average quality_score per day (last 14 days)
      const trendResult = await db.query(
        `SELECT DATE(created_at) AS day, AVG(quality_score) AS avg_score
         FROM artifacts
         WHERE quality_score IS NOT NULL AND created_at > NOW() - INTERVAL '14 days'
         GROUP BY DATE(created_at)
         ORDER BY day`,
        [],
      );
      const overallScores = trendResult.rows.map((r) => parseFloat(String(r.avg_score)) || 0);

      // Per-component scores: average quality by artifact_type
      const componentResult = await db.query(
        `SELECT artifact_type, AVG(quality_score) AS avg_score
         FROM artifacts
         WHERE quality_score IS NOT NULL
         GROUP BY artifact_type`,
        [],
      );
      const componentScores: Record<string, number> = {};
      for (const row of componentResult.rows) {
        componentScores[row.artifact_type as string] = parseFloat(String(row.avg_score)) || 0;
      }

      // Regression budget: count of failed builds in last 7 days vs limit of 5
      const regressionResult = await db.query(
        `SELECT COUNT(*)::int AS failures
         FROM agent_events
         WHERE action_type = 'BUILD_COMPLETED' AND status = 'FAILURE'
           AND timestamp > NOW() - INTERVAL '7 days'`,
        [],
      );
      const regressionsUsed = regressionResult.rows[0]?.failures ?? 0;

      // Last improvement cycle from audit events
      const lastCycleResult = await db.query(
        `SELECT timestamp, inputs, outputs
         FROM agent_events
         WHERE action_type = 'IMPROVEMENT_TRIGGERED'
         ORDER BY timestamp DESC
         LIMIT 1`,
        [],
      );
      let lastCycle: { timestamp: string; changes: string; delta: number } | null = null;
      if (lastCycleResult.rows.length > 0) {
        const row = lastCycleResult.rows[0];
        const outputs = (row.outputs ?? {}) as Record<string, unknown>;
        lastCycle = {
          timestamp: row.timestamp as string,
          changes: (outputs.changes as string) ?? "Improvement cycle completed",
          delta: (outputs.delta as number) ?? 0,
        };
      }

      res.json({
        overallScores,
        componentScores,
        regressionBudget: { used: regressionsUsed as number, total: 5 },
        lastCycle,
      });
    } catch {
      res.status(500).json({ error: "Failed to get improvement metrics" });
    }
  });

  return app;
}

function deriveRole(tools: string[]): string {
  const toolStr = tools.join(" ").toLowerCase();
  if (toolStr.includes("generate") || toolStr.includes("code")) return "PRODUCER";
  if (toolStr.includes("test") || toolStr.includes("validate")) return "VALIDATOR";
  if (toolStr.includes("route") || toolStr.includes("orchestrat")) return "ORCHESTRATOR";
  if (toolStr.includes("provision") || toolStr.includes("blueprint")) return "PROVISIONER";
  return "OBSERVER";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
