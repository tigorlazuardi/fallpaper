/**
 * Image data for the modal display
 */
export interface ImageModalData {
  /** Image ID */
  id: string;
  /** Display image URL (possibly resized) */
  src: string;
  /** Full quality image URL (opened in new tab on click) */
  fullSrc?: string;
  /** Image title */
  title?: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Aspect ratio (width/height) */
  aspectRatio?: number;
  /** File size in bytes */
  filesize?: number;
  /** Image format (jpg, png, webp, etc.) */
  format?: string;
  /** Whether the image is NSFW (0: sfw, 1: nsfw) */
  nsfw?: number;
  /** Author/uploader name */
  author?: string;
  /** Author profile URL */
  authorUrl?: string;
  /** Source name (e.g., subreddit name) */
  sourceName?: string;
  /** URL to the original source page */
  websiteUrl?: string;
  /** When the image was created at the source */
  sourceCreatedAt?: Date | string | number;
  /** When the image was added to the system */
  createdAt?: Date | string | number;
}
