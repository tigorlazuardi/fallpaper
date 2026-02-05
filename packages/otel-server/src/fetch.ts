import { getLogger } from "./logger";

/**
 * Format bytes to human readable string
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// Store original fetch
let originalFetch: typeof globalThis.fetch | null = null;

/**
 * Instrumented fetch that logs HTTP client requests.
 * 
 * Log format: "http.client: [Method] [URL] - [status] [size] [duration]ms"
 * Logs at error level if status >= 400
 */
async function instrumentedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (!originalFetch) {
    throw new Error("Fetch not instrumented. Call instrumentFetch() first.");
  }

  const startTime = performance.now();
  const method = init?.method ?? "GET";
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  let response: Response;
  try {
    response = await originalFetch(input, init);
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    const logger = getLogger();
    logger.error(
      { err, method, url, durationMs: duration },
      `http.client: ${method} ${url} - FAILED ${duration}ms`
    );
    throw err;
  }

  const duration = Math.round(performance.now() - startTime);
  const status = response.status;

  // Get content-length if available
  const contentLength = response.headers.get("content-length");
  const size = contentLength ? formatSize(parseInt(contentLength, 10)) : "?B";

  const logger = getLogger();
  const message = `http.client: ${method} ${url} - ${status} ${size} ${duration}ms`;

  if (status >= 400) {
    logger.error({ method, url, status, durationMs: duration }, message);
  } else {
    logger.info({ method, url, status, durationMs: duration }, message);
  }

  return response;
}

/**
 * Instrument global fetch with logging.
 * Should be called early in application startup.
 * 
 * @example
 * ```ts
 * import { instrumentFetch } from "@packages/otel-server";
 * 
 * instrumentFetch();
 * 
 * // Now all fetch calls are logged
 * await fetch("https://api.example.com/data");
 * // Logs: "http.client: GET https://api.example.com/data - 200 1.2KB 150ms"
 * ```
 */
export function instrumentFetch(): void {
  if (originalFetch) {
    // Already instrumented
    return;
  }

  originalFetch = globalThis.fetch;
  // Use Object.assign to preserve any additional properties on fetch (like preconnect in Bun)
  globalThis.fetch = Object.assign(instrumentedFetch, globalThis.fetch) as typeof globalThis.fetch;
}

/**
 * Restore original fetch (mainly for testing).
 */
export function restoreFetch(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}
