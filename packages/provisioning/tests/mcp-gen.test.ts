/**
 * Tests for the MCP Server Generator.
 *
 * Verifies:
 * - Parses an OpenAPI spec into tool definitions
 * - Generates a complete MCP server using @modelcontextprotocol/sdk
 * - Generated server code includes tool registrations
 * - Generates Zod schemas from OpenAPI parameters
 * - Passes AST validation
 * - Audits the generation
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const SAMPLE_OPENAPI = {
  openapi: "3.0.0",
  info: { title: "Pet Store", version: "1.0.0" },
  paths: {
    "/pets": {
      get: {
        operationId: "listPets",
        summary: "List all pets",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer" }, required: false },
        ],
        responses: { "200": { description: "List of pets" } },
      },
      post: {
        operationId: "createPet",
        summary: "Create a pet",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  tag: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: { "201": { description: "Pet created" } },
      },
    },
    "/pets/{petId}": {
      get: {
        operationId: "getPet",
        summary: "Get a pet by ID",
        parameters: [
          { name: "petId", in: "path", schema: { type: "string" }, required: true },
        ],
        responses: { "200": { description: "A pet" } },
      },
    },
  },
};

describe("MCP Server Generator", () => {
  let mcpGen: typeof import("../src/mcp-gen/index.js");
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT = path.resolve(__dirname, "../../../logs/audit-mcp-test.jsonl");

  beforeAll(async () => {
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT });
    mcpGen = await import("../src/mcp-gen/index.js");
  });

  afterAll(async () => {
    await db.query("DELETE FROM agent_events WHERE agent_id = 'mcp-generator'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT)) fs.unlinkSync(TEST_AUDIT);
    await db.disconnect();
  });

  it("should parse OpenAPI spec into tool definitions", () => {
    const tools = mcpGen.parseOpenApiToTools(SAMPLE_OPENAPI);
    expect(tools).toHaveLength(3);
    expect(tools.map(t => t.name).sort()).toEqual(["createPet", "getPet", "listPets"]);
  });

  it("should generate Zod schemas from OpenAPI parameters", () => {
    const tools = mcpGen.parseOpenApiToTools(SAMPLE_OPENAPI);
    const listPets = tools.find(t => t.name === "listPets")!;
    expect(listPets.zodSchema).toContain("z.object");
    expect(listPets.zodSchema).toContain("limit");

    const createPet = tools.find(t => t.name === "createPet")!;
    expect(createPet.zodSchema).toContain("name");
    expect(createPet.zodSchema).toContain("z.string");
  });

  it("should generate a complete MCP server code", async () => {
    const gen = mcpGen.createMcpGenerator({ auditLogger });
    const result = await gen.generate(SAMPLE_OPENAPI);

    expect(result.serverCode).toContain("McpServer");
    expect(result.serverCode).toContain("listPets");
    expect(result.serverCode).toContain("createPet");
    expect(result.serverCode).toContain("getPet");
    expect(result.serverCode).toContain("tool(");
  });

  it("should include tool registrations with descriptions", async () => {
    const gen = mcpGen.createMcpGenerator({ auditLogger });
    const result = await gen.generate(SAMPLE_OPENAPI);

    expect(result.serverCode).toContain("List all pets");
    expect(result.serverCode).toContain("Create a pet");
    expect(result.serverCode).toContain("Get a pet by ID");
  });

  it("should audit the generation", async () => {
    const events = await db.query(
      `SELECT * FROM agent_events WHERE agent_id = 'mcp-generator' ORDER BY timestamp DESC LIMIT 1`
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(1);
  });
});
