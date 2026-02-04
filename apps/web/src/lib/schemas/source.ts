import { z } from "zod";

// Available source kinds
export const SOURCE_KINDS = [
  { value: "reddit", label: "Reddit" },
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number]["value"];

// Reddit subreddit pattern: /r/subreddit, /user/username, /u/username
const redditSubredditPattern = /^\/(r|user|u)\/[a-zA-Z0-9_-]+$/;

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

  lookupLimit: z
    .number()
    .int({ error: "Lookup limit must be a whole number" })
    .min(1, { error: "Lookup limit must be at least 1" })
    .max(1000, { error: "Lookup limit must be 1000 or less" })
    .default(300),

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
      params: JSON.stringify({ subreddit: data.subreddit }),
      lookupLimit: data.lookupLimit,
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
  },
  schedules?: string[],
  deviceIds?: string[]
): SourceFormData {
  if (source.kind === "reddit") {
    const params = typeof source.params === "string" 
      ? JSON.parse(source.params) 
      : source.params as { subreddit: string };
    return {
      enabled: source.enabled,
      name: source.name,
      kind: "reddit",
      subreddit: params.subreddit || "",
      lookupLimit: source.lookupLimit,
      schedules: schedules || [],
      deviceIds: deviceIds || [],
    };
  }
  throw new Error(`Unknown source kind: ${source.kind}`);
}
