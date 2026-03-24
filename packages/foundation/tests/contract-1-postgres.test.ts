/**
 * Contract 1: TypeScript → PostgreSQL
 *
 * Verifies:
 * - Can connect using env vars (not hardcoded credentials)
 * - Can create a table, insert a row, query it, delete it
 * - pgvector extension is loaded
 * - Can store and query a 768-dimension vector
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Contract 1: TypeScript → PostgreSQL", () => {
  let client: pg.Client;

  beforeAll(async () => {
    // Connect using env vars — never hardcoded
    client = new pg.Client({
      connectionString: process.env.POSTGRES_URL,
    });
    await client.connect();
  });

  afterAll(async () => {
    // Cleanup test table
    await client.query("DROP TABLE IF EXISTS contract1_test").catch(() => {});
    await client.query("DROP TABLE IF EXISTS contract1_vector_test").catch(() => {});
    await client.end();
  });

  it("should connect using env vars", () => {
    expect(process.env.POSTGRES_URL).toBeDefined();
    expect(process.env.POSTGRES_URL).not.toBe("");
    // Verify we are NOT hardcoding credentials
    expect(process.env.POSTGRES_URL).toMatch(/^postgresql:\/\//);
  });

  it("should create a table, insert, query, and delete", async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract1_test (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Insert
    const insertResult = await client.query(
      "INSERT INTO contract1_test (name) VALUES ($1) RETURNING id, name",
      ["contract-test-row"]
    );
    expect(insertResult.rows).toHaveLength(1);
    expect(insertResult.rows[0].name).toBe("contract-test-row");
    const insertedId = insertResult.rows[0].id;

    // Query
    const selectResult = await client.query(
      "SELECT * FROM contract1_test WHERE id = $1",
      [insertedId]
    );
    expect(selectResult.rows).toHaveLength(1);
    expect(selectResult.rows[0].name).toBe("contract-test-row");

    // Delete
    const deleteResult = await client.query(
      "DELETE FROM contract1_test WHERE id = $1",
      [insertedId]
    );
    expect(deleteResult.rowCount).toBe(1);

    // Verify deleted
    const verifyResult = await client.query(
      "SELECT * FROM contract1_test WHERE id = $1",
      [insertedId]
    );
    expect(verifyResult.rows).toHaveLength(0);
  });

  it("should have pgvector extension loaded", async () => {
    const result = await client.query(
      "SELECT extname FROM pg_extension WHERE extname = 'vector'"
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].extname).toBe("vector");
  });

  it("should store and query a 768-dimension vector", async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract1_vector_test (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(768)
      )
    `);

    // Generate a deterministic 768-dim vector
    const vector = Array.from({ length: 768 }, (_, i) => Math.sin(i * 0.01));
    const vectorStr = `[${vector.join(",")}]`;

    // Insert vector
    await client.query(
      "INSERT INTO contract1_vector_test (content, embedding) VALUES ($1, $2)",
      ["test content", vectorStr]
    );

    // Query by cosine similarity
    const result = await client.query(
      `SELECT content, 1 - (embedding <=> $1::vector) AS similarity
       FROM contract1_vector_test
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      [vectorStr]
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].content).toBe("test content");
    // Same vector should have similarity ~1.0
    expect(parseFloat(result.rows[0].similarity)).toBeGreaterThan(0.99);
  });
});
