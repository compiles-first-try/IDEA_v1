/**
 * Clarification Agent
 *
 * Detects ambiguity in a spec before the pipeline runs.
 * Uses Claude haiku to analyze for undefined terms, ambiguous scope,
 * missing implementation details, and contradictions.
 *
 * If needsClarification is false, the pipeline proceeds immediately
 * with zero overhead for clear specs.
 */

export interface ClarificationResult {
  needsClarification: boolean;
  questions: string[];
  confidence: number;
}

const CLARIFICATION_SYSTEM_PROMPT = `You are a specification reviewer for a code generation system called RSF (Recursive Software Foundry).

Your job is to analyze a user's software specification and determine if it is clear enough to generate code from, or if clarifying questions are needed.

Respond with ONLY a valid JSON object matching this schema:
{
  "needsClarification": boolean,
  "questions": ["question 1", "question 2"],
  "confidence": number between 0 and 1
}

Rules:
- If the spec is clear and specific enough to generate a single function/module, set needsClarification to false.
- If the spec contains undefined acronyms, ambiguous scope, missing technical details, or contradictions, set needsClarification to true.
- Ask at most 3 focused questions. Each question should be answerable in 1-2 sentences.
- Do NOT ask questions about implementation details that a competent developer could reasonably infer.
- DO ask about business requirements, domain terminology, and scope boundaries.
- confidence is your estimate of how well-defined the spec is (1.0 = crystal clear, 0.0 = completely ambiguous).
- Simple specs like "build a function that adds two numbers" should NOT need clarification.

No text outside the JSON.`;

/**
 * Detect ambiguity in a spec using Claude haiku.
 * Falls back to no-clarification-needed on API errors.
 */
export async function detectAmbiguity(
  spec: string,
  context: string[],
  anthropicApiKey: string,
): Promise<ClarificationResult> {
  const NO_CLARIFICATION: ClarificationResult = { needsClarification: false, questions: [], confidence: 1.0 };

  // Skip clarification for very short, obvious specs
  if (spec.length < 50 && !/\?/.test(spec)) {
    return NO_CLARIFICATION;
  }

  try {
    const contextBlock = context.length > 0
      ? `\n\nProject context:\n${context.map((c, i) => `[${i + 1}] ${c}`).join("\n")}\n`
      : "";

    const userMessage = `Analyze this specification for ambiguity:

${spec}${contextBlock}

Respond with JSON only.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: CLARIFICATION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      return NO_CLARIFICATION; // Fail open — don't block the pipeline
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NO_CLARIFICATION;

    const parsed = JSON.parse(jsonMatch[0]) as {
      needsClarification?: boolean;
      questions?: string[];
      confidence?: number;
    };

    return {
      needsClarification: parsed.needsClarification === true,
      questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    return NO_CLARIFICATION; // Fail open
  }
}
