import { createDatabase } from "@packages/database";
import { env } from "$env/dynamic/private";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

// Get the directory of this file to resolve relative paths
const __dirname = dirname(fileURLToPath(import.meta.url));

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

export const db = createDatabase(dbPath, migrationsFolder);
