import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import type { DbClient } from "../../../foundation/src/db/index.js";

// RSF-related keywords for relevance scoring
const RSF_KEYWORDS = [
  "typescript", "python", "code", "coder", "coding",
  "agent", "llm", "model", "inference", "embedding",
  "docker", "postgresql", "redis", "temporal",
  "mastra", "langgraph", "mcp", "opentelemetry",
  "qwen", "llama", "claude", "anthropic", "ollama",
  "generation", "testing", "quality", "optimization",
];

export async function checkOllamaModels(baseUrl: string): Promise<{ models: Array<{ name: string }>; checkedAt: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    return {
      models: data.models ?? [],
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      models: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

export function assessRelevance(finding: {
  source: string;
  title: string;
  content: string;
}): { relevant: boolean; confidence: number; affectedWorkflows: string[] } {
  const text = `${finding.title} ${finding.content}`.toLowerCase();

  let matchCount = 0;
  for (const keyword of RSF_KEYWORDS) {
    if (text.includes(keyword)) {
      matchCount++;
    }
  }

  const confidence = Math.min(matchCount / 5, 1);
  const relevant = confidence >= 0.2;

  const affectedWorkflows: string[] = [];
  if (text.includes("code") || text.includes("coder") || text.includes("generation")) {
    affectedWorkflows.push("code-generation");
  }
  if (text.includes("test")) {
    affectedWorkflows.push("test-generation");
  }
  if (text.includes("model") || text.includes("inference") || text.includes("llm")) {
    affectedWorkflows.push("model-routing");
  }
  if (text.includes("prompt") || text.includes("optimization")) {
    affectedWorkflows.push("prompt-optimization");
  }
  if (text.includes("agent")) {
    affectedWorkflows.push("agent-provisioning");
  }

  return { relevant, confidence, affectedWorkflows };
}

export async function getHeldOutBenchmarks(
  db: DbClient
): Promise<Array<{ id: number; name: string; category: string; input: string; expected_output: string; created_at: Date }>> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS held_out_benchmarks (
      id              SERIAL PRIMARY KEY,
      name            VARCHAR(255) NOT NULL,
      category        VARCHAR(255),
      input           TEXT,
      expected_output TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const result = await db.query<{
    id: number;
    name: string;
    category: string;
    input: string;
    expected_output: string;
    created_at: Date;
  }>("SELECT id, name, category, input, expected_output, created_at FROM held_out_benchmarks ORDER BY created_at DESC");
  return result.rows;
}

export async function addBenchmark(
  db: DbClient,
  benchmark: { name: string; category: string; input: string; expectedOutput: string }
): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS held_out_benchmarks (
      id              SERIAL PRIMARY KEY,
      name            VARCHAR(255) NOT NULL,
      category        VARCHAR(255),
      input           TEXT,
      expected_output TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(
    "INSERT INTO held_out_benchmarks (name, category, input, expected_output) VALUES ($1, $2, $3, $4)",
    [benchmark.name, benchmark.category, benchmark.input, benchmark.expectedOutput]
  );
}

export async function runScan(options: {
  ollamaBaseUrl: string;
  db: DbClient;
}): Promise<{ findings: Array<Record<string, unknown>>; scannedAt: string; sourcesChecked: number }> {
  const findings: Array<Record<string, unknown>> = [];
  let sourcesChecked = 0;

  // Check Ollama models
  try {
    const ollamaResult = await checkOllamaModels(options.ollamaBaseUrl);
    sourcesChecked++;
    for (const model of ollamaResult.models) {
      findings.push({
        source: "ollama",
        type: "MODEL_AVAILABLE",
        title: `Model available: ${model.name}`,
        content: `Ollama model ${model.name} is available locally`,
        checkedAt: ollamaResult.checkedAt,
      });
    }
  } catch {
    // Ollama unreachable is not fatal
  }

  // Check held-out benchmarks
  try {
    const benchmarks = await getHeldOutBenchmarks(options.db);
    sourcesChecked++;
    if (benchmarks.length > 0) {
      findings.push({
        source: "database",
        type: "BENCHMARKS_AVAILABLE",
        title: `${benchmarks.length} held-out benchmarks available`,
        content: `Categories: ${[...new Set(benchmarks.map((b) => b.category))].join(", ")}`,
      });
    }
  } catch {
    // DB issue is not fatal for scanning
  }

  return {
    findings,
    scannedAt: new Date().toISOString(),
    sourcesChecked,
  };
}
