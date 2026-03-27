import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

/**
 * Compute normalized Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function normalizedLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return levenshteinDistance(a, b) / maxLen;
}

export function measureDisagreement(
  responses: Array<{ model: string; output: string }>
): { epistemicUncertainty: number; aleatoricUncertainty: number } {
  if (responses.length < 2) {
    return { epistemicUncertainty: 0, aleatoricUncertainty: 0 };
  }

  // Compute pairwise normalized Levenshtein distances
  let totalDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      totalDistance += normalizedLevenshtein(responses[i].output, responses[j].output);
      pairCount++;
    }
  }

  const avgDistance = totalDistance / pairCount;

  // Epistemic uncertainty: driven by cross-model disagreement
  const epistemicUncertainty = avgDistance;

  // Aleatoric uncertainty: driven by output length variance (inherent task ambiguity)
  const lengths = responses.map((r) => r.output.length);
  const meanLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + (l - meanLen) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const aleatoricUncertainty = meanLen > 0 ? Math.min(stdDev / meanLen, 1) : 0;

  return { epistemicUncertainty, aleatoricUncertainty };
}

export function createEnvelope(params: {
  output: string;
  epistemicUncertainty: number;
  aleatoricUncertainty: number;
  modelsConsulted: string[];
  disagreementPoints: string[];
  knowledgeGaps: string[];
}): {
  output: string;
  uncertainty: {
    epistemic: number;
    aleatoric: number;
    modelsConsulted: string[];
    disagreementPoints: string[];
    knowledgeGaps: string[];
  };
  recommendedAction: string;
} {
  return {
    output: params.output,
    uncertainty: {
      epistemic: params.epistemicUncertainty,
      aleatoric: params.aleatoricUncertainty,
      modelsConsulted: params.modelsConsulted,
      disagreementPoints: params.disagreementPoints,
      knowledgeGaps: params.knowledgeGaps,
    },
    recommendedAction: recommendAction(params.epistemicUncertainty, params.aleatoricUncertainty),
  };
}

export function recommendAction(
  epistemic: number,
  aleatoric: number
): "PROCEED" | "SEEK_INFORMATION" | "FLAG_HUMAN" | "HALT" {
  if (epistemic >= 0.4 && aleatoric >= 0.4) return "HALT";
  if (epistemic >= 0.4) return "SEEK_INFORMATION";
  if (aleatoric >= 0.4) return "FLAG_HUMAN";
  return "PROCEED";
}
