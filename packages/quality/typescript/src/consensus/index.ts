/**
 * Multi-Model Consensus Gate.
 *
 * Requires multiple independent evaluators (cloud + local models)
 * to agree before accepting a generated artifact. Fail-safe: reject
 * on any disagreement or error.
 */
import { Ollama } from "ollama";
import type { AuditLogger } from "@rsf/foundation";

export interface EvaluationVerdict {
  pass: boolean;
  reason: string;
  error?: string;
}

export interface Evaluator {
  name: string;
  evaluate: (code: string) => Promise<EvaluationVerdict>;
}

export interface ConsensusResult {
  accepted: boolean;
  verdicts: (EvaluationVerdict & { evaluator: string })[];
}

interface ConsensusGateDeps {
  auditLogger: AuditLogger;
  evaluators: Evaluator[];
}

export interface ConsensusGate {
  evaluate: (code: string) => Promise<ConsensusResult>;
}

/**
 * Create a consensus gate that requires ALL evaluators to pass.
 * Any failure, disagreement, or error results in rejection (fail-safe).
 */
export function createConsensusGate(deps: ConsensusGateDeps): ConsensusGate {
  const { auditLogger, evaluators } = deps;

  async function evaluate(code: string): Promise<ConsensusResult> {
    const start = Date.now();
    const verdicts: (EvaluationVerdict & { evaluator: string })[] = [];

    // Run all evaluators in parallel
    const results = await Promise.allSettled(
      evaluators.map(async (ev) => {
        const verdict = await ev.evaluate(code);
        return { evaluator: ev.name, ...verdict };
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        verdicts.push(result.value);
      } else {
        // Fail-safe: evaluator error counts as rejection
        verdicts.push({
          evaluator: evaluators[i].name,
          pass: false,
          reason: "Evaluator error",
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    const accepted = verdicts.every((v) => v.pass);

    await auditLogger.log({
      agentId: "consensus-gate",
      agentType: "QUALITY_GATE",
      actionType: "DECISION",
      phase: "LAYER_4_QUALITY",
      inputs: { code_length: code.length, evaluator_count: evaluators.length },
      outputs: {
        accepted,
        verdicts: verdicts.map((v) => ({
          evaluator: v.evaluator,
          pass: v.pass,
          reason: v.reason.slice(0, 200),
        })),
      },
      durationMs: Date.now() - start,
      status: accepted ? "SUCCESS" : "FAILURE",
    });

    return { accepted, verdicts };
  }

  return { evaluate };
}

interface OllamaEvaluatorConfig {
  name: string;
  model: string;
  ollamaBaseUrl: string;
}

const EVAL_PROMPT = `You are a code quality evaluator. Given TypeScript code, determine if it is correct and high quality.

Respond with ONLY a JSON object: {"pass": true/false, "reason": "brief explanation"}

Evaluate for:
- Correctness (does it do what the function name/signature suggests?)
- No obvious bugs
- Proper error handling where needed
- Clean code structure`;

/**
 * Create an evaluator that uses a local Ollama model.
 */
export function createOllamaEvaluator(config: OllamaEvaluatorConfig): Evaluator {
  const ollama = new Ollama({ host: config.ollamaBaseUrl });

  return {
    name: config.name,
    async evaluate(code: string): Promise<EvaluationVerdict> {
      const response = await ollama.generate({
        model: config.model,
        system: EVAL_PROMPT,
        prompt: code,
        options: { num_predict: 256, temperature: 0.1 },
        format: "json",
      });

      try {
        const parsed = JSON.parse(response.response);
        return {
          pass: Boolean(parsed.pass),
          reason: String(parsed.reason ?? ""),
        };
      } catch {
        return { pass: false, reason: "Failed to parse evaluator response" };
      }
    },
  };
}
