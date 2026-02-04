import { db } from "$lib/server/db";
import { images, deviceImages, withQueryName, type Device } from "@packages/database";
import { getLogger } from "@packages/otel-server";
import { createDownloader, type ProgressCallback } from "./downloader";
import { getEligibleDevices, type ImageMetadata } from "./image-filter";
import { DEFAULT_TEMP_DIR } from "./types";
import { mkdirSync, unlinkSync, copyFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const logger = getLogger();

// ============================================================================
// Types
// ============================================================================

/**
 * Source image data (from any source like Reddit, Wallhaven, etc.)
 */
export interface SourceImage {
  /** URL to download the image from */
  downloadUrl: string;
  /** URL to the source website/page */
  websiteUrl: string;
  /** Image title */
  title?: string;
  /** Author/uploader name */
  author?: string;
  /** Author profile URL */
  authorUrl?: string;
  /** Whether the image is NSFW */
  nsfw: boolean;
  /** When the image was created at source (unix timestamp or Date) */
  sourceCreatedAt?: number | Date;
  /** Known width (0 if unknown, will be detected from download) */
  width?: number;
  /** Known height (0 if unknown, will be detected from download) */
  height?: number;
}

/**
 * Result of processing a single image
 */
export interface ProcessedImage {
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
 * Configuration for image processor
 */
export interface ImageProcessorConfig {
  /** Source ID for database records */
  sourceId: string;
  /** Base directory for storing images */
  imageBaseDir: string;
  /** Temporary directory for downloads */
  tempDir?: string;
  /** Download configuration */
  download?: {
    /** Maximum concurrent downloads. Default: 4 */
    maxConcurrent?: number;
    /** Minimum download speed in bytes/sec. Default: 10KB/s */
    minSpeedBytesPerSec?: number;
    /** Duration in ms before aborting slow download. Default: 10s */
    slowSpeedTimeoutMs?: number;
  };
  /** Progress callback for downloads */
  onProgress?: ProgressCallback;
}

/**
 * Result of batch processing
 */
export interface BatchProcessResult {
  /** Total images processed */
  processed: number;
  /** Successfully downloaded and saved */
  downloaded: number;
  /** Skipped (already exists, no eligible devices, slow download, etc.) */
  skipped: number;
  /** Failed to download or process */
  failed: number;
  /** Individual results */
  results: ProcessedImage[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get image format from content type or URL
 */
export function getImageFormat(contentType?: string, url?: string): string {
  if (contentType) {
    const match = contentType.match(/image\/(\w+)/);
    if (match) return match[1].toLowerCase();
  }
  if (url) {
    const match = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
    if (match) return match[1].toLowerCase();
  }
  return "jpg";
}

/**
 * Calculate MD5 hash of data
 */
export function calculateHash(data: ArrayBuffer): string {
  return createHash("md5").update(Buffer.from(data)).digest("hex");
}

/**
 * Get image dimensions from buffer using minimal parsing
 * Supports: JPEG, PNG, GIF, WebP
 */
export function getImageDimensions(buffer: ArrayBuffer): { width: number; height: number } | null {
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // PNG: 89 50 4E 47
  if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47) {
    return {
      width: view.getUint32(16, false),
      height: view.getUint32(20, false),
    };
  }

  // JPEG: FF D8 FF
  if (uint8[0] === 0xff && uint8[1] === 0xd8 && uint8[2] === 0xff) {
    let offset = 2;
    while (offset < buffer.byteLength - 8) {
      if (uint8[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = uint8[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          height: view.getUint16(offset + 5, false),
          width: view.getUint16(offset + 7, false),
        };
      }
      const length = view.getUint16(offset + 2, false);
      offset += 2 + length;
    }
    return null;
  }

  // GIF: 47 49 46
  if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46) {
    return {
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    };
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46 &&
      uint8[8] === 0x57 && uint8[9] === 0x45 && uint8[10] === 0x42 && uint8[11] === 0x50) {
    // VP8 lossy
    if (uint8[12] === 0x56 && uint8[13] === 0x50 && uint8[14] === 0x38 && uint8[15] === 0x20) {
      const w = view.getUint16(26, true) & 0x3fff;
      const h = view.getUint16(28, true) & 0x3fff;
      return { width: w, height: h };
    }
    // VP8L lossless
    if (uint8[12] === 0x56 && uint8[13] === 0x50 && uint8[14] === 0x38 && uint8[15] === 0x4c) {
      const bits = view.getUint32(21, true);
      const w = (bits & 0x3fff) + 1;
      const h = ((bits >> 14) & 0x3fff) + 1;
      return { width: w, height: h };
    }
    // VP8X extended
    if (uint8[12] === 0x56 && uint8[13] === 0x50 && uint8[14] === 0x38 && uint8[15] === 0x58) {
      const w = ((uint8[24] | (uint8[25] << 8) | (uint8[26] << 16)) & 0xffffff) + 1;
      const h = ((uint8[27] | (uint8[28] << 8) | (uint8[29] << 16)) & 0xffffff) + 1;
      return { width: w, height: h };
    }
  }

  return null;
}

// ============================================================================
// Image Processor
// ============================================================================

/**
 * Process and save a single downloaded image
 */
export async function processDownloadedImage(
  data: ArrayBuffer,
  contentType: string | undefined,
  sourceImage: SourceImage,
  eligibleDevices: Device[],
  config: ImageProcessorConfig
): Promise<ProcessedImage> {
  const result: ProcessedImage = {
    success: false,
  };

  // Get/detect dimensions
  let width = sourceImage.width ?? 0;
  let height = sourceImage.height ?? 0;

  if (width === 0 || height === 0) {
    const dims = getImageDimensions(data);
    if (!dims) {
      result.error = "Could not determine image dimensions";
      return result;
    }
    width = dims.width;
    height = dims.height;
  }

  const filesize = data.byteLength;
  const format = getImageFormat(contentType, sourceImage.downloadUrl);

  // Build image metadata for filtering
  const metadata: ImageMetadata = {
    width,
    height,
    filesize,
    nsfw: sourceImage.nsfw,
  };

  // Find eligible devices for this image
  const eligible = getEligibleDevices(eligibleDevices, metadata);

  if (eligible.length === 0) {
    result.skipped = true;
    result.skipReason = "No eligible devices";
    return result;
  }

  // Calculate hash for deduplication
  const checksum = calculateHash(data);

  // Write to temp directory first
  const tempDir = config.tempDir ?? DEFAULT_TEMP_DIR;
  mkdirSync(tempDir, { recursive: true });
  const tempFilename = `${randomUUID()}.${format}`;
  const tempPath = join(tempDir, tempFilename);
  await Bun.write(tempPath, data);

  try {
    // Insert image record
    const aspectRatio = width / height;
    const sourceCreatedAt = sourceImage.sourceCreatedAt
      ? (typeof sourceImage.sourceCreatedAt === "number"
          ? new Date(sourceImage.sourceCreatedAt * 1000)
          : sourceImage.sourceCreatedAt)
      : undefined;

    const newImage = await withQueryName("ImageProcessor.InsertImage", async () => {
      const [inserted] = await db
        .insert(images)
        .values({
          sourceId: config.sourceId,
          websiteUrl: sourceImage.websiteUrl,
          downloadUrl: sourceImage.downloadUrl,
          checksum,
          width,
          height,
          aspectRatio,
          filesize,
          format,
          title: sourceImage.title ?? null,
          nsfw: sourceImage.nsfw ? 1 : 0,
          author: sourceImage.author ?? null,
          authorUrl: sourceImage.authorUrl ?? null,
          sourceCreatedAt,
        })
        .returning();
      return inserted;
    });

    result.imageId = newImage.id;
    result.assignedDevices = [];

    // Create device_images entries and copy files from temp
    const filename = `${newImage.id}.${format}`;
    let isFirstDevice = true;

    for (const device of eligible) {
      const deviceDir = join(config.imageBaseDir, device.slug);
      mkdirSync(deviceDir, { recursive: true });

      const localPath = join(deviceDir, filename);

      // For first device, move the temp file; for others, copy from first
      if (isFirstDevice) {
        renameSync(tempPath, localPath);
        isFirstDevice = false;
      } else {
        const firstDeviceSlug = result.assignedDevices[0];
        const sourcePath = join(config.imageBaseDir, firstDeviceSlug, filename);
        copyFileSync(sourcePath, localPath);
      }

      // Insert device_image record
      await withQueryName("ImageProcessor.InsertDeviceImage", async () =>
        await db.insert(deviceImages).values({
          deviceId: device.id,
          imageId: newImage.id,
          localPath,
        })
      );

      result.assignedDevices.push(device.slug);
    }

    result.success = true;

    logger.debug(
      {
        imageId: newImage.id,
        devices: result.assignedDevices,
        size: filesize,
      },
      `Saved image to ${eligible.length} devices`
    );

    return result;
  } catch (err) {
    // Clean up temp file if it still exists
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Download and process multiple images in parallel
 */
export async function downloadAndProcessImages<T extends SourceImage>(
  sourceImages: T[],
  eligibleDevices: Device[],
  config: ImageProcessorConfig
): Promise<BatchProcessResult> {
  const result: BatchProcessResult = {
    processed: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  if (sourceImages.length === 0) {
    return result;
  }

  // Create downloader with config
  const downloader = createDownloader<T>(
    {
      maxConcurrent: config.download?.maxConcurrent ?? 4,
      minSpeedBytesPerSec: config.download?.minSpeedBytesPerSec ?? 10 * 1024,
      slowSpeedTimeoutMs: config.download?.slowSpeedTimeoutMs ?? 10000,
    },
    config.onProgress
  );

  // Download all images
  const downloadResults = await downloader.downloadAll(
    sourceImages.map((img) => ({ url: img.downloadUrl, context: img }))
  );

  // Process each downloaded image
  for (const dlResult of downloadResults) {
    const sourceImage = dlResult.context;
    result.processed++;

    // Download failed
    if (!dlResult.success || !dlResult.data) {
      const processResult: ProcessedImage = {
        success: false,
        error: dlResult.error ?? "Download failed",
      };

      if (dlResult.slowAbort) {
        processResult.skipped = true;
        processResult.skipReason = "Slow download aborted";
        result.skipped++;
      } else {
        result.failed++;
      }

      result.results.push(processResult);
      continue;
    }

    // Process the downloaded image
    try {
      const processResult = await processDownloadedImage(
        dlResult.data,
        dlResult.contentType,
        sourceImage,
        eligibleDevices,
        config
      );

      if (processResult.success) {
        result.downloaded++;
      } else if (processResult.skipped) {
        result.skipped++;
      } else {
        result.failed++;
      }

      result.results.push(processResult);
    } catch (err: any) {
      result.failed++;
      result.results.push({
        success: false,
        error: err.message ?? String(err),
      });
    }
  }

  return result;
}
