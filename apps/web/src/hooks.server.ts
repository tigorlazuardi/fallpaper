import { trace, context, SpanStatusCode } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { getLogger, instrumentFetch } from "@packages/otel-server";
import type { Handle } from "@sveltejs/kit";
import { startScheduler } from "$lib/server/scheduler";

const tracer = trace.getTracer("sveltekit");
const propagator = new W3CTraceContextPropagator();
const logger = getLogger();

// Instrument global fetch for HTTP client logging
instrumentFetch();

// Start scheduler once on server startup (prevent multiple starts during hot reload)
declare global {
  // eslint-disable-next-line no-var
  var __schedulerInitialized: boolean | undefined;
}

if (!globalThis.__schedulerInitialized) {
  globalThis.__schedulerInitialized = true;
  startScheduler().catch((err) => {
    logger.error({ err }, "Failed to start scheduler");
  });
}

/**
 * Extract trace context from incoming request headers.
 * Returns a context with the parent span if traceparent header is present.
 */
function extractTraceContext(request: Request) {
  const carrier: Record<string, string> = {};

  // Extract traceparent and tracestate headers
  const traceparent = request.headers.get("traceparent");
  const tracestate = request.headers.get("tracestate");

  if (traceparent) {
    carrier["traceparent"] = traceparent;
  }
  if (tracestate) {
    carrier["tracestate"] = tracestate;
  }

  // Extract context from carrier
  return propagator.extract(context.active(), carrier, {
    get(carrier, key) {
      return carrier[key];
    },
    keys(carrier) {
      return Object.keys(carrier);
    },
  });
}

/**
 * Format bytes to KB with 2 decimal places.
 */
function formatBytes(bytes: number): string {
  return (bytes / 1024).toFixed(2);
}

/**
 * Log the request with format: [Method] [Path] -- [status] [bytes]kb [duration]ms
 */
function logRequest(
  method: string,
  path: string,
  status: number,
  bytes: number,
  durationMs: number,
) {
  const message = `${method} ${path} -- ${status} ${formatBytes(bytes)}kb ${durationMs.toFixed(0)}ms`;

  if (status >= 400) {
    logger.error({ status, bytes, durationMs }, message);
  } else {
    logger.info({ status, bytes, durationMs }, message);
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  const startTime = performance.now();

  // Get the SvelteKit route path (e.g., /devices/[id]) or fallback to URL path
  const routePath = event.route.id ?? event.url.pathname;
  const method = event.request.method;
  const spanName = `${method} ${routePath}`;

  // Extract parent context from traceparent header if present
  const parentContext = extractTraceContext(event.request);

  // Start span within the extracted context (or root context if no traceparent)
  return context.with(parentContext, () => {
    const span = tracer.startSpan(spanName, {
      attributes: {
        "http.method": method,
        "http.url": event.url.href,
        "http.route": routePath,
        "http.target": event.url.pathname,
      },
    });

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const response = await resolve(event);
        const durationMs = performance.now() - startTime;

        // Get content length from header or default to 0
        const contentLength = parseInt(
          response.headers.get("content-length") ?? "0",
          10,
        );

        span.setAttribute("http.status_code", response.status);
        span.setAttribute("http.response_content_length", contentLength);

        if (response.status >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${response.status}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        // Log the request
        logRequest(method, routePath, response.status, contentLength, durationMs);

        return response;
      } catch (error) {
        const durationMs = performance.now() - startTime;

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        span.recordException(
          error instanceof Error ? error : new Error(String(error)),
        );

        // Log error request
        logger.error(
          { err: error, durationMs },
          `${method} ${routePath} -- ERROR ${durationMs.toFixed(0)}ms`,
        );

        throw error;
      } finally {
        span.end();
      }
    });
  });
};
