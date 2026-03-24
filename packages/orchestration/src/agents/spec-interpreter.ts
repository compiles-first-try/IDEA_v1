import { z } from "zod";
import { Ollama } from "ollama";
import Anthropic from "@anthropic-ai/sdk";
import type { AuditLogger } from "@rsf/foundation";
import type { KillSwitch } from "../kill-switch/index.js";
import type { ModelRouter, ModelResolution } from "../router/index.js";
import { defineContract, type AgentContract } from "../contracts/index.js";

/** Structured output schema for a generation target */
export const GenerationTargetSchema = z.object({
  name: z.string().describe("Short name for the artifact"),
  description: z.string().describe("What this artifact does"),
  type: z.enum(["function", "class", "module", "api", "test", "config"]),
  language: z.enum(["typescript", "python", "sql", "shell"]),
  requirements: z.array(z.string()).describe("List of functional requirements"),
  inputs: z.array(z.string()).optional().describe("Expected inputs"),
  outputs: z.array(z.string()).optional().describe("Expected outputs"),
});

export type GenerationTarget = z.infer<typeof GenerationTargetSchema>;

/** The spec interpreter's behavioral contract */
export const SPEC_INTERPRETER_CONTRACT: Readonly<AgentContract> = defineContract({
  agentId: "spec-interpreter",
  preconditions: ["kill switch is not active"],
  postconditions: ["output matches GenerationTarget schema"],
  invariants: ["all LLM calls are audited"],
  maxExecutionMs: 120_000,
  maxTokensPerCall: 4096,
  allowedTools: [],
  allowedModels: [
    "qwen2.5-coder:14b",
    "llama3.3:8b",
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6-20250514",
  ],
  requiresApproval: false,
  auditLevel: "FULL",
});

interface SpecInterpreterDeps {
  router: ModelRouter;
  killSwitch: KillSwitch;
  auditLogger: AuditLogger;
}

export interface SpecInterpreter {
  interpret: (spec: string) => Promise<GenerationTarget>;
}

const SYSTEM_PROMPT = `You are a specification interpreter. Given a natural language description of desired software, extract a structured generation target.

Respond with ONLY a valid JSON object matching this schema:
{
  "name": "short-name",
  "description": "what it does",
  "type": "function" | "class" | "module" | "api" | "test" | "config",
  "language": "typescript" | "python" | "sql" | "shell",
  "requirements": ["requirement 1", "requirement 2"],
  "inputs": ["input 1"],
  "outputs": ["output 1"]
}

Do not include any text outside the JSON object.`;

async function callOllama(
  model: string,
  prompt: string,
  baseUrl: string
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const ollama = new Ollama({ host: baseUrl });
  const response = await ollama.generate({
    model,
    system: SYSTEM_PROMPT,
    prompt,
    options: { num_predict: 2048, temperature: 0.1 },
    format: "json",
  });
  return {
    text: response.response,
    tokensIn: response.prompt_eval_count ?? 0,
    tokensOut: response.eval_count ?? 0,
  };
}

async function callAnthropic(
  model: string,
  prompt: string,
  maxTokens: number
): Promise<{ text: string; tokensIn: number; tokensOut: number; costUsd: number }> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Approximate cost
  const costUsd =
    model.includes("haiku")
      ? (response.usage.input_tokens * 0.25 + response.usage.output_tokens * 1.25) / 1_000_000
      : (response.usage.input_tokens * 3 + response.usage.output_tokens * 15) / 1_000_000;

  return {
    text,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
    costUsd,
  };
}

/**
 * Create a Specification Interpreter agent.
 * Interprets natural language specs into structured GenerationTargets.
 */
export function createSpecInterpreter(
  deps: SpecInterpreterDeps
): SpecInterpreter {
  const { router, killSwitch, auditLogger } = deps;

  async function interpret(spec: string): Promise<GenerationTarget> {
    // Precondition: kill switch
    if (await killSwitch.isActive()) {
      throw new Error("Kill switch is active — agent cannot run");
    }

    const start = Date.now();
    const tier = router.classify(spec);
    const dailySpend = await router.getDailySpend();
    const model: ModelResolution = router.resolveModel(tier, dailySpend);

    let text: string;
    let tokensIn = 0;
    let tokensOut = 0;
    let costUsd = 0;

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

    if (model.provider === "ollama") {
      const result = await callOllama(model.model, spec, ollamaBaseUrl);
      text = result.text;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
    } else {
      const result = await callAnthropic(model.model, spec, model.maxTokens);
      text = result.text;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      costUsd = result.costUsd;
      await router.recordSpend(costUsd);
    }

    const durationMs = Date.now() - start;

    // Audit the LLM call
    await auditLogger.log({
      agentId: "spec-interpreter",
      agentType: "SPEC_INTERPRETER",
      actionType: "LLM_CALL",
      phase: "LAYER_2_ORCHESTRATION",
      inputs: { spec: spec.slice(0, 500) },
      outputs: { raw_response: text.slice(0, 500) },
      modelUsed: model.model,
      tokensIn,
      tokensOut,
      costUsd,
      durationMs,
      status: "SUCCESS",
    });

    // Parse and validate output
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("LLM did not return valid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return GenerationTargetSchema.parse(parsed);
  }

  return { interpret };
}
