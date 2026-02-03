import { db } from "$lib/server/db";
import { devices, sources, images, runs } from "@packages/database";
import { count, eq, and, or, inArray } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  // Get counts in parallel
  const [
    imagesCount,
    devicesCount,
    sourcesCount,
    pendingRunsCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(images).then((r) => r[0]?.count ?? 0),
    db.select({ count: count() }).from(devices).then((r) => r[0]?.count ?? 0),
    db.select({ count: count() }).from(sources).then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(runs)
      .where(or(eq(runs.state, "pending"), eq(runs.state, "running")))
      .then((r) => r[0]?.count ?? 0),
  ]);

  // Get recent images with source info
  const recentImages = await db.query.images.findMany({
    orderBy: (images, { desc }) => [desc(images.createdAt)],
    limit: 50,
    with: {
      source: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Get all sources and devices for filter options
  const [allSources, allDevices] = await Promise.all([
    db.select({ id: sources.id, name: sources.name }).from(sources),
    db.select({ id: devices.id, name: devices.name, slug: devices.slug }).from(devices),
  ]);

  return {
    metrics: {
      images: imagesCount,
      devices: devicesCount,
      sources: sourcesCount,
      pendingRuns: pendingRunsCount,
    },
    images: recentImages,
    filterOptions: {
      sources: allSources,
      devices: allDevices,
    },
  };
};
