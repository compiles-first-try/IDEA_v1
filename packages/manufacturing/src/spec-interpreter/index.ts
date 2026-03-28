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
  useClaudeApi?: boolean;
  anthropicApiKey?: string;
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
  const { auditLogger, ollamaBaseUrl, searchContext, useClaudeApi, anthropicApiKey } = deps;

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
    let rawResponse: string;
    let modelUsed: string;
    let tokensIn = 0;
    let tokensOut = 0;
    let costUsd = 0;

    if (useClaudeApi && anthropicApiKey) {
      // ── Claude API path (COMPLEX tier) ──
      modelUsed = "claude-haiku-4-5-20251001";
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelUsed,
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: enrichedPrompt }],
        }),
      });

      if (!claudeRes.ok) {
        const errBody = await claudeRes.text();
        throw new Error(`Claude API error ${claudeRes.status}: ${errBody.slice(0, 200)}`);
      }

      const claudeData = await claudeRes.json() as {
        content: Array<{ type: string; text: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };

      rawResponse = claudeData.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
      tokensIn = claudeData.usage?.input_tokens ?? 0;
      tokensOut = claudeData.usage?.output_tokens ?? 0;
      costUsd = (tokensIn * 0.0000008 + tokensOut * 0.000004); // haiku pricing
    } else {
      // ── Ollama path (STANDARD tier) ──
      modelUsed = "qwen2.5-coder:14b";
      const ollama = new Ollama({ host: ollamaBaseUrl });

      const response = await ollama.generate({
        model: modelUsed,
        system: SYSTEM_PROMPT,
        prompt: enrichedPrompt,
        options: { num_predict: 2048, temperature: 0.1 },
        format: "json",
      });

      rawResponse = response.response;
      tokensIn = response.prompt_eval_count ?? 0;
      tokensOut = response.eval_count ?? 0;
    }

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
      outputs: { raw: rawResponse.slice(0, 500) },
      modelUsed,
      tokensIn,
      tokensOut,
      costUsd,
      durationMs,
      status: "SUCCESS",
      reasoningTrace: contextSummary +
        `Model: ${modelUsed} (${useClaudeApi ? "cloud — COMPLEX tier" : "local — STANDARD tier"}). ` +
        `Prompt size: ${enrichedPrompt.length} chars (${spec.length} spec + ${contextBlock.length} context).`,
    });

    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("LLM did not return valid JSON");

    return DetailedTargetSchema.parse(JSON.parse(jsonMatch[0]));
  }

  return { interpret };
}
