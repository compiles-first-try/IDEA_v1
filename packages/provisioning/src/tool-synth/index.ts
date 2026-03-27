import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ollama } from "ollama";
import type { AuditLogger } from "@rsf/foundation";

const __prompt_dir = dirname(fileURLToPath(import.meta.url));
function loadPrompt(relativePath: string): string {
  return readFileSync(resolve(__prompt_dir, relativePath), "utf-8").replace(/^# System Prompt\n/, "").trim();
}

export interface ToolSynthResult {
  toolCode: string;
  zodSchema: string;
  testCode: string;
}

interface ToolSynthDeps {
  auditLogger: AuditLogger;
  ollamaBaseUrl: string;
}

export interface ToolSynthesizer {
  synthesize: (description: string) => Promise<ToolSynthResult>;
}

const SYSTEM_PROMPT = loadPrompt("../../../../workflows/provision-agent/task-2-tool-synth/data/system-prompt.md");

export function createToolSynthesizer(deps: ToolSynthDeps): ToolSynthesizer {
  const { auditLogger, ollamaBaseUrl } = deps;
  const ollama = new Ollama({ host: ollamaBaseUrl });

  async function synthesize(description: string): Promise<ToolSynthResult> {
    const start = Date.now();

    const response = await ollama.generate({
      model: "qwen2.5-coder:14b",
      system: SYSTEM_PROMPT,
      prompt: `Synthesize a tool for: ${description}`,
      options: { num_predict: 3072, temperature: 0.1 },
      format: "json",
    });

    const durationMs = Date.now() - start;

    await auditLogger.log({
      agentId: "tool-synthesizer",
      agentType: "PROVISIONING",
      actionType: "LLM_CALL",
      phase: "LAYER_5_PROVISIONING",
      inputs: { description: description.slice(0, 500) },
      outputs: { response_length: response.response.length },
      modelUsed: "qwen2.5-coder:14b",
      tokensIn: response.prompt_eval_count ?? 0,
      tokensOut: response.eval_count ?? 0,
      costUsd: 0,
      durationMs,
      status: "SUCCESS",
    });

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(response.response);
    } catch {
      const match = response.response.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("LLM did not return valid JSON");
      parsed = JSON.parse(match[0]);
    }

    // Strip markdown fences from any field
    const strip = (s: string): string => {
      const m = s.match(/```(?:typescript|ts)?\s*\n?([\s\S]*?)```/);
      return m ? m[1].trim() : s.trim();
    };

    return {
      toolCode: strip(parsed.toolCode ?? ""),
      zodSchema: strip(parsed.zodSchema ?? ""),
      testCode: strip(parsed.testCode ?? ""),
    };
  }

  return { synthesize };
}
