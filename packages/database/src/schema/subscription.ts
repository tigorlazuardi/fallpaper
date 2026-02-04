import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { devices } from "./device";
import { sources } from "./source";

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),

    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),

    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.deviceId, table.sourceId] }),
    index("subscriptions_source_id_idx").on(table.sourceId),
  ]
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  device: one(devices, {
    fields: [subscriptions.deviceId],
    references: [devices.id],
  }),
  source: one(sources, {
    fields: [subscriptions.sourceId],
    references: [sources.id],
  }),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
