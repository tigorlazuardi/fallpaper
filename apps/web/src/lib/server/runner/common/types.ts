import type { Source, Device } from "@packages/database";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Default temp directory: OS temp + /fallpaper */
export const DEFAULT_TEMP_DIR = join(tmpdir(), "fallpaper");

/**
 * Base configuration for all runners
 */
export interface BaseRunnerConfig {
  /** Base directory for storing images */
  imageBaseDir: string;
  /** Temporary directory for downloads (files are downloaded here first, then moved). Defaults to OS temp + /fallpaper */
  tempDir?: string;
  /** Maximum concurrent downloads */
  maxConcurrentDownloads?: number;
  /** Minimum download speed in bytes/sec before considered slow */
  minSpeedBytesPerSec?: number;
  /** Duration in ms to wait before aborting slow download */
  slowSpeedTimeoutMs?: number;
}

/**
 * Result of processing a single image
 */
export interface ImageProcessResult {
  /** Image URL that was processed */
  url: string;
  /** Whether processing was successful */
  success: boolean;
  /** Whether the image was skipped (not an error) */
  skipped?: boolean;
  /** Reason for skipping */
  skipReason?: string;
  /** Error message if failed */
  error?: string;
  /** Database image ID if saved */
  imageId?: string;
  /** Device slugs the image was assigned to */
  assignedDevices?: string[];
}

/**
 * Base result for all runners
 */
export interface BaseRunResult {
  /** Source ID that was processed */
  sourceId: string;
  /** Source name for display */
  sourceName: string;
  /** Whether the run completed successfully (may still have failed images) */
  success: boolean;
  /** Error message if the run itself failed */
  error?: string;
  /** Number of images found from source */
  imagesFound: number;
  /** Number of images that were processed (attempted download) */
  imagesProcessed: number;
  /** Number of images successfully downloaded and saved */
  imagesDownloaded: number;
  /** Number of images skipped (already exists, no eligible devices, etc.) */
  imagesSkipped: number;
  /** Number of images that failed to download/process */
  imagesFailed: number;
  /** Individual results for each image */
  results: ImageProcessResult[];
  /** Run duration in milliseconds */
  durationMs?: number;
}

/**
 * Context passed to runners
 */
export interface RunnerContext {
  /** The source being processed */
  source: Source;
  /** Eligible devices (enabled subscriptions with enabled devices) */
  eligibleDevices: Device[];
}

/**
 * Interface that all source runners must implement
 */
export interface SourceRunner<
  TConfig extends BaseRunnerConfig = BaseRunnerConfig,
  TResult extends BaseRunResult = BaseRunResult,
> {
  /** Unique identifier for this runner type (matches source.kind) */
  readonly kind: string;

  /**
   * Run the source to fetch and process images
   * @param sourceId - The source ID to process
   * @param config - Runner configuration
   * @returns Run result with statistics and individual image results
   */
  run(sourceId: string, config: TConfig): Promise<TResult>;

  /**
   * Validate source params for this runner type
   * @param params - The source.params JSON object
   * @returns null if valid, error message if invalid
   */
  validateParams(params: unknown): string | null;
}

/**
 * Registry of all available runners
 */
export type RunnerRegistry = Map<string, SourceRunner<any, any>>;

/**
 * Helper to create a runner registry
 */
export function createRunnerRegistry(): RunnerRegistry {
  return new Map();
}

/**
 * Register a runner in the registry
 */
export function registerRunner(
  registry: RunnerRegistry,
  runner: SourceRunner<any, any>,
): void {
  registry.set(runner.kind, runner);
}

/**
 * Get a runner from the registry by source kind
 */
export function getRunner(
  registry: RunnerRegistry,
  kind: string,
): SourceRunner<any, any> | undefined {
  return registry.get(kind);
}
