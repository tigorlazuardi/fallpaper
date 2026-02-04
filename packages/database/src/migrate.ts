import { createDatabase } from "./index";

const dbPath = process.env.DATABASE_URL || "sqlite.db";
createDatabase({
  path: dbPath,
  migrationsFolder: "./drizzle",
});

console.log("Migrations complete.");
