import { Ollama } from "ollama";
import type { AuditLogger } from "@rsf/foundation";
import type { DetailedTarget } from "../spec-interpreter/index.js";
import { validateTypeScript } from "../generator/index.js";

export interface TestFirstResult {
  testCode: string;
  implementationCode: string;
  implementationValid: boolean;
  errors: string[];
}

interface TestFirstDeps {
  auditLogger: AuditLogger;
  ollamaBaseUrl: string;
}

export interface TestFirstPipeline {
  generateTests: (target: DetailedTarget) => Promise<string>;
  run: (target: DetailedTarget) => Promise<TestFirstResult>;
}

const TEST_GEN_PROMPT = `You are a test generator. Given a function specification, write Vitest test cases.

Rules:
- Output ONLY TypeScript test code, no markdown fences, no explanations
- Use import { describe, it, expect } from "vitest"
- Import the function being tested as: import { FUNCTION_NAME } from "./implementation"
- Cover all requirements and edge cases from the spec
- Include boundary tests from the test hints
- Each test should be independent`;

const IMPL_FROM_TESTS_PROMPT = `You are a code generator implementing a function to pass existing tests.

Rules:
- Output ONLY the TypeScript function implementation
- No markdown fences, no explanations, no imports, no exports
- The function must satisfy ALL the test cases provided
- Match the exact function signature specified`;

/**
 * Test-first generation pipeline.
 * Generates test code BEFORE implementation, then generates implementation
 * that satisfies the tests.
 */
export function createTestFirstPipeline(deps: TestFirstDeps): TestFirstPipeline {
  const { auditLogger, ollamaBaseUrl } = deps;
  const ollama = new Ollama({ host: ollamaBaseUrl });

  async function generateTests(target: DetailedTarget): Promise<string> {
    const start = Date.now();

    const prompt = `Generate Vitest tests for:
Function: ${target.functionSignature}
Description: ${target.description}
Requirements:
${target.requirements.map((r) => `- ${r}`).join("\n")}
Edge cases:
${target.edgeCases.map((e) => `- ${e}`).join("\n")}
Test hints:
${target.testHints.map((h) => `- ${h}`).join("\n")}

Use the function name "${target.name}". Import from "./implementation".`;

    const response = await ollama.generate({
      model: "qwen2.5-coder:14b",
      system: TEST_GEN_PROMPT,
      prompt,
      options: { num_predict: 2048, temperature: 0.1 },
    });

    let testCode = response.response.trim();
    const codeBlockMatch = testCode.match(/```(?:typescript|ts)?\s*\n([\s\S]*?)```/);
    if (codeBlockMatch) testCode = codeBlockMatch[1].trim();

    await auditLogger.log({
      agentId: "test-first-test-gen",
      agentType: "TEST_GENERATOR",
      actionType: "LLM_CALL",
      phase: "LAYER_3_MANUFACTURING",
      inputs: { target_name: target.name },
      outputs: { test_code_length: testCode.length },
      modelUsed: "qwen2.5-coder:14b",
      tokensIn: response.prompt_eval_count ?? 0,
      tokensOut: response.eval_count ?? 0,
      costUsd: 0,
      durationMs: Date.now() - start,
      status: "SUCCESS",
    });

    return testCode;
  }

  async function generateImplementation(
    target: DetailedTarget,
    testCode: string
  ): Promise<{ code: string; valid: boolean; errors: string[] }> {
    const start = Date.now();

    const prompt = `Implement the following function to pass these tests:

Function signature: ${target.functionSignature}
Description: ${target.description}

Tests that must pass:
${testCode}

Output ONLY the function code.`;

    const response = await ollama.generate({
      model: "qwen2.5-coder:14b",
      system: IMPL_FROM_TESTS_PROMPT,
      prompt,
      options: { num_predict: 2048, temperature: 0.1 },
    });

    let code = response.response.trim();
    const codeBlockMatch = code.match(/```(?:typescript|ts)?\s*\n([\s\S]*?)```/);
    if (codeBlockMatch) code = codeBlockMatch[1].trim();

    const validation = validateTypeScript(code);

    await auditLogger.log({
      agentId: "test-first-impl-gen",
      agentType: "CODE_GENERATOR",
      actionType: "LLM_CALL",
      phase: "LAYER_3_MANUFACTURING",
      inputs: { target_name: target.name, test_code_length: testCode.length },
      outputs: { code_length: code.length, valid: validation.valid },
      modelUsed: "qwen2.5-coder:14b",
      tokensIn: response.prompt_eval_count ?? 0,
      tokensOut: response.eval_count ?? 0,
      costUsd: 0,
      durationMs: Date.now() - start,
      status: validation.valid ? "SUCCESS" : "FAILURE",
    });

    return { code, valid: validation.valid, errors: validation.errors };
  }

  async function run(target: DetailedTarget): Promise<TestFirstResult> {
    // Step 1: Generate tests FIRST
    const testCode = await generateTests(target);

    // Step 2: Generate implementation to satisfy tests
    const impl = await generateImplementation(target, testCode);

    return {
      testCode,
      implementationCode: impl.code,
      implementationValid: impl.valid,
      errors: impl.errors,
    };
  }

  return { generateTests, run };
}
