import { Ollama } from "ollama";
import type { AuditLogger } from "@rsf/foundation";

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

const SYSTEM_PROMPT = `You are a tool synthesizer. Given a tool description, produce three things as a JSON object:

1. "toolCode": A complete TypeScript function implementing the tool. No imports, no exports, just the function.
2. "zodSchema": A Zod schema string for validating the tool's input, e.g. "z.object({ celsius: z.number() })"
3. "testCode": Vitest test cases for the tool using describe/it/expect.

Output ONLY valid JSON with these three keys. No markdown.`;

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
