import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import {
  createDrizzleLogger,
  instrumentDrizzle,
  type DrizzleLogger,
} from "@packages/otel-server/drizzle";

export * from "./schema";

// Re-export withQueryName for convenience
export { withQueryName } from "@packages/otel-server/drizzle";

function setPragmas(sqlite: Database) {
  // Persistent pragma (must be set outside transaction, before migrate)
  sqlite.exec("PRAGMA journal_mode = WAL;");

  // Performance and reliability pragmas (set on every connection)
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  sqlite.exec("PRAGMA synchronous = NORMAL;");
  sqlite.exec("PRAGMA cache_size = -64000;"); // 64MB
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA temp_store = MEMORY;");
  sqlite.exec("PRAGMA mmap_size = 268435456;"); // 256MB
}

export interface CreateDatabaseOptions {
  /** Path to the SQLite database file. Defaults to "sqlite.db" */
  path?: string;
  /** Path to migrations folder. If provided, migrations will be run on startup. */
  migrationsFolder?: string;
  /** Enable query logging. Defaults to false. */
  logging?: boolean;
  /** Custom Drizzle logger. If not provided, uses the default pino-based logger. */
  logger?: DrizzleLogger;
  /** Enable OpenTelemetry instrumentation for tracing. Defaults to false. */
  tracing?: boolean;
}

/**
 * Create a database connection with optional logging and tracing.
 * 
 * @example
 * ```ts
 * import { createDatabase, withQueryName } from "@packages/database";
 * 
 * const db = createDatabase({
 *   path: "app.db",
 *   migrationsFolder: "./drizzle",
 *   logging: true,
 *   tracing: true,
 * });
 * 
 * // Query without name - logs as "[Drizzle] Query:\n..."
 * await db.select().from(users);
 * 
 * // Query with name - logs as "[Drizzle] GetActiveUsers:\n..."
 * await withQueryName("GetActiveUsers", () =>
 *   db.select().from(users).where(eq(users.active, true))
 * );
 * ```
 */
export function createDatabase(options: CreateDatabaseOptions = {}) {
  const {
    path = "sqlite.db",
    migrationsFolder,
    logging = false,
    logger,
    tracing = false,
  } = options;

  const sqlite = new Database(path);
  setPragmas(sqlite);

  // Determine logger to use
  const drizzleLogger = logging ? (logger ?? createDrizzleLogger()) : undefined;

  const db = drizzle(sqlite, {
    schema,
    logger: drizzleLogger,
  });

  // Apply OpenTelemetry instrumentation if enabled
  if (tracing) {
    instrumentDrizzle(db, { dbSystem: "sqlite" });
  }

  if (migrationsFolder) {
    migrate(db, { migrationsFolder });
  }

  return db;
}

export type DatabaseClient = ReturnType<typeof createDatabase>;
