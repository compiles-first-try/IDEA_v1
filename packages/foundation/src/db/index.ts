import pg from "pg";
import fs from "node:fs";
import path from "node:path";

export interface DbClient {
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<pg.QueryResult<T>>;
  pool: pg.Pool;
  disconnect: () => Promise<void>;
}

/**
 * Create a PostgreSQL connection pool from a connection URL.
 * Uses pg.Pool for connection pooling with sensible defaults.
 */
export async function createDbClient(connectionUrl: string): Promise<DbClient> {
  const pool = new pg.Pool({
    connectionString: connectionUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Verify connectivity
  const client = await pool.connect();
  client.release();

  return {
    query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      params?: unknown[]
    ) => pool.query<T>(text, params),
    pool,
    disconnect: () => pool.end(),
  };
}

interface MigrationFile {
  version: number;
  description: string;
  filename: string;
  sql: string;
}

/**
 * Run SQL migrations in version order.
 * Migrations are numbered files matching V{n}__{description}.sql.
 * Already-applied migrations are skipped (idempotent).
 */
export async function runMigrations(
  db: DbClient,
  migrationsDir: string
): Promise<void> {
  // Ensure schema_migrations table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get already-applied versions
  const applied = await db.query<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  const appliedVersions = new Set(applied.rows.map((r) => r.version));

  // Parse migration files
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && /^V\d+__/.test(f))
    .map((filename): MigrationFile => {
      const match = filename.match(/^V(\d+)__(.+)\.sql$/);
      if (!match) throw new Error(`Invalid migration filename: ${filename}`);
      return {
        version: parseInt(match[1], 10),
        description: match[2],
        filename,
        sql: fs.readFileSync(path.join(migrationsDir, filename), "utf-8"),
      };
    })
    .sort((a, b) => a.version - b.version);

  // Apply pending migrations
  for (const migration of files) {
    if (appliedVersions.has(migration.version)) continue;

    await db.query(migration.sql);

    // Record migration (the SQL file itself may insert, so use ON CONFLICT)
    await db.query(
      `INSERT INTO schema_migrations (version, description)
       VALUES ($1, $2) ON CONFLICT (version) DO NOTHING`,
      [migration.version, migration.description]
    );
  }
}
