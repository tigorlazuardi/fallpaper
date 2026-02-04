/**
 * Reddit API response types
 */

export interface RedditListing<T> {
  kind: "Listing";
  data: {
    after: string | null;
    before: string | null;
    children: Array<{ kind: string; data: T }>;
    dist: number;
    modhash: string;
  };
}

export interface RedditPost {
  id: string;
  name: string; // fullname e.g. "t3_abc123"
  title: string;
  author: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  permalink: string;
  url: string;
  created_utc: number;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  over_18: boolean;
  spoiler: boolean;
  stickied: boolean;
  is_self: boolean;
  is_video: boolean;
  is_gallery?: boolean;
  post_hint?: string;
  domain: string;

  // Image data (when post_hint is "image")
  preview?: {
    images: Array<{
      source: RedditImageSource;
      resolutions: RedditImageSource[];
      id: string;
    }>;
    enabled: boolean;
  };

  // Gallery data
  gallery_data?: {
    items: Array<{
      media_id: string;
      id: number;
      caption?: string;
    }>;
  };
  media_metadata?: Record<string, RedditMediaMetadata>;
}

export interface RedditImageSource {
  url: string;
  width: number;
  height: number;
}

export interface RedditMediaMetadata {
  status: string;
  e: string; // "Image" or "AnimatedImage"
  m: string; // mime type e.g. "image/jpg"
  p: RedditImageSource[]; // preview resolutions
  s: RedditImageSource & { u?: string; gif?: string; mp4?: string }; // source
  id: string;
}

/**
 * Parsed image data ready for processing
 */
export interface RedditImage {
  /** Reddit post ID */
  postId: string;
  /** URL to the Reddit post */
  postUrl: string;
  /** Direct URL to the image */
  imageUrl: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Post title */
  title: string;
  /** Post author */
  author: string;
  /** Author profile URL */
  authorUrl: string;
  /** Subreddit name (without r/) */
  subreddit: string;
  /** Whether the post is marked NSFW */
  nsfw: boolean;
  /** Unix timestamp when the post was created */
  createdAt: number;
  /** Post score (upvotes - downvotes) */
  score: number;
  /** Gallery item index (0 for non-gallery posts) */
  galleryIndex: number;
}

export type SortType = "hot" | "new" | "top" | "rising";
export type TopPeriod = "hour" | "day" | "week" | "month" | "year" | "all";

export interface FetchSubredditOptions {
  /** Subreddit name (without r/) */
  subreddit: string;
  /** Sort type */
  sort?: SortType;
  /** Time period for 'top' sort */
  period?: TopPeriod;
  /** Maximum number of posts to fetch */
  limit?: number;
  /** Pagination cursor */
  after?: string;
}

export interface FetchSubredditResult {
  /** Parsed images from the posts */
  images: RedditImage[];
  /** Cursor for next page */
  after: string | null;
  /** Number of posts processed */
  postsProcessed: number;
}
