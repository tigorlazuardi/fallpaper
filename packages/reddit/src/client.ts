import type {
  RedditListing,
  RedditPost,
  RedditImage,
  FetchSubredditOptions,
  FetchSubredditResult,
} from "./types";

const REDDIT_BASE_URL = "https://www.reddit.com";
const USER_AGENT = "fallpaper/1.0";

/**
 * Decode HTML entities in Reddit URLs
 */
function decodeHtmlEntities(url: string): string {
  return url
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/**
 * Check if a URL is a valid image URL
 */
function isImageUrl(url: string): boolean {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some((ext) => lowerUrl.includes(ext));
}

/**
 * Parse a single Reddit post and extract images
 */
function parsePostImages(post: RedditPost): RedditImage[] {
  const images: RedditImage[] = [];

  const baseImage = {
    postId: post.id,
    postUrl: `${REDDIT_BASE_URL}${post.permalink}`,
    title: post.title,
    author: post.author,
    authorUrl: `${REDDIT_BASE_URL}/u/${post.author}`,
    subreddit: post.subreddit,
    nsfw: post.over_18,
    createdAt: post.created_utc,
    score: post.score,
  };

  // Skip videos
  if (post.is_video) {
    return images;
  }

  // Handle gallery posts
  if (post.is_gallery && post.gallery_data && post.media_metadata) {
    for (let i = 0; i < post.gallery_data.items.length; i++) {
      const item = post.gallery_data.items[i];
      const media = post.media_metadata[item.media_id];

      if (!media || media.status !== "valid" || media.e !== "Image") {
        continue;
      }

      const source = media.s;
      if (!source || !source.u) {
        continue;
      }

      const imageUrl = decodeHtmlEntities(source.u);
      if (!isImageUrl(imageUrl)) {
        continue;
      }

      images.push({
        ...baseImage,
        imageUrl,
        width: source.width,
        height: source.height,
        galleryIndex: i,
      });
    }
    return images;
  }

  // Handle single image posts with preview
  if (post.preview?.images?.[0]?.source) {
    const source = post.preview.images[0].source;
    const imageUrl = decodeHtmlEntities(source.url);

    if (isImageUrl(imageUrl)) {
      images.push({
        ...baseImage,
        imageUrl,
        width: source.width,
        height: source.height,
        galleryIndex: 0,
      });
      return images;
    }
  }

  // Handle direct image URLs (e.g., i.redd.it, i.imgur.com)
  if (post.post_hint === "image" && isImageUrl(post.url)) {
    // We don't have dimensions here, will need to get from download
    // Use 0 to indicate unknown dimensions
    images.push({
      ...baseImage,
      imageUrl: post.url,
      width: 0,
      height: 0,
      galleryIndex: 0,
    });
    return images;
  }

  return images;
}

export interface RedditClientConfig {
  /** Request timeout in milliseconds. Default: 30000 */
  timeout?: number;
  /** Custom user agent */
  userAgent?: string;
}

/**
 * Reddit API client for fetching subreddit posts and images.
 * Pure metadata fetcher - no database access, no downloading.
 */
export class RedditClient {
  private timeout: number;
  private userAgent: string;

  constructor(config: RedditClientConfig = {}) {
    this.timeout = config.timeout ?? 30000;
    this.userAgent = config.userAgent ?? USER_AGENT;
  }

  /**
   * Parse subreddit/user path and return the base URL path
   * - /r/wallpapers -> /r/wallpapers
   * - /user/username -> /user/username/submitted
   * - /u/username -> /user/username/submitted
   * - wallpapers (no prefix) -> /r/wallpapers
   */
  private parseTargetPath(target: string): string {
    // Handle /user/ or /u/ prefix - these need /submitted suffix for posts
    if (target.startsWith("/user/") || target.startsWith("/u/")) {
      const username = target.replace(/^\/(user|u)\//, "");
      return `/user/${username}/submitted`;
    }
    
    // Handle /r/ prefix - use as-is
    if (target.startsWith("/r/")) {
      return target;
    }
    
    // No prefix - assume subreddit
    return `/r/${target}`;
  }

  /**
   * Fetch a single page of images from a subreddit or user
   */
  async fetchSubreddit(options: FetchSubredditOptions): Promise<FetchSubredditResult> {
    const {
      subreddit: target,
      sort = "new",
      period = "day",
      limit = 25,
      after,
    } = options;

    const basePath = this.parseTargetPath(target);

    // Build URL
    let url = `${REDDIT_BASE_URL}${basePath}/${sort}.json?limit=${limit}&raw_json=1`;
    if (sort === "top" && period) {
      url += `&t=${period}`;
    }
    if (after) {
      url += `&after=${after}`;
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": this.userAgent,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    const listing = (await response.json()) as RedditListing<RedditPost>;
    const images: RedditImage[] = [];
    let postsProcessed = 0;

    for (const child of listing.data.children) {
      if (child.kind !== "t3") continue; // Skip non-post items

      const post = child.data;
      postsProcessed++;

      // Skip self posts, stickied posts
      if (post.is_self || post.stickied) {
        continue;
      }

      const postImages = parsePostImages(post);
      images.push(...postImages);
    }

    return {
      images,
      after: listing.data.after,
      postsProcessed,
    };
  }

  /**
   * Async generator that yields batches of images from a subreddit.
   * Each yield returns images from one API request (up to 100 items).
   * Allows processing to start while fetching continues.
   * 
   * @example
   * ```ts
   * const client = createRedditClient();
   * 
   * for await (const batch of client.fetchSubredditBatches({ subreddit: "wallpapers", limit: 300 })) {
   *   console.log(`Got ${batch.images.length} images, processing...`);
   *   await processImages(batch.images);
   * }
   * ```
   */
  async *fetchSubredditBatches(
    options: FetchSubredditOptions
  ): AsyncGenerator<FetchSubredditResult, void, unknown> {
    const { limit = 25, ...rest } = options;
    let after: string | undefined = undefined;
    let remaining = limit;

    while (remaining > 0) {
      const pageLimit = Math.min(remaining, 100); // Reddit max is 100 per request
      
      const result = await this.fetchSubreddit({
        ...rest,
        limit: pageLimit,
        after,
      });

      yield result;

      remaining -= result.postsProcessed;
      after = result.after ?? undefined;

      // No more pages available
      if (!after) break;

      // Rate limiting: wait 1 second between requests
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Fetch all images from a subreddit (convenience method).
   * For large limits, prefer using fetchSubredditBatches() to process incrementally.
   */
  async fetchSubredditAll(options: FetchSubredditOptions): Promise<RedditImage[]> {
    const allImages: RedditImage[] = [];
    
    for await (const batch of this.fetchSubredditBatches(options)) {
      allImages.push(...batch.images);
    }
    
    return allImages;
  }
}

/**
 * Create a new Reddit client instance
 */
export function createRedditClient(config?: RedditClientConfig): RedditClient {
  return new RedditClient(config);
}
