import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ollama } from "ollama";
import type { AuditLogger } from "@rsf/foundation";
import { validateTypeScript } from "../generator/index.js";

const __prompt_dir = dirname(fileURLToPath(import.meta.url));
function loadPrompt(relativePath: string): string {
  return readFileSync(resolve(__prompt_dir, relativePath), "utf-8").replace(/^# System Prompt\n/, "").trim();
}

export interface RepairRequest {
  code: string;
  errors: string[];
  functionName: string;
  expectedSignature: string;
}

export interface RepairResult {
  repaired: boolean;
  code: string;
  attempts: number;
  errors: string[];
}

interface RepairAgentDeps {
  auditLogger: AuditLogger;
  ollamaBaseUrl: string;
  maxAttempts?: number;
}

export interface RepairAgent {
  repair: (request: RepairRequest) => Promise<RepairResult>;
}

const REPAIR_PROMPT = loadPrompt("../../../../workflows/build-pipeline/task-5-quality-gates/data/repair-prompt.md");

/**
 * Create a program repair agent that takes broken code + errors
 * and produces a repaired version.
 */
export function createRepairAgent(deps: RepairAgentDeps): RepairAgent {
  const { auditLogger, ollamaBaseUrl, maxAttempts = 3 } = deps;
  const ollama = new Ollama({ host: ollamaBaseUrl });

  async function repair(request: RepairRequest): Promise<RepairResult> {
    let currentCode = request.code;
    let currentErrors = request.errors;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const start = Date.now();

      const prompt = `Fix this broken TypeScript code:

Function signature: ${request.expectedSignature}

Broken code:
${currentCode}

Errors:
${currentErrors.map((e) => `- ${e}`).join("\n")}

Output ONLY the corrected function code.`;

      const response = await ollama.generate({
        model: "qwen2.5-coder:14b",
        system: REPAIR_PROMPT,
        prompt,
        options: { num_predict: 2048, temperature: 0.1 },
      });

      let repairedCode = response.response.trim();
      const codeBlockMatch = repairedCode.match(/```(?:typescript|ts)?\s*\n([\s\S]*?)```/);
      if (codeBlockMatch) repairedCode = codeBlockMatch[1].trim();

      const validation = validateTypeScript(repairedCode);

      await auditLogger.log({
        agentId: "program-repair",
        agentType: "PROGRAM_REPAIR",
        actionType: "LLM_CALL",
        phase: "LAYER_3_MANUFACTURING",
        inputs: {
          function_name: request.functionName,
          attempt,
          error_count: currentErrors.length,
        },
        outputs: {
          code_length: repairedCode.length,
          valid: validation.valid,
          remaining_errors: validation.errors.length,
        },
        modelUsed: "qwen2.5-coder:14b",
        tokensIn: response.prompt_eval_count ?? 0,
        tokensOut: response.eval_count ?? 0,
        costUsd: 0,
        durationMs: Date.now() - start,
        status: validation.valid ? "SUCCESS" : "FAILURE",
      });

      if (validation.valid) {
        return {
          repaired: true,
          code: repairedCode,
          attempts: attempt,
          errors: [],
        };
      }

      // Update for next iteration
      currentCode = repairedCode;
      currentErrors = validation.errors;
    }

    // Max attempts reached without valid repair
    return {
      repaired: false,
      code: currentCode,
      attempts: maxAttempts,
      errors: currentErrors,
    };
  }

  return { repair };
}
