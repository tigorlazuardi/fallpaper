import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

export * from "./schema";

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

export function createDatabase(path: string = "sqlite.db", migrationsFolder?: string) {
  const sqlite = new Database(path);
  setPragmas(sqlite);
  const db = drizzle(sqlite, { schema });
  
  if (migrationsFolder) {
    migrate(db, { migrationsFolder });
  }
  
  return db;
}

export type DatabaseClient = ReturnType<typeof createDatabase>;
