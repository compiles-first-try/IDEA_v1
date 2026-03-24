/**
 * Contract 5: TypeScript → Temporal
 *
 * Verifies:
 * - Can connect to Temporal server at localhost:7233
 * - Can register a simple workflow
 * - Can start the workflow and wait for completion
 *
 * NOTE: This test runs via tsx (not Vitest) because Temporal's native
 * bindings are incompatible with Vite's transform pipeline.
 */
import { Client, Connection } from "@temporalio/client";
import { Worker, NativeConnection } from "@temporalio/worker";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const TASK_QUEUE = "contract-5-test-queue";

const activities = {
  async greet(name: string): Promise<string> {
    return `Hello, ${name}!`;
  },
};

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

async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";

  // Test 1: Can connect to Temporal server
  let connection: Connection | undefined;
  let client: Client | undefined;
  let nativeConnection: NativeConnection | undefined;

  try {
    connection = await Connection.connect({ address });
    client = new Client({ connection });
    assert(true, "Can connect to Temporal server at " + address);
  } catch (err) {
    assert(false, `Cannot connect to Temporal server: ${err}`);
    process.exit(1);
  }

  // Test 2: Can register a worker and run a workflow
  try {
    nativeConnection = await NativeConnection.connect({ address });

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath: path.resolve(__dirname, "./contract-5-workflows.ts"),
      activities,
    });

    assert(true, "Can create a Temporal worker");

    // Run worker in background
    const workerPromise = worker.run();

    // Wait for worker registration
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const handle = await client!.workflow.start("contractTestWorkflow", {
      taskQueue: TASK_QUEUE,
      workflowId: `contract-5-test-${Date.now()}`,
      args: ["RSF"],
    });

    const result = await handle.result();
    assert(result === "Hello, RSF!", `Workflow returned correct result: ${result}`);

    worker.shutdown();
    await workerPromise;
  } catch (err) {
    assert(false, `Workflow registration/execution failed: ${err}`);
  } finally {
    await connection?.close();
    await nativeConnection?.close();
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Contract 5 fatal error:", err);
  process.exit(1);
});
