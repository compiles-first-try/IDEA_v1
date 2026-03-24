import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { trace, type Tracer } from "@opentelemetry/api";

export interface TelemetryInstance {
  tracer: Tracer;
  shutdown: () => Promise<void>;
}

interface TelemetryOptions {
  serviceName: string;
  otlpEndpoint?: string;
}

/**
 * Initialize OpenTelemetry SDK with OTLP HTTP exporter (Jaeger-compatible).
 * Returns a tracer and a shutdown function for clean teardown.
 */
export async function initTelemetry(
  options: TelemetryOptions
): Promise<TelemetryInstance> {
  const { serviceName, otlpEndpoint } = options;

  const exporter = new OTLPTraceExporter({
    url: otlpEndpoint ?? "http://localhost:4318/v1/traces",
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": serviceName,
    }),
    traceExporter: exporter,
  });

  sdk.start();

  const tracer = trace.getTracer(serviceName);

  return {
    tracer,
    shutdown: async () => {
      try {
        await sdk.shutdown();
      } catch {
        // Exporter flush failures during shutdown are non-critical
      }
    },
  };
}
