import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getRunnerConfig } from "$lib/server/config";
import { join } from "node:path";
import { existsSync, statSync } from "node:fs";

// Content type mapping
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export const GET: RequestHandler = async ({ params }) => {
  const { device, filename } = params;

  // Validate params to prevent path traversal
  if (!device || !filename) {
    error(400, "Missing device or filename");
  }

  if (device.includes("..") || filename.includes("..")) {
    error(400, "Invalid path");
  }

  // Build the file path
  const config = getRunnerConfig();
  const filePath = join(config.imageDir, device, filename);

  // Check if file exists
  if (!existsSync(filePath)) {
    error(404, "Image not found");
  }

  // Get file stats for caching headers
  const stats = statSync(filePath);

  // Determine content type from extension
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  // Read file using Bun
  const file = Bun.file(filePath);
  const data = await file.arrayBuffer();

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": stats.size.toString(),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Last-Modified": stats.mtime.toUTCString(),
    },
  });
};
