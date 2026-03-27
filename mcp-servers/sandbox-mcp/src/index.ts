/**
 * Sandbox MCP Server
 *
 * Wraps the RSF foundation Docker sandbox executor as an MCP tool server.
 * Executes code in isolated Docker containers with:
 * - No network access (network=none)
 * - Read-only filesystem except /tmp
 * - Resource limits (memory, CPU)
 * - Execution timeout
 * - Non-root user
 */
import { z } from "zod";
import { execute, type SandboxResult } from "../../../packages/foundation/src/sandbox/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ── Constants ──

const DEFAULT_MEMORY_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const DEFAULT_CPU_COUNT = 4;
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_MEMORY_BYTES = 4 * 1024 * 1024 * 1024; // 4GB hard cap

// ── Tool Input Schemas ──

const ExecuteCodeInputSchema = z.object({
  image: z.string().min(1).describe("Docker image to use, e.g. 'node:22-alpine' or 'python:3.11-alpine'"),
  command: z.array(z.string()).min(1).describe("Command to execute inside the container"),
  timeoutMs: z.number().int().positive().max(MAX_TIMEOUT_MS).optional()
    .default(DEFAULT_TIMEOUT_MS)
    .describe("Execution timeout in milliseconds (max 120000)"),
  memoryBytes: z.number().int().positive().max(MAX_MEMORY_BYTES).optional()
    .default(DEFAULT_MEMORY_BYTES)
    .describe("Memory limit in bytes (max 4GB)"),
  cpuCount: z.number().int().positive().max(8).optional()
    .default(DEFAULT_CPU_COUNT)
    .describe("CPU core limit (max 8)"),
});

// ── Tool Definitions ──

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "execute-code",
      description:
        "Execute code inside an isolated Docker container. " +
        "Network is disabled (--network none), filesystem is read-only except /tmp, " +
        "runs as non-root user (uid 1000). Returns stdout, stderr, exit code, and timing.",
      inputSchema: ExecuteCodeInputSchema,
    },
  ];
}

// ── Tool Execution ──

export async function executeTool(
  toolName: string,
  rawInput: unknown
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "execute-code": {
      const input = ExecuteCodeInputSchema.parse(rawInput);

      const result: SandboxResult = await execute({
        image: input.image,
        command: input.command,
        timeoutMs: input.timeoutMs,
        memoryBytes: input.memoryBytes,
        cpuCount: input.cpuCount,
        user: "1000:1000",
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
