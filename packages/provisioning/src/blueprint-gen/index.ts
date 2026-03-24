import { z } from "zod";
import { Ollama } from "ollama";
import type { AuditLogger } from "@rsf/foundation";

const AgentContractSchema = z.object({
  agentId: z.string().default("generated-agent"),
  preconditions: z.array(z.string()).default([]),
  postconditions: z.array(z.string()).default([]),
  invariants: z.array(z.string()).default([]),
  maxExecutionMs: z.number().positive().default(60000),
  maxTokensPerCall: z.number().positive().default(4096),
  allowedTools: z.array(z.string()).default([]),
  allowedModels: z.array(z.string()).default(["qwen2.5-coder:14b"]),
  requiresApproval: z.boolean().default(false),
  auditLevel: z.enum(["FULL", "SUMMARY"]).default("FULL"),
});

type AgentContract = z.infer<typeof AgentContractSchema>;

interface AgentDefinition {
  name: string;
  systemPrompt: string;
  tools: string[];
  models: string[];
}

export interface BlueprintResult {
  contract: AgentContract;
  agentDefinition: AgentDefinition;
  testSuite: string;
}

interface BlueprintGenDeps {
  auditLogger: AuditLogger;
  ollamaBaseUrl: string;
}

export interface BlueprintGenerator {
  generate: (description: string) => Promise<BlueprintResult>;
}

const SYSTEM_PROMPT = `You are an agent architect. Given a description of a desired agent, produce a JSON blueprint.

Output ONLY a JSON object with this structure:
{
  "contract": {
    "agentId": "kebab-case-id",
    "preconditions": ["condition 1"],
    "postconditions": ["condition 1"],
    "invariants": ["invariant 1"],
    "maxExecutionMs": 60000,
    "maxTokensPerCall": 4096,
    "allowedTools": ["tool1"],
    "allowedModels": ["qwen2.5-coder:14b"],
    "requiresApproval": false,
    "auditLevel": "FULL"
  },
  "agentDefinition": {
    "name": "Agent Name",
    "systemPrompt": "You are a...",
    "tools": ["tool1"],
    "models": ["qwen2.5-coder:14b"]
  },
  "testSuite": "describe('Agent tests', () => { it('should...', () => { ... }); });"
}

Make the system prompt detailed and specific to the agent's purpose.
Include at least 3 test cases in the test suite string.`;

export function createBlueprintGenerator(deps: BlueprintGenDeps): BlueprintGenerator {
  const { auditLogger, ollamaBaseUrl } = deps;
  const MAX_RETRIES = 2;
  const ollama = new Ollama({ host: ollamaBaseUrl });

  async function generate(description: string): Promise<BlueprintResult> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await _generate(description);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError;
  }

  async function _generate(description: string): Promise<BlueprintResult> {
    const start = Date.now();

    const response = await ollama.generate({
      model: "qwen2.5-coder:14b",
      system: SYSTEM_PROMPT,
      prompt: `Create a complete agent blueprint for: ${description}`,
      options: { num_predict: 4096, temperature: 0.2 },
      format: "json",
    });

    const durationMs = Date.now() - start;

    await auditLogger.log({
      agentId: "blueprint-generator",
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

    // Robust JSON extraction — try full response first, then regex
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(response.response);
    } catch {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("LLM did not return valid JSON");
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Handle nested or flat structure
    const contractRaw = parsed.contract ?? parsed;
    const contract = AgentContractSchema.parse(contractRaw);

    const agentDef = (parsed.agentDefinition ?? {}) as Record<string, unknown>;

    return {
      contract,
      agentDefinition: {
        name: (agentDef.name as string) ?? contract.agentId,
        systemPrompt: (agentDef.systemPrompt as string) ?? "",
        tools: (agentDef.tools as string[]) ?? contract.allowedTools,
        models: (agentDef.models as string[]) ?? contract.allowedModels,
      },
      testSuite: (parsed.testSuite as string) ?? "",
    };
  }

  return { generate };
}
