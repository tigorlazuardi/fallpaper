import { createDatabase } from "./index";

const dbPath = process.env.DATABASE_URL || "sqlite.db";
createDatabase(dbPath, "./drizzle");

console.log("Migrations complete.");
