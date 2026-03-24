/**
 * Temporal workflow definitions for the Recursive Software Foundry.
 * Loaded by the Temporal Worker's workflow sandbox.
 */
import { proxyActivities } from "@temporalio/workflow";

interface FactoryActivities {
  interpretSpec(spec: string): Promise<string>;
  generateCode(target: string): Promise<string>;
  validateCode(code: string): Promise<boolean>;
  recordAudit(action: string, detail: string): Promise<void>;
}

const {
  interpretSpec,
  generateCode,
  validateCode,
  recordAudit,
} = proxyActivities<FactoryActivities>({
  startToCloseTimeout: "60 seconds",
  retry: {
    maximumAttempts: 3,
    initialInterval: "1 second",
    backoffCoefficient: 2,
  },
});

export interface PipelineResult {
  target: string;
  code: string;
  validated: boolean;
}

/**
 * Factory Pipeline Workflow — the core durable execution pipeline.
 *
 * Steps:
 * 1. Interpret the natural language spec into a structured target
 * 2. Generate code from the target
 * 3. Validate the generated code
 * 4. Record audit events
 *
 * Each step is an activity with automatic retries on failure.
 */
export async function factoryPipelineWorkflow(
  spec: string
): Promise<PipelineResult> {
  await recordAudit("WORKFLOW_START", `Starting pipeline for: ${spec.slice(0, 100)}`);

  // Step 1: Interpret spec
  const target = await interpretSpec(spec);
  await recordAudit("SPEC_INTERPRETED", target.slice(0, 200));

  // Step 2: Generate code
  const code = await generateCode(target);
  await recordAudit("CODE_GENERATED", code.slice(0, 200));

  // Step 3: Validate
  const validated = await validateCode(code);
  await recordAudit("CODE_VALIDATED", `Validation result: ${validated}`);

  return { target, code, validated };
}
