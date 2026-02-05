import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { fetchImages, buildCursor, PAGE_SIZE } from "../../+page.server";
import type { GalleryFilters } from "../../+page.server";
import { withQueryName } from "@packages/database";

export const GET: RequestHandler = async ({ url }) => {
  const cursor = url.searchParams.get("cursor") ?? undefined;
  
  // Parse filter params
  const filters: GalleryFilters = {};
  
  const sourceId = url.searchParams.get("sourceId");
  if (sourceId) filters.sourceId = sourceId;
  
  const deviceId = url.searchParams.get("deviceId");
  if (deviceId) filters.deviceId = deviceId;
  
  const nsfw = url.searchParams.get("nsfw");
  if (nsfw === "all" || nsfw === "sfw" || nsfw === "nsfw") {
    filters.nsfw = nsfw;
  }

  const imagesResult = await withQueryName(
    "API.Gallery.FetchImages",
    () => fetchImages(cursor, filters)
  );

  // Check if there's a next page
  const hasMore = imagesResult.length > PAGE_SIZE;
  const pageImages = hasMore ? imagesResult.slice(0, PAGE_SIZE) : imagesResult;
  const nextCursor = hasMore && pageImages.length > 0 
    ? buildCursor(pageImages[pageImages.length - 1]) 
    : null;

  return json({
    images: pageImages,
    nextCursor,
  });
};
