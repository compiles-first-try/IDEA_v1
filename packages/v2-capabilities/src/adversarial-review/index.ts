import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

interface CriticPersona {
  role: "correctness" | "adversarial" | "efficiency";
  description: string;
  focusAreas: string[];
}

interface CritiqueResult {
  verdict: "PASS" | "FAIL";
  findings: string[];
}

interface VerdictEntry {
  role: string;
  verdict: "PASS" | "FAIL";
  findings: string[];
}

interface Consensus {
  accepted: boolean;
  unanimity: "UNANIMOUS" | "DISSENT";
  dissentingCritics: string[];
  findings: string[];
}

interface PanelCritic {
  role: string;
  model: string;
  provider: string;
}

interface Panel {
  correctnessCritic: PanelCritic;
  adversarialCritic: PanelCritic;
  efficiencyCritic: PanelCritic;
}

export function getCriticPersonas(): CriticPersona[] {
  return [
    {
      role: "correctness",
      description: "Verifies that the code correctly implements all stated requirements",
      focusAreas: ["requirement coverage", "logic correctness", "type safety"],
    },
    {
      role: "adversarial",
      description: "Actively tries to break the code by finding edge cases and vulnerabilities",
      focusAreas: ["edge cases", "error handling", "security vulnerabilities", "input validation"],
    },
    {
      role: "efficiency",
      description: "Evaluates algorithmic efficiency and resource usage",
      focusAreas: ["time complexity", "space complexity", "resource leaks", "unnecessary computation"],
    },
  ];
}

export function critiqueCorrectness(params: {
  code: string;
  requirements: string[];
}): CritiqueResult {
  const findings: string[] = [];
  const codeLower = params.code.toLowerCase();

  for (const req of params.requirements) {
    const keywords = req.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const matched = keywords.some((kw) => codeLower.includes(kw));
    if (!matched) {
      findings.push(`Requirement not clearly addressed: "${req}"`);
    }
  }

  return {
    verdict: findings.length === 0 ? "PASS" : "FAIL",
    findings,
  };
}

export function critiqueAdversarial(params: {
  code: string;
  requirements: string[];
}): CritiqueResult {
  const findings: string[] = [];
  const code = params.code;

  // Check for division without zero check
  if (code.includes("/") && !code.includes("=== 0") && !code.includes("!== 0") && !code.includes("== 0") && !code.includes("!= 0")) {
    findings.push("Potential division by zero: no zero-check found before division operator");
  }

  // Check for null/undefined handling
  if (!code.includes("null") && !code.includes("undefined") && !code.includes("?")) {
    findings.push("No null/undefined checks found — may fail on nullish inputs");
  }

  // Check for bounds checking on array access
  if ((code.includes("[") && code.includes("]")) && !code.includes(".length") && !code.includes("bounds")) {
    // Only flag if it looks like array indexing, not type annotations
    const arrayAccessRegex = /\w+\[\w+\]/;
    if (arrayAccessRegex.test(code)) {
      findings.push("Array access without bounds checking detected");
    }
  }

  return {
    verdict: findings.length === 0 ? "PASS" : "FAIL",
    findings,
  };
}

export function critiqueEfficiency(params: {
  code: string;
  requirements: string[];
}): CritiqueResult {
  const findings: string[] = [];
  const code = params.code;

  // Check for recursive calls without memoization
  // Look for function name being called inside its own body
  const funcNameMatch = code.match(/function\s+(\w+)/);
  if (funcNameMatch) {
    const funcName = funcNameMatch[1];
    // Count occurrences of the function name (excluding the declaration)
    const bodyAfterDecl = code.slice(code.indexOf("{") + 1);
    if (bodyAfterDecl.includes(`${funcName}(`) && !code.includes("memo") && !code.includes("cache") && !code.includes("Map")) {
      findings.push(`Recursive function "${funcName}" detected without memoization — may have exponential time complexity`);
    }
  }

  // Check for nested loops
  const forRegex = /for\s*\(/g;
  const whileRegex = /while\s*\(/g;
  const loopMatches = [...code.matchAll(forRegex), ...code.matchAll(whileRegex)];
  if (loopMatches.length >= 2) {
    findings.push("Nested loops detected — verify O(n^2) or worse complexity is necessary");
  }

  return {
    verdict: findings.length === 0 ? "PASS" : "FAIL",
    findings,
  };
}

export function computeConsensus(verdicts: VerdictEntry[]): Consensus {
  const dissentingCritics: string[] = [];
  const allFindings: string[] = [];

  for (const v of verdicts) {
    allFindings.push(...v.findings);
    if (v.verdict === "FAIL") {
      dissentingCritics.push(v.role);
    }
  }

  const accepted = dissentingCritics.length === 0;
  const unanimity = accepted ? "UNANIMOUS" : "DISSENT";

  return {
    accepted,
    unanimity,
    dissentingCritics,
    findings: allFindings,
  };
}

export function createPanel(params: {
  generatorModel: string;
  generatorProvider: string;
}): Panel {
  // Ensure at least one critic uses a different provider than the generator
  const alternateProvider = params.generatorProvider === "ollama" ? "anthropic" : "ollama";
  const alternateModel = params.generatorProvider === "ollama" ? "claude-haiku-3-5" : "qwen2.5-coder:14b";

  return {
    correctnessCritic: {
      role: "correctness",
      model: alternateModel,
      provider: alternateProvider,
    },
    adversarialCritic: {
      role: "adversarial",
      model: alternateModel,
      provider: alternateProvider,
    },
    efficiencyCritic: {
      role: "efficiency",
      model: params.generatorModel,
      provider: params.generatorProvider,
    },
  };
}
