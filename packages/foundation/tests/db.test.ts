/**
 * Tests for the PostgreSQL database client and migration runner.
 *
 * Verifies:
 * - Creates a connection pool from config
 * - Runs migrations in order
 * - Tracks applied migrations (idempotent re-runs)
 * - All CLAUDE.md schema tables exist after migration
 * - Provides typed query helpers
 * - Supports pgvector operations
 * - Properly disconnects
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Database Client", () => {
  let db: Awaited<ReturnType<typeof import("../src/db/index.js")["createDbClient"]>>;

  beforeAll(async () => {
    const { createDbClient } = await import("../src/db/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it("should connect and run a simple query", async () => {
    const result = await db.query<{ now: Date }>("SELECT NOW() as now");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].now).toBeInstanceOf(Date);
  });

  it("should provide a typed query helper", async () => {
    const result = await db.query<{ val: number }>("SELECT 42 as val");
    expect(result.rows[0].val).toBe(42);
  });
});

describe("Migration Runner", () => {
  let db: Awaited<ReturnType<typeof import("../src/db/index.js")["createDbClient"]>>;

  beforeAll(async () => {
    const { createDbClient } = await import("../src/db/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it("should run migrations and create all schema tables", async () => {
    const { runMigrations } = await import("../src/db/index.js");
    const migrationsDir = path.resolve(__dirname, "../../../db/migrations");
    await runMigrations(db, migrationsDir);

    // Verify all tables from CLAUDE.md schema exist
    const tables = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
       AND tablename IN ('agent_events', 'memory_entries', 'artifacts', 'agent_blueprints', 'schema_migrations')`
    );
    const tableNames = tables.rows.map((r) => r.tablename).sort();
    expect(tableNames).toEqual([
      "agent_blueprints",
      "agent_events",
      "artifacts",
      "memory_entries",
      "schema_migrations",
    ]);
  });

  it("should be idempotent — running migrations twice does not error", async () => {
    const { runMigrations } = await import("../src/db/index.js");
    const migrationsDir = path.resolve(__dirname, "../../../db/migrations");
    // Run again — should not throw
    await expect(runMigrations(db, migrationsDir)).resolves.not.toThrow();
  });

  it("should track applied migrations in schema_migrations", async () => {
    const result = await db.query<{ version: number; description: string }>(
      "SELECT version, description FROM schema_migrations ORDER BY version"
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows[0].version).toBe(1);
    expect(result.rows[0].description).toBe("initial_schema");
  });

  it("should support pgvector operations after migration", async () => {
    // Insert a vector into memory_entries
    const vector = Array.from({ length: 768 }, (_, i) => Math.sin(i * 0.01));
    const vectorStr = `[${vector.join(",")}]`;

    await db.query(
      `INSERT INTO memory_entries (content, embedding, memory_type)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      ["test vector entry", vectorStr, "SEMANTIC"]
    );

    // Query by cosine similarity
    const result = await db.query<{ content: string; similarity: number }>(
      `SELECT content, 1 - (embedding <=> $1::vector) AS similarity
       FROM memory_entries
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      [vectorStr]
    );

    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows[0].content).toBe("test vector entry");

    // Cleanup
    await db.query("DELETE FROM memory_entries WHERE content = $1", [
      "test vector entry",
    ]);
  });
});
