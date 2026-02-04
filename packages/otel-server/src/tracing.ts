import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  /** OTLP endpoint URL. If not set, tracing export is disabled. */
  otlpEndpoint?: string;
  /** Additional resource attributes */
  attributes?: Record<string, string>;
}

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing with auto-instrumentation.
 * Should be called at the very start of the application, before any other imports.
 */
export function initTracing(config: TracingConfig): NodeSDK {
  if (sdk) {
    return sdk;
  }

  const resourceAttributes: Record<string, string> = {
    [ATTR_SERVICE_NAME]: config.serviceName,
    ...config.attributes,
  };

  if (config.serviceVersion) {
    resourceAttributes[ATTR_SERVICE_VERSION] = config.serviceVersion;
  }

  const resource = new Resource(resourceAttributes);

  // Only create exporter if endpoint is configured
  const traceExporter = config.otlpEndpoint
    ? new OTLPTraceExporter({
        url: `${config.otlpEndpoint}/v1/traces`,
      })
    : undefined;

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
        // Configure HTTP instrumentation
        "@opentelemetry/instrumentation-http": {
          enabled: true,
        },
        // Configure undici/fetch instrumentation
        "@opentelemetry/instrumentation-undici": {
          enabled: true,
        },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown
  const shutdown = async () => {
    try {
      await sdk?.shutdown();
    } catch (err) {
      console.error("Error shutting down OpenTelemetry SDK", err);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return sdk;
}

/**
 * Get the initialized SDK instance.
 * Returns null if tracing hasn't been initialized.
 */
export function getTracingSDK(): NodeSDK | null {
  return sdk;
}

/**
 * Shutdown the tracing SDK gracefully.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

// Re-export commonly used OpenTelemetry API
export { trace, context, SpanStatusCode } from "@opentelemetry/api";
export type { Span, Tracer, SpanContext } from "@opentelemetry/api";
