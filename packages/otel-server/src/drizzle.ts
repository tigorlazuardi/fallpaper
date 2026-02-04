import { AsyncLocalStorage } from "node:async_hooks";
import { instrumentDrizzleClient, type InstrumentDrizzleConfig } from "@kubiks/otel-drizzle";
import { getLogger, type Logger as PinoLogger } from "./logger";

export type { InstrumentDrizzleConfig };

/**
 * Instrument a Drizzle ORM database instance for OpenTelemetry tracing.
 * 
 * This wraps the `@kubiks/otel-drizzle` instrumentation to provide
 * automatic span creation for all database queries.
 * 
 * @example
 * ```ts
 * import { drizzle } from "drizzle-orm/bun-sqlite";
 * import { Database } from "bun:sqlite";
 * import { instrumentDrizzle } from "@packages/otel-server/drizzle";
 * 
 * const sqlite = new Database("app.db");
 * const db = drizzle({ client: sqlite });
 * 
 * // Add instrumentation
 * instrumentDrizzle(db, { dbSystem: "sqlite" });
 * 
 * // All queries are now traced
 * const users = await db.select().from(usersTable);
 * ```
 * 
 * @example PostgreSQL
 * ```ts
 * import { drizzle } from "drizzle-orm/postgres-js";
 * import { instrumentDrizzle } from "@packages/otel-server/drizzle";
 * 
 * const db = drizzle(process.env.DATABASE_URL!);
 * instrumentDrizzle(db, { 
 *   dbSystem: "postgresql",
 *   dbName: "myapp",
 *   peerName: "db.example.com",
 *   peerPort: 5432,
 * });
 * ```
 */
export function instrumentDrizzle<T extends object>(
  db: T,
  config?: InstrumentDrizzleConfig
): T {
  return instrumentDrizzleClient(db as any, config);
}

// Re-export the original function for those who prefer the original name
export { instrumentDrizzleClient };

// ============================================================================
// Drizzle Logger with AsyncLocalStorage for query naming
// ============================================================================

interface QueryContext {
  queryName?: string;
}

const queryContextStorage = new AsyncLocalStorage<QueryContext>();

/**
 * Get the current query name from AsyncLocalStorage context.
 */
export function getQueryName(): string | undefined {
  return queryContextStorage.getStore()?.queryName;
}

/**
 * Run a function with a named query context.
 * The query name will be included in Drizzle logs within this context.
 * 
 * @example
 * ```ts
 * import { withQueryName } from "@packages/otel-server/drizzle";
 * 
 * // Named query - logs as "[Drizzle] GetUserById:\n<query>"
 * const user = await withQueryName("GetUserById", () => 
 *   db.select().from(users).where(eq(users.id, userId))
 * );
 * 
 * // Async operations are supported
 * const results = await withQueryName("FetchAllProducts", async () => {
 *   const products = await db.select().from(products);
 *   const categories = await db.select().from(categories);
 *   return { products, categories };
 * });
 * ```
 */
export function withQueryName<T>(queryName: string, fn: () => T): T {
  return queryContextStorage.run({ queryName }, fn);
}

/**
 * Drizzle Logger interface (matches drizzle-orm's Logger interface)
 */
export interface DrizzleLogger {
  logQuery(query: string, params: unknown[]): void;
}

export interface DrizzleLoggerConfig {
  /** Custom pino logger instance. Uses default logger if not provided. */
  logger?: PinoLogger;
}

/**
 * Create a Drizzle logger that logs queries using pino.
 * 
 * Uses AsyncLocalStorage to detect query names set via `withQueryName()`.
 * 
 * Log format:
 * - With query name: `[Drizzle] <queryName>:\n<query>`
 * - Without query name: `[Drizzle] Query:\n<query>`
 * - Params are included as a log attribute
 * 
 * @example
 * ```ts
 * import { drizzle } from "drizzle-orm/bun-sqlite";
 * import { createDrizzleLogger, withQueryName } from "@packages/otel-server/drizzle";
 * 
 * const db = drizzle({
 *   client: sqlite,
 *   logger: createDrizzleLogger(),
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
export function createDrizzleLogger(config: DrizzleLoggerConfig = {}): DrizzleLogger {
  const logger = config.logger ?? getLogger();

  return {
    logQuery(query: string, params: unknown[]): void {
      const queryName = getQueryName();
      const label = queryName ?? "Query";
      // Prefix with '-- ' so the log can be copy-pasted as valid SQL (first line becomes comment)
      const message = `-- [Drizzle] ${label}:\n${query}`;

      // Only include params if not empty
      if (params.length > 0) {
        logger.info({ params }, message);
      } else {
        logger.info(message);
      }
    },
  };
}
