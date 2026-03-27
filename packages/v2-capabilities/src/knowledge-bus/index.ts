import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import type { DbClient } from "../../../foundation/src/db/index.js";
import type { CacheClient } from "../../../foundation/src/cache/index.js";

const ENSURE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS knowledge_events (
    id                  SERIAL PRIMARY KEY,
    event_type          VARCHAR(100),
    source_agent        VARCHAR(255),
    content             TEXT,
    confidence          FLOAT,
    affected_workflows  TEXT[],
    validation_status   VARCHAR(50) DEFAULT 'PENDING',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

export async function emitEvent(
  db: DbClient,
  event: {
    eventType: string;
    sourceAgent: string;
    content: string;
    confidence: number;
    affectedWorkflows: string[];
  }
): Promise<{ id: number; validationStatus: string }> {
  await db.query(ENSURE_TABLE_SQL);

  const result = await db.query<{ id: number; validation_status: string }>(
    `INSERT INTO knowledge_events (event_type, source_agent, content, confidence, affected_workflows, validation_status)
     VALUES ($1, $2, $3, $4, $5, 'PENDING')
     RETURNING id, validation_status`,
    [event.eventType, event.sourceAgent, event.content, event.confidence, event.affectedWorkflows]
  );

  return {
    id: result.rows[0].id,
    validationStatus: result.rows[0].validation_status,
  };
}

export async function queryEvents(
  db: DbClient,
  options: { limit: number }
): Promise<
  Array<{
    id: number;
    event_type: string;
    source_agent: string;
    content: string;
    confidence: number;
    affected_workflows: string[];
    validation_status: string;
    created_at: Date;
  }>
> {
  await db.query(ENSURE_TABLE_SQL);

  const result = await db.query<{
    id: number;
    event_type: string;
    source_agent: string;
    content: string;
    confidence: number;
    affected_workflows: string[];
    validation_status: string;
    created_at: Date;
  }>(
    `SELECT id, event_type, source_agent, content, confidence, affected_workflows, validation_status, created_at
     FROM knowledge_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [options.limit]
  );

  return result.rows;
}

export function validateDiscovery(discovery: {
  content: string;
  confidence: number;
  isReproducible: boolean;
  conflictsWithExisting: boolean;
  basedOnSyntheticData: boolean;
}): { validated: boolean; reason: string } {
  const reasons: string[] = [];

  if (!discovery.isReproducible) {
    reasons.push("not reproducible");
  }
  if (discovery.confidence < 0.5) {
    reasons.push("confidence below threshold (0.5)");
  }
  if (discovery.conflictsWithExisting) {
    reasons.push("conflicts with existing knowledge");
  }
  if (discovery.basedOnSyntheticData) {
    reasons.push("based on synthetic data only");
  }

  if (reasons.length > 0) {
    return { validated: false, reason: `Rejected: ${reasons.join(", ")}` };
  }

  return { validated: true, reason: "Discovery is reproducible and meets all validation criteria" };
}

export function calculateTTL(confidence: number): number {
  if (confidence >= 0.9) return 604800;   // 7 days
  if (confidence >= 0.7) return 259200;   // 3 days
  if (confidence >= 0.5) return 86400;    // 1 day
  return 3600;                             // 1 hour
}

export async function postSignal(
  cache: CacheClient,
  signal: {
    topic: string;
    content: string;
    confidence: number;
    sourceAgent: string;
  }
): Promise<void> {
  const ttl = calculateTTL(signal.confidence);
  const key = `rsf:signal:${signal.topic}`;
  await cache.setJson(key, {
    content: signal.content,
    confidence: signal.confidence,
    sourceAgent: signal.sourceAgent,
    postedAt: new Date().toISOString(),
  }, ttl);
}

export async function readSignal(
  cache: CacheClient,
  topic: string
): Promise<{ content: string; confidence: number; sourceAgent: string; postedAt: string } | null> {
  const key = `rsf:signal:${topic}`;
  return cache.getJson<{ content: string; confidence: number; sourceAgent: string; postedAt: string }>(key);
}
