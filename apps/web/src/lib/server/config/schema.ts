import { join } from "path";
import { homedir } from "os";
import { z } from "zod";

// Helper to coerce boolean from string ("true"/"false") or boolean
const coerceBoolean = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    return val.toLowerCase() !== "false" && val !== "0";
  }
  return Boolean(val);
}, z.boolean());

// Default paths (computed at runtime)
const DEFAULT_DATABASE_PATH = join(process.cwd(), "data", "fallpaper.db");
const DEFAULT_IMAGE_DIR = join(process.cwd(), "data", "images");
const DEFAULT_TEMP_DIR = join(process.cwd(), "data", "temp");

/**
 * Database configuration schema
 */
export const databaseConfigSchema = z.object({
  path: z.string().min(1, "Database path is required").default(DEFAULT_DATABASE_PATH),
  logging: coerceBoolean.default(true),
  tracing: coerceBoolean.default(true),
});

/**
 * Scheduler configuration schema
 */
export const schedulerConfigSchema = z.object({
  pollCron: z.string().min(1, "Poll cron expression is required").default("* * * * *"),
  staleRunTimeoutMs: z.coerce.number().int().positive().default(30 * 60 * 1000), // 30 min
  maxPendingRunsPerPoll: z.coerce.number().int().positive().max(100).default(10),
  retryBackoffBaseMs: z.coerce.number().int().positive().default(60 * 1000), // 1 min
});

/**
 * Runner configuration schema
 */
export const runnerConfigSchema = z.object({
  imageDir: z.string().min(1, "Image directory is required").default(DEFAULT_IMAGE_DIR),
  tempDir: z.string().min(1, "Temp directory is required").default(DEFAULT_TEMP_DIR),
  maxConcurrentDownloads: z.coerce.number().int().positive().max(50).default(5),
  minSpeedBytesPerSec: z.coerce.number().int().positive().default(10 * 1024), // 10 KB/s
  slowSpeedTimeoutMs: z.coerce.number().int().positive().default(30 * 1000), // 30 sec
});

/**
 * Full application configuration schema (for validation)
 */
export const appConfigSchema = z.object({
  database: databaseConfigSchema,
  scheduler: schedulerConfigSchema,
  runner: runnerConfigSchema,
});

/**
 * Partial schema for loading (allows missing sections, applies defaults)
 */
export const partialAppConfigSchema = z.object({
  database: databaseConfigSchema.optional(),
  scheduler: schedulerConfigSchema.optional(),
  runner: runnerConfigSchema.optional(),
}).transform((val) => ({
  database: val.database ?? databaseConfigSchema.parse({}),
  scheduler: val.scheduler ?? schedulerConfigSchema.parse({}),
  runner: val.runner ?? runnerConfigSchema.parse({}),
}));

// Derive types from Zod schemas
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
export type SchedulerConfig = z.infer<typeof schedulerConfigSchema>;
export type RunnerConfig = z.infer<typeof runnerConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

/**
 * Default configuration values (derived from schema defaults)
 */
export const defaultConfig: AppConfig = {
  database: databaseConfigSchema.parse({}),
  scheduler: schedulerConfigSchema.parse({}),
  runner: runnerConfigSchema.parse({}),
};

/**
 * Get default config file path (XDG config dir)
 */
export function getDefaultConfigPath(env: Record<string, string | undefined> = process.env): string {
  const xdgConfigHome = env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfigHome, "fallpaper", "config");
}

/**
 * Environment variable mappings
 * Maps env var names to config paths
 */
export const envMappings: Record<string, { path: string[]; type: "string" | "number" | "boolean" }> = {
  // Database
  FALLPAPER_DATABASE_PATH: { path: ["database", "path"], type: "string" },
  FALLPAPER_DATABASE_LOGGING: { path: ["database", "logging"], type: "boolean" },
  FALLPAPER_DATABASE_TRACING: { path: ["database", "tracing"], type: "boolean" },

  // Scheduler
  FALLPAPER_SCHEDULER_POLL_CRON: { path: ["scheduler", "pollCron"], type: "string" },
  FALLPAPER_SCHEDULER_STALE_RUN_TIMEOUT_MS: { path: ["scheduler", "staleRunTimeoutMs"], type: "number" },
  FALLPAPER_SCHEDULER_MAX_PENDING_RUNS: { path: ["scheduler", "maxPendingRunsPerPoll"], type: "number" },
  FALLPAPER_SCHEDULER_RETRY_BACKOFF_BASE_MS: { path: ["scheduler", "retryBackoffBaseMs"], type: "number" },

  // Runner
  FALLPAPER_RUNNER_IMAGE_DIR: { path: ["runner", "imageDir"], type: "string" },
  FALLPAPER_RUNNER_TEMP_DIR: { path: ["runner", "tempDir"], type: "string" },
  FALLPAPER_RUNNER_MAX_CONCURRENT_DOWNLOADS: { path: ["runner", "maxConcurrentDownloads"], type: "number" },
  FALLPAPER_RUNNER_MIN_SPEED_BYTES_PER_SEC: { path: ["runner", "minSpeedBytesPerSec"], type: "number" },
  FALLPAPER_RUNNER_SLOW_SPEED_TIMEOUT_MS: { path: ["runner", "slowSpeedTimeoutMs"], type: "number" },
};
