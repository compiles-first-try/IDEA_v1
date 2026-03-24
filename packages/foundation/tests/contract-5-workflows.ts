/**
 * Workflow definition for Contract 5.
 * This file is loaded by the Temporal Worker's workflow sandbox.
 */
import { proxyActivities } from "@temporalio/workflow";

const { greet } = proxyActivities<{ greet(name: string): Promise<string> }>({
  startToCloseTimeout: "10 seconds",
});

export async function contractTestWorkflow(name: string): Promise<string> {
  return await greet(name);
}
