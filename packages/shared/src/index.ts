// Shared utilities and types for fallpaper

export interface Device {
  id: string;
  enabled: boolean;
  name: string;
  slug: string;
  height: number;
  width: number;
  aspectRatioDelta: number;
  minHeight?: number;
  maxHeight?: number;
  minWidth?: number;
  maxWidth?: number;
  minFilesize?: number;
  maxFilesize?: number;
  nsfw: 0 | 1 | 2; // 0: accept all, 1: reject nsfw, 2: nsfw only
  createdAt: Date;
  updatedAt: Date;
}

export function calculateAspectRatio(width: number, height: number): number {
  return height / width;
}

export function isWithinAspectRatioRange(
  targetRatio: number,
  imageRatio: number,
  delta: number
): boolean {
  return imageRatio >= targetRatio - delta && imageRatio <= targetRatio + delta;
}
