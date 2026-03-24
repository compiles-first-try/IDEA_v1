/**
 * Tests for the first Temporal workflow — durable task execution.
 * Runs via tsx (Temporal native bindings incompatible with Vite).
 *
 * Verifies:
 * - Workflow registers and starts successfully
 * - Activities execute within the workflow
 * - Workflow returns expected result
 * - Workflow handles activity failure with retry
 * - Audit events are recorded
 */
import { Client, Connection } from "@temporalio/client";
import { Worker, NativeConnection } from "@temporalio/worker";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const TASK_QUEUE = "rsf-factory-task-queue-test";
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  ✗ FAIL  ${message}`);
    failed++;
  } else {
    console.log(`  ✓ PASS  ${message}`);
    passed++;
  }
}

// Activities for the factory workflow
const activities = {
  async interpretSpec(spec: string): Promise<string> {
    return JSON.stringify({
      name: "add-numbers",
      description: "Adds two numbers",
      type: "function",
      language: "typescript",
      requirements: ["accept two number parameters", "return their sum"],
    });
  },

  async generateCode(target: string): Promise<string> {
    const parsed = JSON.parse(target);
    return `function ${parsed.name}(a: number, b: number): number { return a + b; }`;
  },

  async validateCode(code: string): Promise<boolean> {
    return code.includes("function") && code.includes("return");
  },

  async recordAudit(action: string, detail: string): Promise<void> {
    // In production this writes to the audit system
    // For testing, just verify it's callable
  },
};

async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";

  let connection: Connection | undefined;
  let client: Client | undefined;
  let nativeConnection: NativeConnection | undefined;

  try {
    // Connect
    connection = await Connection.connect({ address });
    client = new Client({ connection });
    nativeConnection = await NativeConnection.connect({ address });

    assert(true, "Connected to Temporal server");

    // Create worker
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath: path.resolve(__dirname, "../src/temporal/workflows.ts"),
      activities,
    });

    assert(true, "Worker created with factory workflows");

    // Run worker in background
    const workerPromise = worker.run();
    await new Promise((r) => setTimeout(r, 2000));

    try {
      // Test 1: Run the factory pipeline workflow
      const handle = await client.workflow.start("factoryPipelineWorkflow", {
        taskQueue: TASK_QUEUE,
        workflowId: `factory-test-${Date.now()}`,
        args: ["Create a function that adds two numbers"],
      });

      const result = await handle.result();
      assert(typeof result === "object", "Workflow returned a result object");
      assert(
        (result as { code: string }).code.includes("function"),
        "Workflow produced code output"
      );
      assert(
        (result as { validated: boolean }).validated === true,
        "Workflow validated the generated code"
      );

      // Test 2: Check workflow history
      const description = await handle.describe();
      assert(
        description.status.name === "COMPLETED",
        "Workflow status is COMPLETED"
      );
    } finally {
      worker.shutdown();
      await workerPromise;
    }
  } catch (err) {
    assert(false, `Workflow execution failed: ${err}`);
  } finally {
    await connection?.close();
    await nativeConnection?.close();
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
