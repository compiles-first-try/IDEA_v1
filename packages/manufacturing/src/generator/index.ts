import ts from "typescript";
import { Ollama } from "ollama";
import type { AuditLogger } from "@rsf/foundation";
import type { DetailedTarget } from "../spec-interpreter/index.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface GenerationResult {
  code: string;
  validation: ValidationResult;
  modelUsed: string;
  durationMs: number;
}

interface CodeGeneratorDeps {
  auditLogger: AuditLogger;
  ollamaBaseUrl: string;
}

export interface CodeGenerator {
  generate: (target: DetailedTarget) => Promise<GenerationResult>;
}

/**
 * Validate TypeScript code using the compiler API.
 * Checks for both syntax and type errors.
 */
export function validateTypeScript(code: string): ValidationResult {
  const filename = "generated.ts";

  // Create an in-memory compiler host
  const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.ES2022, true);

  // Resolve the default lib path for ES2022 globals (Math, Array, etc.)
  const defaultLibPath = ts.getDefaultLibFilePath({
    target: ts.ScriptTarget.ES2022,
  });
  const libDir = require("node:path").dirname(defaultLibPath);

  const compilerHost: ts.CompilerHost = {
    getSourceFile: (name, target) => {
      if (name === filename) return sourceFile;
      // Load lib files from TypeScript installation
      try {
        const libContent = require("node:fs").readFileSync(
          require("node:path").resolve(libDir, require("node:path").basename(name)),
          "utf-8"
        );
        return ts.createSourceFile(name, libContent, target ?? ts.ScriptTarget.ES2022, true);
      } catch {
        return undefined;
      }
    },
    writeFile: () => {},
    getDefaultLibFileName: () => defaultLibPath,
    useCaseSensitiveFileNames: () => true,
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => "/",
    getNewLine: () => "\n",
    fileExists: (name) =>
      name === filename ||
      (() => { try { require("node:fs").accessSync(require("node:path").resolve(libDir, require("node:path").basename(name))); return true; } catch { return false; } })(),
    readFile: (name) => {
      if (name === filename) return code;
      try {
        return require("node:fs").readFileSync(
          require("node:path").resolve(libDir, require("node:path").basename(name)),
          "utf-8"
        );
      } catch { return undefined; }
    },
  };

  const program = ts.createProgram(
    [filename],
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      lib: ["lib.es2022.d.ts"],
    },
    compilerHost
  );

  const diagnostics = [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ];

  const errors = diagnostics.map((d) => {
    const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    return message;
  });

  return { valid: errors.length === 0, errors };
}

const CODE_GEN_PROMPT = `You are a code generator. Given a specification, produce ONLY the TypeScript implementation code.

Rules:
- Output ONLY valid TypeScript code, no markdown, no explanations
- Do not include import statements unless necessary
- Do not include export statements
- Match the function signature exactly as specified
- Handle all edge cases listed
- Code must be syntactically and type-correct`;

/**
 * Create a code generator that produces TypeScript from DetailedTargets
 * and validates with the TypeScript compiler API.
 */
export function createCodeGenerator(deps: CodeGeneratorDeps): CodeGenerator {
  const { auditLogger, ollamaBaseUrl } = deps;

  async function generate(target: DetailedTarget): Promise<GenerationResult> {
    const start = Date.now();
    const ollama = new Ollama({ host: ollamaBaseUrl });

    const prompt = `Generate TypeScript code for:
Name: ${target.name}
Signature: ${target.functionSignature}
Description: ${target.description}
Parameters: ${target.parameters.map((p) => `${p.name}: ${p.type} - ${p.description}`).join(", ")}
Return type: ${target.returnType}
Requirements:
${target.requirements.map((r) => `- ${r}`).join("\n")}
Edge cases:
${target.edgeCases.map((e) => `- ${e}`).join("\n")}

Output ONLY the TypeScript function code, nothing else.`;

    const response = await ollama.generate({
      model: "qwen2.5-coder:14b",
      system: CODE_GEN_PROMPT,
      prompt,
      options: { num_predict: 2048, temperature: 0.1 },
    });

    const durationMs = Date.now() - start;

    // Extract code — strip markdown fences if present
    let code = response.response.trim();
    const codeBlockMatch = code.match(/```(?:typescript|ts)?\s*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1].trim();
    }

    const validation = validateTypeScript(code);

    await auditLogger.log({
      agentId: "code-generator",
      agentType: "CODE_GENERATOR",
      actionType: "LLM_CALL",
      phase: "LAYER_3_MANUFACTURING",
      inputs: { target_name: target.name, signature: target.functionSignature },
      outputs: { code_length: code.length, valid: validation.valid, errors: validation.errors.slice(0, 3) },
      modelUsed: "qwen2.5-coder:14b",
      tokensIn: response.prompt_eval_count ?? 0,
      tokensOut: response.eval_count ?? 0,
      costUsd: 0,
      durationMs,
      status: validation.valid ? "SUCCESS" : "FAILURE",
    });

    return { code, validation, modelUsed: "qwen2.5-coder:14b", durationMs };
  }

  return { generate };
}
