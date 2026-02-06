import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createRedditClient } from "@packages/reddit";

export const GET: RequestHandler = async ({ url }) => {
  const target = url.searchParams.get("target");

  if (!target) {
    error(400, "Missing 'target' parameter (subreddit or user path)");
  }

  try {
    const client = createRedditClient();
    const info = await client.getSubredditInfo(target);

    return json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch subreddit info";
    error(500, message);
  }
};
