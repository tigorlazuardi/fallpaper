import { createDatabase } from "@packages/database";
import { dirname, join } from "path";
import { mkdirSync } from "fs";
import { loadConfig } from "./config/loader";

// Load config (uses process.env and config file)
const config = loadConfig();
const dbConfig = config.database;

// Ensure data directory exists
const dataDir = dirname(dbConfig.path);
mkdirSync(dataDir, { recursive: true });

// Migrations folder - resolve through the symlinked node_modules
const migrationsFolder = join(
  process.cwd(),
  "node_modules",
  "@packages",
  "database",
  "drizzle"
);

export const db = createDatabase({
  path: dbConfig.path,
  migrationsFolder,
  logging: dbConfig.logging,
  tracing: dbConfig.tracing,
});
