import { createDatabase } from "@packages/database";
import { env } from "$env/dynamic/private";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

// Database path from environment or default to project root/data
const dataDir = env.DATABASE_PATH
  ? dirname(env.DATABASE_PATH)
  : join(process.cwd(), "data");
const dbPath = env.DATABASE_PATH || join(dataDir, "fallpaper.db");

// Ensure data directory exists
mkdirSync(dataDir, { recursive: true });

// Migrations folder - resolve through the symlinked node_modules
const migrationsFolder = join(
  process.cwd(),
  "node_modules",
  "@packages",
  "database",
  "drizzle"
);

// Logging and tracing enabled by default
// Set DB_LOGGING=false or OTEL_ENABLED=false to disable
const enableLogging = env.DB_LOGGING !== "false";
const enableTracing = env.OTEL_ENABLED !== "false";

export const db = createDatabase({
  path: dbPath,
  migrationsFolder,
  logging: enableLogging,
  tracing: enableTracing,
});
