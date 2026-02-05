import { eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { sources, images, withQueryName } from "@packages/database";
import { createRedditClient, type RedditImage, type SortType, type TopPeriod } from "@packages/reddit";
import { getLogger } from "@packages/otel-server";
import {
  downloadAndProcessImages,
  type SourceImage,
  type SourceRunner,
  type BaseRunnerConfig,
  type BaseRunResult,
  type ProcessedImage,
} from "../common";

const logger = getLogger();

// ============================================================================
// Types
// ============================================================================

/**
 * Reddit source params stored in sources.params JSON
 */
export interface RedditSourceParams {
  subreddit: string;
  sort?: SortType;
  period?: TopPeriod;
}

/**
 * Reddit-specific runner configuration
 */
export interface RedditRunnerConfig extends BaseRunnerConfig {
  // Can add reddit-specific options here if needed
}

/**
 * Reddit-specific run result
 */
export interface RedditRunResult extends BaseRunResult {
  /** Subreddit that was fetched */
  subreddit?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert RedditImage to SourceImage for common processor
 */
function toSourceImage(img: RedditImage): SourceImage {
  return {
    downloadUrl: img.imageUrl,
    websiteUrl: img.postUrl,
    sourceItemId: img.postId,
    galleryIndex: img.galleryIndex,
    title: img.title,
    author: img.author,
    authorUrl: img.authorUrl,
    nsfw: img.nsfw,
    sourceCreatedAt: img.createdAt,
    width: img.width,
    height: img.height,
  };
}

/**
 * Format timestamp as YYYYMMDD_HHMMSS
 */
function formatTimestamp(unixSeconds?: number): string {
  const date = unixSeconds ? new Date(unixSeconds * 1000) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hour}${min}${sec}`;
}

// ============================================================================
// Reddit Runner
// ============================================================================

export class RedditRunner implements SourceRunner<RedditRunnerConfig, RedditRunResult> {
  readonly kind = "reddit";

  validateParams(params: unknown): string | null {
    if (!params || typeof params !== "object") {
      return "Params must be an object";
    }

    const p = params as Record<string, unknown>;

    if (!p.subreddit || typeof p.subreddit !== "string") {
      return "Missing or invalid subreddit";
    }

    if (p.sort !== undefined) {
      const validSorts = ["hot", "new", "top", "rising"];
      if (!validSorts.includes(p.sort as string)) {
        return `Invalid sort: must be one of ${validSorts.join(", ")}`;
      }
    }

    if (p.period !== undefined) {
      const validPeriods = ["hour", "day", "week", "month", "year", "all"];
      if (!validPeriods.includes(p.period as string)) {
        return `Invalid period: must be one of ${validPeriods.join(", ")}`;
      }
    }

    return null;
  }

  /**
   * Build a discoverable filename for Reddit images.
   * Format: reddit_{postId}[_{gallery}]_{timestamp}.{ext}
   * 
   * The postId can be used to reconstruct URL: https://redd.it/{postId}
   */
  buildFilename(
    image: { sourceItemId: string; galleryIndex?: number; sourceCreatedAt?: number | Date },
    format: string
  ): string {
    // Format timestamp
    const timestamp = typeof image.sourceCreatedAt === "number"
      ? formatTimestamp(image.sourceCreatedAt)
      : image.sourceCreatedAt
        ? formatTimestamp(Math.floor(image.sourceCreatedAt.getTime() / 1000))
        : formatTimestamp();

    // Gallery suffix only if gallery index > 0
    const gallerySuffix = image.galleryIndex && image.galleryIndex > 0 
      ? `_${image.galleryIndex}` 
      : "";

    return `reddit_${image.sourceItemId}${gallerySuffix}_${timestamp}.${format}`;
  }

  async run(sourceId: string, config: RedditRunnerConfig): Promise<RedditRunResult> {
    const startTime = Date.now();

    // 1. Get source with subscriptions
    const source = await withQueryName("RedditRunner.GetSource", async () =>
      await db.query.sources.findFirst({
        where: eq(sources.id, sourceId),
        with: {
          subscriptions: {
            with: {
              device: true,
            },
          },
        },
      })
    );

    if (!source) {
      return this.errorResult(sourceId, "Unknown", "Source not found");
    }

    const result: RedditRunResult = {
      sourceId,
      sourceName: source.name,
      success: true,
      imagesFound: 0,
      imagesProcessed: 0,
      imagesDownloaded: 0,
      imagesSkipped: 0,
      imagesFailed: 0,
      results: [],
    };

    // 2. Check if source is enabled
    if (!source.enabled) {
      logger.info({ sourceId, sourceName: source.name }, "Source is disabled, skipping");
      result.error = "Source is disabled";
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // 3. Get eligible devices (enabled subscriptions with enabled devices)
    const eligibleDevices = source.subscriptions
      .filter((sub) => sub.enabled && sub.device.enabled)
      .map((sub) => sub.device);

    if (eligibleDevices.length === 0) {
      logger.info({ sourceId, sourceName: source.name }, "No eligible devices, skipping");
      result.error = "No eligible devices subscribed";
      result.durationMs = Date.now() - startTime;
      return result;
    }

    logger.info(
      { sourceId, sourceName: source.name, deviceCount: eligibleDevices.length },
      `Running Reddit source with ${eligibleDevices.length} eligible devices`
    );

    // 4. Validate source params
    const paramsError = this.validateParams(source.params);
    if (paramsError) {
      return this.errorResult(sourceId, source.name, paramsError, startTime);
    }

    const params = source.params as RedditSourceParams;
    result.subreddit = params.subreddit;

    // 5. Fetch and process in batches using async generator
    const redditClient = createRedditClient();

    try {
      for await (const batch of redditClient.fetchSubredditBatches({
        subreddit: params.subreddit,
        sort: params.sort ?? "new",
        period: params.period ?? "day",
        limit: source.lookupLimit,
      })) {
        result.imagesFound += batch.images.length;

        logger.info(
          { sourceId, batchSize: batch.images.length, totalFound: result.imagesFound },
          `Fetched batch: ${batch.images.length} images`
        );

        if (batch.images.length === 0) {
          continue;
        }

        // Filter out already downloaded images
        const imageUrls = batch.images.map((img) => img.imageUrl);
        const existingImages = await withQueryName("RedditRunner.CheckExisting", async () =>
          await db.query.images.findMany({
            where: inArray(images.downloadUrl, imageUrls),
            columns: { downloadUrl: true },
          })
        );
        const existingUrlSet = new Set(existingImages.map((img) => img.downloadUrl));

        const newImages = batch.images.filter((img) => !existingUrlSet.has(img.imageUrl));
        const skippedExisting = batch.images.length - newImages.length;

        result.imagesSkipped += skippedExisting;

        if (newImages.length === 0) {
          logger.debug({ sourceId, skippedExisting }, `Batch skipped: all ${skippedExisting} already exist`);
          continue;
        }

        logger.info(
          { sourceId, newImages: newImages.length, skippedExisting },
          `Processing ${newImages.length} new images (${skippedExisting} already exist)`
        );

        // Convert to SourceImage and process
        const sourceImages = newImages.map(toSourceImage);

        const processResult = await downloadAndProcessImages(sourceImages, eligibleDevices, {
          sourceId,
          imageBaseDir: config.imageBaseDir,
          tempDir: config.tempDir,
          buildFilename: this.buildFilename.bind(this),
          download: {
            maxConcurrent: config.maxConcurrentDownloads,
            minSpeedBytesPerSec: config.minSpeedBytesPerSec,
            slowSpeedTimeoutMs: config.slowSpeedTimeoutMs,
          },
          onProgress: (progress) => {
            logger.debug(
              {
                url: progress.url.slice(0, 50),
                speedKBps: (progress.speedBytesPerSec / 1024).toFixed(1),
              },
              `Downloading: ${(progress.speedBytesPerSec / 1024).toFixed(1)} KB/s`
            );
          },
        });

        // Aggregate results
        result.imagesProcessed += processResult.processed;
        result.imagesDownloaded += processResult.downloaded;
        result.imagesSkipped += processResult.skipped;
        result.imagesFailed += processResult.failed;
        result.results.push(...processResult.results);
      }
    } catch (err: any) {
      logger.error({ err, sourceId }, "Failed to fetch from Reddit");
      result.success = false;
      result.error = `Reddit fetch failed: ${err.message}`;
    }

    result.durationMs = Date.now() - startTime;

    logger.info(
      {
        sourceId,
        sourceName: source.name,
        duration: result.durationMs,
        found: result.imagesFound,
        downloaded: result.imagesDownloaded,
        skipped: result.imagesSkipped,
        failed: result.imagesFailed,
      },
      `Reddit source completed in ${(result.durationMs / 1000).toFixed(1)}s`
    );

    return result;
  }

  private errorResult(
    sourceId: string,
    sourceName: string,
    error: string,
    startTime?: number
  ): RedditRunResult {
    return {
      sourceId,
      sourceName,
      success: false,
      error,
      imagesFound: 0,
      imagesProcessed: 0,
      imagesDownloaded: 0,
      imagesSkipped: 0,
      imagesFailed: 0,
      results: [],
      durationMs: startTime ? Date.now() - startTime : undefined,
    };
  }
}

export function createRedditRunner(): RedditRunner {
  return new RedditRunner();
}

export async function runRedditSource(
  sourceId: string,
  config: RedditRunnerConfig
): Promise<RedditRunResult> {
  const runner = createRedditRunner();
  return runner.run(sourceId, config);
}
