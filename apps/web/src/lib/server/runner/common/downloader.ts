import { getLogger } from "@packages/otel-server";

export interface DownloadConfig {
  /** Minimum download speed in bytes/sec before considered slow. Default: 10KB/s */
  minSpeedBytesPerSec?: number;
  /** Duration in ms to wait before aborting slow download. Default: 10000ms (10s) */
  slowSpeedTimeoutMs?: number;
  /** Speed check interval in ms. Default: 1000ms (1s) */
  speedCheckIntervalMs?: number;
  /** Maximum concurrent downloads. Default: 4 */
  maxConcurrent?: number;
  /** Request timeout in ms. Default: 60000ms (1 min) */
  requestTimeoutMs?: number;
}

export interface DownloadResult {
  /** Whether download was successful */
  success: boolean;
  /** Downloaded data as ArrayBuffer (if successful) */
  data?: ArrayBuffer;
  /** Final file size in bytes */
  size?: number;
  /** Content type from response headers */
  contentType?: string;
  /** Error message if failed */
  error?: string;
  /** Whether download was aborted due to slow speed */
  slowAbort?: boolean;
}

export interface DownloadProgress {
  url: string;
  bytesDownloaded: number;
  totalBytes: number | null;
  speedBytesPerSec: number;
  elapsedMs: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Download a single file with slow speed detection
 */
export async function downloadWithSpeedCheck(
  url: string,
  config: DownloadConfig = {},
  onProgress?: ProgressCallback
): Promise<DownloadResult> {
  const {
    minSpeedBytesPerSec = 10 * 1024, // 10 KB/s
    slowSpeedTimeoutMs = 10000, // 10 seconds
    speedCheckIntervalMs = 1000, // 1 second
    requestTimeoutMs = 60000, // 1 minute
  } = config;

  const logger = getLogger();
  const startTime = Date.now();
  let bytesDownloaded = 0;
  let slowStartTime: number | null = null;
  let lastCheckTime = startTime;
  let lastCheckBytes = 0;
  let abortController: AbortController | null = new AbortController();

  try {
    const response = await fetch(url, {
      signal: abortController.signal,
      headers: {
        "User-Agent": "fallpaper/1.0",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") ?? undefined;
    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : null;

    if (!response.body) {
      return {
        success: false,
        error: "No response body",
      };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];

    // Speed check interval
    const speedChecker = setInterval(() => {
      const now = Date.now();
      const intervalMs = now - lastCheckTime;
      const intervalBytes = bytesDownloaded - lastCheckBytes;
      const speedBytesPerSec = (intervalBytes / intervalMs) * 1000;

      // Report progress
      if (onProgress) {
        onProgress({
          url,
          bytesDownloaded,
          totalBytes,
          speedBytesPerSec,
          elapsedMs: now - startTime,
        });
      }

      // Check for slow speed
      if (speedBytesPerSec < minSpeedBytesPerSec) {
        if (slowStartTime === null) {
          slowStartTime = now;
          logger.warn(
            { url, speedKBps: (speedBytesPerSec / 1024).toFixed(2) },
            `Slow download detected: ${(speedBytesPerSec / 1024).toFixed(2)} KB/s`
          );
        } else if (now - slowStartTime >= slowSpeedTimeoutMs) {
          logger.warn(
            { url, slowDurationMs: now - slowStartTime },
            `Aborting slow download after ${((now - slowStartTime) / 1000).toFixed(1)}s`
          );
          abortController?.abort();
        }
      } else {
        // Speed recovered, reset slow timer
        if (slowStartTime !== null) {
          logger.debug({ url }, "Download speed recovered");
        }
        slowStartTime = null;
      }

      lastCheckTime = now;
      lastCheckBytes = bytesDownloaded;
    }, speedCheckIntervalMs);

    // Timeout for entire download
    const downloadTimeout = setTimeout(() => {
      logger.warn({ url, timeoutMs: requestTimeoutMs }, "Download timeout");
      abortController?.abort();
    }, requestTimeoutMs);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        bytesDownloaded += value.length;
      }
    } finally {
      clearInterval(speedChecker);
      clearTimeout(downloadTimeout);
    }

    // Combine chunks into single ArrayBuffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    logger.debug(
      { url, sizeKB: (totalLength / 1024).toFixed(2), durationMs: Date.now() - startTime },
      `Downloaded ${(totalLength / 1024).toFixed(2)} KB in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
    );

    return {
      success: true,
      data: result.buffer,
      size: totalLength,
      contentType,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return {
        success: false,
        error: "Download aborted",
        slowAbort: slowStartTime !== null,
      };
    }
    return {
      success: false,
      error: err.message ?? String(err),
    };
  } finally {
    abortController = null;
  }
}

/**
 * Download queue item
 */
interface QueueItem<T> {
  url: string;
  context: T;
  resolve: (result: DownloadResult & { context: T }) => void;
}

/**
 * Parallel downloader with concurrency limit and slow speed detection
 */
export class ParallelDownloader<T = unknown> {
  private config: Required<DownloadConfig>;
  private queue: QueueItem<T>[] = [];
  private activeDownloads = 0;
  private onProgress?: ProgressCallback;

  constructor(config: DownloadConfig = {}, onProgress?: ProgressCallback) {
    this.config = {
      minSpeedBytesPerSec: config.minSpeedBytesPerSec ?? 10 * 1024,
      slowSpeedTimeoutMs: config.slowSpeedTimeoutMs ?? 10000,
      speedCheckIntervalMs: config.speedCheckIntervalMs ?? 1000,
      maxConcurrent: config.maxConcurrent ?? 4,
      requestTimeoutMs: config.requestTimeoutMs ?? 60000,
    };
    this.onProgress = onProgress;
  }

  /**
   * Add a URL to the download queue
   */
  async download(url: string, context: T): Promise<DownloadResult & { context: T }> {
    return new Promise((resolve) => {
      this.queue.push({ url, context, resolve });
      this.processQueue();
    });
  }

  /**
   * Download multiple URLs in parallel
   */
  async downloadAll(
    items: Array<{ url: string; context: T }>
  ): Promise<Array<DownloadResult & { context: T }>> {
    const promises = items.map((item) => this.download(item.url, item.context));
    return Promise.all(promises);
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeDownloads < this.config.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeDownloads++;

      // Don't await - let it run in parallel
      this.processItem(item).finally(() => {
        this.activeDownloads--;
        this.processQueue();
      });
    }
  }

  private async processItem(item: QueueItem<T>): Promise<void> {
    const result = await downloadWithSpeedCheck(item.url, this.config, this.onProgress);
    item.resolve({ ...result, context: item.context });
  }
}

/**
 * Create a parallel downloader instance
 */
export function createDownloader<T = unknown>(
  config?: DownloadConfig,
  onProgress?: ProgressCallback
): ParallelDownloader<T> {
  return new ParallelDownloader<T>(config, onProgress);
}
