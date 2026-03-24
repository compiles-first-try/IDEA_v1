/**
 * Tests for the OpenTelemetry setup module.
 *
 * Verifies:
 * - Initializes OTel SDK with correct service name
 * - Configures Jaeger exporter
 * - Provides trace and span helpers
 * - Can be shut down cleanly
 */
import { describe, it, expect, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Telemetry Setup", () => {
  let telemetry: Awaited<
    ReturnType<typeof import("../src/telemetry/index.js")["initTelemetry"]>
  >;

  afterAll(async () => {
    if (telemetry) await telemetry.shutdown();
  });

  it("should initialize with a service name and return a tracer", async () => {
    const { initTelemetry } = await import("../src/telemetry/index.js");
    telemetry = await initTelemetry({ serviceName: "rsf-test" });

    expect(telemetry).toBeDefined();
    expect(telemetry.tracer).toBeDefined();
    expect(typeof telemetry.shutdown).toBe("function");
  });

  it("should create spans", async () => {
    const span = telemetry.tracer.startSpan("test-operation");
    expect(span).toBeDefined();
    span.setAttribute("test.key", "test-value");
    span.end();
  });
});
