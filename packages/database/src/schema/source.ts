import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { subscriptions } from "./subscription";
import { schedules } from "./schedule";
import { images } from "./image";

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),

    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

    // Unique name, case insensitive index for sorting
    name: text("name").notNull().unique(),

    // Source type e.g. 'reddit.v1'
    kind: text("kind").notNull(),

    // JSON params for source configuration
    params: text("params", { mode: "json" }).notNull().default({}),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("sources_name_ci_idx").on(sql`${table.name} COLLATE NOCASE`),
    index("sources_kind_idx").on(table.kind),
  ]
);

export const sourcesRelations = relations(sources, ({ many }) => ({
  subscriptions: many(subscriptions),
  schedules: many(schedules),
  images: many(images),
}));

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
