import { db } from "$lib/server/db";
import {
  devices,
  deviceImages,
  sources,
  images,
  runs,
  withQueryName,
} from "@packages/database";
import { and, count, desc, eq, gte, inArray, lt, ne, or } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

const PAGE_SIZE = 50;
const HOURS_72_MS = 72 * 60 * 60 * 1000;

export type GalleryImage = Awaited<ReturnType<typeof fetchImages>>[number];

/**
 * Filter options for gallery
 */
export interface GalleryFilters {
  sourceId?: string;
  deviceId?: string;
  nsfw?: "all" | "sfw" | "nsfw";
}

/**
 * Fetch images with cursor pagination and filters
 * Sort by createdAt DESC, id DESC (tie-breaker)
 * Cursor format: {timestamp}_{id}
 */
async function fetchImages(
  cursor?: string,
  filters?: GalleryFilters,
  since?: Date
) {
  const sinceDate = since ?? new Date(Date.now() - HOURS_72_MS);

  // Build where conditions
  const conditions: ReturnType<typeof gte>[] = [gte(images.createdAt, sinceDate)];

  // Cursor pagination
  if (cursor) {
    const [timestampStr, cursorId] = cursor.split("_");
    const cursorDate = new Date(parseInt(timestampStr, 10));

    // For descending order: get items where (createdAt < cursor) OR (createdAt = cursor AND id < cursorId)
    conditions.push(
      or(
        lt(images.createdAt, cursorDate),
        and(eq(images.createdAt, cursorDate), lt(images.id, cursorId))
      )!
    );
  }

  // Source filter
  if (filters?.sourceId) {
    conditions.push(eq(images.sourceId, filters.sourceId));
  }

  // NSFW filter
  if (filters?.nsfw === "sfw") {
    conditions.push(ne(images.nsfw, 1));
  } else if (filters?.nsfw === "nsfw") {
    conditions.push(eq(images.nsfw, 1));
  }

  // Device filter - need to get image IDs that belong to this device
  let deviceImageIds: string[] | undefined;
  if (filters?.deviceId) {
    const deviceImageRecords = await db
      .select({ imageId: deviceImages.imageId })
      .from(deviceImages)
      .where(eq(deviceImages.deviceId, filters.deviceId));
    deviceImageIds = deviceImageRecords
      .map((r) => r.imageId)
      .filter((id): id is string => id !== null);
    
    if (deviceImageIds.length === 0) {
      // No images for this device, return empty
      return [];
    }
    conditions.push(inArray(images.id, deviceImageIds));
  }

  return db.query.images.findMany({
    where: and(...conditions),
    orderBy: [desc(images.createdAt), desc(images.id)],
    limit: PAGE_SIZE + 1, // Fetch one extra to check if there's more
    with: {
      source: {
        columns: {
          id: true,
          name: true,
        },
      },
      deviceImages: {
        columns: {
          localPath: true,
        },
        with: {
          device: {
            columns: {
              slug: true,
            },
          },
        },
        limit: 1,
      },
    },
  });
}

/**
 * Build cursor from image
 */
function buildCursor(image: { createdAt: Date; id: string }): string {
  return `${image.createdAt.getTime()}_${image.id}`;
}

export { fetchImages, buildCursor, PAGE_SIZE, HOURS_72_MS };

export const load: PageServerLoad = async () => {
  // Get counts and first page in parallel
  const [
    imagesCount,
    devicesCount,
    sourcesCount,
    pendingRunsCount,
    imagesResult,
    allSources,
    allDevices,
  ] = await Promise.all([
    withQueryName(
      "Home.CountImages",
      async () =>
        await db
          .select({ count: count() })
          .from(images)
          .then((r) => r[0]?.count ?? 0),
    ),
    withQueryName(
      "Home.CountDevices",
      async () =>
        await db
          .select({ count: count() })
          .from(devices)
          .then((r) => r[0]?.count ?? 0),
    ),
    withQueryName(
      "Home.CountSources",
      async () =>
        await db
          .select({ count: count() })
          .from(sources)
          .then((r) => r[0]?.count ?? 0),
    ),
    withQueryName(
      "Home.CountPendingRuns",
      async () =>
        await db
          .select({ count: count() })
          .from(runs)
          .where(or(eq(runs.state, "pending"), eq(runs.state, "running")))
          .then((r) => r[0]?.count ?? 0),
    ),
    withQueryName("Home.GetRecentImages", () => fetchImages()),
    withQueryName(
      "Home.GetSourcesForFilter",
      async () =>
        await db.select({ id: sources.id, name: sources.name }).from(sources),
    ),
    withQueryName(
      "Home.GetDevicesForFilter",
      async () =>
        await db
          .select({ id: devices.id, name: devices.name, slug: devices.slug })
          .from(devices),
    ),
  ]);

  // Check if there's a next page
  const hasMore = imagesResult.length > PAGE_SIZE;
  const pageImages = hasMore ? imagesResult.slice(0, PAGE_SIZE) : imagesResult;
  const nextCursor = hasMore ? buildCursor(pageImages[pageImages.length - 1]) : null;

  return {
    metrics: {
      images: imagesCount,
      devices: devicesCount,
      sources: sourcesCount,
      pendingRuns: pendingRunsCount,
    },
    images: pageImages,
    nextCursor,
    filterOptions: {
      sources: allSources,
      devices: allDevices,
    },
  };
};
