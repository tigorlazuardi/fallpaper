import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { sources } from "./source";
import { runs } from "./run";

export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),

    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),

    cron: text("cron").notNull(),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("schedules_source_id_idx").on(table.sourceId),
  ]
);

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  source: one(sources, {
    fields: [schedules.sourceId],
    references: [sources.id],
  }),
  runs: many(runs),
}));

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
