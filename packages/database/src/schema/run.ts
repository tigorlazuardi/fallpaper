import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { sources } from "./source";
import { schedules } from "./schedule";

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),

    // Optional FK to source and schedule
    sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
    scheduleId: text("schedule_id").references(() => schedules.id, { onDelete: "set null" }),

    // Run type e.g. 'fetch_source', 'download_image'
    name: text("name").notNull(),

    // State: pending, running, completed, failed
    state: text("state").notNull().default("pending"),

    // Input params (json)
    input: text("input", { mode: "json" }).notNull().default({}),

    // Final result (json)
    output: text("output", { mode: "json" }),

    // Error message if failed
    error: text("error"),

    // Progress tracking
    progressCurrent: integer("progress_current").default(0),
    progressTotal: integer("progress_total").default(0),
    progressMessage: text("progress_message"),

    // Retry handling
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),

    // Scheduling
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("runs_state_scheduled_idx").on(table.state, table.scheduledAt),
    index("runs_name_idx").on(table.name),
    index("runs_source_id_idx").on(table.sourceId),
    index("runs_schedule_id_idx").on(table.scheduleId),
  ]
);

export const runsRelations = relations(runs, ({ one }) => ({
  source: one(sources, {
    fields: [runs.sourceId],
    references: [sources.id],
  }),
  schedule: one(schedules, {
    fields: [runs.scheduleId],
    references: [schedules.id],
  }),
}));

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
