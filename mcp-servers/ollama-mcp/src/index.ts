/**
 * Ollama MCP Server
 *
 * Wraps the Ollama API for local LLM inference as an MCP tool server.
 * Provides text generation, model listing, and embedding generation.
 * Tracks token counts for audit logging purposes.
 */
import { z } from "zod";
import { Ollama } from "ollama";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ── Singleton Ollama client ──

let ollamaClient: Ollama | null = null;

function getOllama(): Ollama {
  if (!ollamaClient) {
    const host = process.env.OLLAMA_HOST ?? "http://localhost:11434";
    ollamaClient = new Ollama({ host });
  }
  return ollamaClient;
}

// ── Tool Input Schemas ──

const GenerateInputSchema = z.object({
  model: z.string().min(1).describe("Ollama model name, e.g. 'qwen2.5-coder:14b' or 'llama3.3:8b'"),
  prompt: z.string().min(1).describe("The prompt to send to the model"),
  system: z.string().optional().describe("Optional system prompt"),
  maxTokens: z.number().int().positive().max(32768).optional()
    .default(2048)
    .describe("Maximum tokens to generate (default 2048)"),
  temperature: z.number().min(0).max(2).optional()
    .default(0.7)
    .describe("Sampling temperature (0-2, default 0.7)"),
});

const ListModelsInputSchema = z.object({});

const GenerateEmbeddingInputSchema = z.object({
  model: z.string().min(1).default("nomic-embed-text:latest")
    .describe("Embedding model name (default: nomic-embed-text:latest)"),
  input: z.string().min(1).describe("Text to generate embedding for"),
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
      name: "generate",
      description:
        "Generate text using a local Ollama model. " +
        "Returns the response with token counts for audit tracking. " +
        "Use model router classification to pick the right model.",
      inputSchema: GenerateInputSchema,
    },
    {
      name: "list-models",
      description: "List all locally available Ollama models with their sizes and modification dates.",
      inputSchema: ListModelsInputSchema,
    },
    {
      name: "generate-embedding",
      description:
        "Generate a vector embedding for the given text using a local Ollama embedding model. " +
        "Default model is nomic-embed-text which produces 768-dimension vectors.",
      inputSchema: GenerateEmbeddingInputSchema,
    },
  ];
}

// ── Helpers ──

/**
 * Estimate token count from text using a rough heuristic.
 * Ollama does not always return precise token counts in all API modes,
 * so we supplement with estimation when needed.
 */
function estimateTokens(text: string): number {
  // Rough approximation: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

// ── Tool Execution ──

export async function executeTool(
  toolName: string,
  rawInput: unknown
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "generate": {
      const input = GenerateInputSchema.parse(rawInput);
      const ollama = getOllama();
      const startMs = Date.now();

      const response = await ollama.generate({
        model: input.model,
        prompt: input.prompt,
        system: input.system,
        options: {
          num_predict: input.maxTokens,
          temperature: input.temperature,
        },
      });

      const durationMs = Date.now() - startMs;

      // Use Ollama's reported counts when available, fall back to estimation
      const tokensIn = response.prompt_eval_count ?? estimateTokens(input.prompt + (input.system ?? ""));
      const tokensOut = response.eval_count ?? estimateTokens(response.response);

      return {
        response: response.response,
        model: response.model,
        tokensIn,
        tokensOut,
        totalTokens: tokensIn + tokensOut,
        durationMs,
        done: response.done,
      };
    }

    case "list-models": {
      ListModelsInputSchema.parse(rawInput);
      const ollama = getOllama();
      const response = await ollama.list();

      const models = response.models.map((m) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        digest: m.digest,
      }));

      return { models, count: models.length };
    }

    case "generate-embedding": {
      const input = GenerateEmbeddingInputSchema.parse(rawInput);
      const ollama = getOllama();
      const startMs = Date.now();

      const response = await ollama.embed({
        model: input.model,
        input: input.input,
      });

      const durationMs = Date.now() - startMs;

      // embed returns embeddings as an array of arrays
      const embedding = response.embeddings[0] ?? [];

      return {
        embedding,
        dimensions: embedding.length,
        model: input.model,
        tokensIn: estimateTokens(input.input),
        durationMs,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
