import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

export function checkCoverage(params: {
  requirements: string[];
  testCode: string;
}): {
  coveredRequirements: number;
  totalRequirements: number;
  uncoveredRequirements: string[];
} {
  const testCodeLower = params.testCode.toLowerCase();
  const uncovered: string[] = [];
  let covered = 0;

  for (const req of params.requirements) {
    // Check if the requirement text (case-insensitive) appears in the test code
    // Use individual significant words for matching
    const words = req.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const matchCount = words.filter((w) => testCodeLower.includes(w)).length;
    const matchRatio = words.length > 0 ? matchCount / words.length : 0;

    if (matchRatio > 0.5) {
      covered++;
    } else {
      uncovered.push(req);
    }
  }

  return {
    coveredRequirements: covered,
    totalRequirements: params.requirements.length,
    uncoveredRequirements: uncovered,
  };
}

export function checkGameability(params: {
  functionName: string;
  testCode: string;
}): { gameable: boolean; reason: string } {
  // Count unique expect assertions — handle nested parentheses
  const expectRegex = /expect\s*\((?:[^)(]*|\((?:[^)(]*|\([^)(]*\))*\))*\)\s*\.\s*\w+\s*\((?:[^)(]*|\((?:[^)(]*|\([^)(]*\))*\))*\)/g;
  const matches = params.testCode.match(expectRegex) ?? [];

  // Deduplicate assertions
  const uniqueAssertions = new Set(matches.map((m) => m.trim()));

  if (uniqueAssertions.size < 3) {
    return {
      gameable: true,
      reason: `Only ${uniqueAssertions.size} unique assertion(s) found — a single hardcoded return value could pass. Need at least 3 distinct assertions.`,
    };
  }

  return {
    gameable: false,
    reason: `${uniqueAssertions.size} distinct assertions found — difficult to game with a trivial implementation.`,
  };
}

export function validate(params: {
  requirements: string[];
  edgeCases: string[];
  testCode: string;
  functionName: string;
}): {
  coverageScore: number;
  gameabilityCheck: { gameable: boolean; reason: string };
  overallVerdict: "PASS" | "FAIL";
} {
  const allRequirements = [...params.requirements, ...params.edgeCases];
  const coverage = checkCoverage({ requirements: allRequirements, testCode: params.testCode });
  const gameability = checkGameability({
    functionName: params.functionName,
    testCode: params.testCode,
  });

  const coverageScore = allRequirements.length > 0
    ? coverage.coveredRequirements / coverage.totalRequirements
    : 0;

  const overallVerdict: "PASS" | "FAIL" =
    coverageScore >= 0.8 && !gameability.gameable ? "PASS" : "FAIL";

  return {
    coverageScore,
    gameabilityCheck: gameability,
    overallVerdict,
  };
}
