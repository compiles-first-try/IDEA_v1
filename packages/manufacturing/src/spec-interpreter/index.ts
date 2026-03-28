import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Ollama } from "ollama";
import type { CacheClient, AuditLogger } from "@rsf/foundation";

const __prompt_dir = dirname(fileURLToPath(import.meta.url));
function loadPrompt(relativePath: string): string {
  return readFileSync(resolve(__prompt_dir, relativePath), "utf-8").replace(/^# System Prompt\n/, "").trim();
}

const ParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional().default(""),
});

export const DetailedTargetSchema = z.object({
  name: z.string(),
  description: z.string(),
  language: z.enum(["typescript", "python", "sql", "shell"]),
  type: z.enum(["function", "class", "module", "api", "test", "config"]).default("function"),
  functionSignature: z.string(),
  parameters: z.array(ParameterSchema),
  returnType: z.string(),
  requirements: z.array(z.string()),
  edgeCases: z.array(z.string()).default([]),
  testHints: z.array(z.string()).default([]),
});

export type DetailedTarget = z.infer<typeof DetailedTargetSchema>;
export type Parameter = z.infer<typeof ParameterSchema>;

export interface ContextChunk {
  content: string;
  score: number;
}

interface SpecInterpreterDeps {
  cache: CacheClient;
  auditLogger: AuditLogger;
  ollamaBaseUrl: string;
  searchContext?: (query: string) => Promise<ContextChunk[]>;
}

export interface ManufacturingSpecInterpreter {
  interpret: (spec: string) => Promise<DetailedTarget>;
}

const SYSTEM_PROMPT = loadPrompt("../../../../workflows/build-pipeline/task-1-interpret-spec/data/manufacturing-system-prompt.md");

/**
 * Create a manufacturing-layer spec interpreter that produces detailed
 * GenerationTargets with function signatures, parameters, edge cases, and test hints.
 *
 * If searchContext is provided, retrieves relevant knowledge base chunks
 * and injects them into the prompt before interpretation.
 */
export function createManufacturingSpecInterpreter(
  deps: SpecInterpreterDeps
): ManufacturingSpecInterpreter {
  const { auditLogger, ollamaBaseUrl, searchContext } = deps;

  async function interpret(spec: string): Promise<DetailedTarget> {
    // Try to parse as pre-structured JSON first
    try {
      const parsed = JSON.parse(spec);
      return DetailedTargetSchema.parse(parsed);
    } catch {
      // Not valid JSON — treat as natural language
    }

    // Retrieve relevant context from knowledge base
    let contextBlock = "";
    let contextChunks: ContextChunk[] = [];
    if (searchContext) {
      try {
        const results = await searchContext(spec);
        contextChunks = results.filter((c) => c.score >= 0.45).slice(0, 5);
        if (contextChunks.length > 0) {
          contextBlock =
            "## Project Context (retrieved from knowledge base)\n" +
            "Use the following project documentation to inform your interpretation.\n\n" +
            contextChunks
              .map((c, i) => `[${i + 1}] ${c.content.slice(0, 800)}`)
              .join("\n\n") +
            "\n\n---\n\n## User Request\n";
        }
      } catch {
        // Context search failed — proceed without context
      }
    }

    const enrichedPrompt = contextBlock + spec;

    const start = Date.now();
    const ollama = new Ollama({ host: ollamaBaseUrl });

    const response = await ollama.generate({
      model: "qwen2.5-coder:14b",
      system: SYSTEM_PROMPT,
      prompt: enrichedPrompt,
      options: { num_predict: 2048, temperature: 0.1 },
      format: "json",
    });

    const durationMs = Date.now() - start;

    const contextSummary = contextChunks.length > 0
      ? `Injected ${contextChunks.length} context chunks (best score: ${contextChunks[0].score.toFixed(2)}). `
      : "No relevant context found in knowledge base. ";

    await auditLogger.log({
      agentId: "mfg-spec-interpreter",
      agentType: "SPEC_INTERPRETER",
      actionType: "LLM_CALL",
      phase: "LAYER_3_MANUFACTURING",
      inputs: { spec: spec.slice(0, 500), contextChunksInjected: contextChunks.length },
      outputs: { raw: response.response.slice(0, 500) },
      modelUsed: "qwen2.5-coder:14b",
      tokensIn: response.prompt_eval_count ?? 0,
      tokensOut: response.eval_count ?? 0,
      costUsd: 0,
      durationMs,
      status: "SUCCESS",
      reasoningTrace: contextSummary + `Prompt size: ${enrichedPrompt.length} chars (${spec.length} spec + ${contextBlock.length} context).`,
    });

    const jsonMatch = response.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("LLM did not return valid JSON");

    return DetailedTargetSchema.parse(JSON.parse(jsonMatch[0]));
  }

  return { interpret };
}
