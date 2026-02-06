import { z } from "zod";

// Available source kinds
export const SOURCE_KINDS = [
  { value: "reddit", label: "Reddit" },
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number]["value"];

// Reddit subreddit pattern: /r/subreddit, /user/username, /u/username
const redditSubredditPattern = /^\/(r|user|u)\/[a-zA-Z0-9_-]+$/;

// Reddit sort options
export const REDDIT_SORT_OPTIONS = [
  { value: "new", label: "New" },
  { value: "hot", label: "Hot" },
  { value: "top", label: "Top" },
  { value: "rising", label: "Rising" },
] as const;

export type RedditSortType = (typeof REDDIT_SORT_OPTIONS)[number]["value"];

// Reddit top period options (only used when sort is "top")
export const REDDIT_TOP_PERIOD_OPTIONS = [
  { value: "hour", label: "Past Hour" },
  { value: "day", label: "Past 24 Hours" },
  { value: "week", label: "Past Week" },
  { value: "month", label: "Past Month" },
  { value: "year", label: "Past Year" },
  { value: "all", label: "All Time" },
] as const;

export type RedditTopPeriod = (typeof REDDIT_TOP_PERIOD_OPTIONS)[number]["value"];

// NSFW handling options
export const NSFW_OPTIONS = [
  { value: 0, label: "Auto (from post)" },
  { value: 1, label: "SFW Only" },
  { value: 2, label: "NSFW Only (mark all as NSFW)" },
] as const;

export type NsfwOption = (typeof NSFW_OPTIONS)[number]["value"];

// Common cron schedule presets
export const SCHEDULE_PRESETS = [
  { value: "", label: "No schedule" },
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */2 * * *", label: "Every 2 hours" },
  { value: "0 */4 * * *", label: "Every 4 hours" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 */12 * * *", label: "Every 12 hours" },
  { value: "0 0 * * *", label: "Daily (midnight)" },
  { value: "0 0 * * 0", label: "Weekly (Sunday midnight)" },
] as const;

// Full source schema for Reddit
export const redditSourceSchema = z.object({
  enabled: z.boolean().default(true),

  name: z
    .string()
    .min(1, { error: "Name is required" })
    .max(100, { error: "Name must be 100 characters or less" }),

  kind: z.literal("reddit"),

  subreddit: z
    .string()
    .min(1, { error: "Subreddit is required" })
    .regex(redditSubredditPattern, {
      error: "Must be in format /r/<subreddit>, /user/<username>, or /u/<username>",
    }),

  sort: z.enum(["new", "hot", "top", "rising"]).default("new"),

  // Only used when sort is "top"
  topPeriod: z.enum(["hour", "day", "week", "month", "year", "all"]).default("day"),

  lookupLimit: z
    .number()
    .int({ error: "Lookup limit must be a whole number" })
    .min(1, { error: "Lookup limit must be at least 1" })
    .max(1000, { error: "Lookup limit must be 1000 or less" })
    .default(300),

  // NSFW handling: 0 = auto (from post), 1 = SFW only, 2 = NSFW only (mark all as NSFW)
  nsfw: z.number().int().min(0).max(2).default(0),

  // Schedule cron expressions (multiple allowed)
  schedules: z
    .array(z.string().max(100, { error: "Schedule must be 100 characters or less" }))
    .default([]),

  // Device IDs to subscribe to this source
  deviceIds: z.array(z.string()).default([]),
});

export type RedditSourceFormData = z.infer<typeof redditSourceSchema>;

// Union of all source schemas (for future extensibility)
export const sourceSchema = redditSourceSchema;

export type SourceFormData = z.infer<typeof sourceSchema>;

// Helper to convert form data to database format
export function formDataToDbSource(data: SourceFormData) {
  if (data.kind === "reddit") {
    return {
      enabled: data.enabled,
      name: data.name,
      kind: data.kind,
      params: {
        subreddit: data.subreddit,
        sort: data.sort,
        period: data.sort === "top" ? data.topPeriod : undefined,
      },
      lookupLimit: data.lookupLimit,
      nsfw: data.nsfw,
      schedules: data.schedules.filter((s) => s.trim() !== ""),
      deviceIds: data.deviceIds,
    };
  }
  throw new Error(`Unknown source kind: ${data.kind}`);
}

// Helper to convert database format to form data
export function dbSourceToFormData(
  source: {
    enabled: boolean;
    name: string;
    kind: string;
    params: unknown;
    lookupLimit: number;
    nsfw: number;
  },
  schedules?: string[],
  deviceIds?: string[]
): SourceFormData {
  if (source.kind === "reddit") {
    const params = typeof source.params === "string" 
      ? JSON.parse(source.params) 
      : source.params as { subreddit: string; sort?: RedditSortType; period?: RedditTopPeriod };
    return {
      enabled: source.enabled,
      name: source.name,
      kind: "reddit",
      subreddit: params.subreddit || "",
      sort: params.sort || "new",
      topPeriod: params.period || "day",
      lookupLimit: source.lookupLimit,
      nsfw: source.nsfw ?? 0,
      schedules: schedules || [],
      deviceIds: deviceIds || [],
    };
  }
  throw new Error(`Unknown source kind: ${source.kind}`);
}
