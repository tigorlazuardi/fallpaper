import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { subscriptions } from "./subscription";
import { deviceImages } from "./device-image";

export const devices = sqliteTable("devices", {
  // UUID v7
  id: text("id").primaryKey().$defaultFn(() => uuidv7()),
  
  // Enable/disable device
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  
  // Human readable name
  name: text("name").notNull(),
  
  // URL friendly slug
  slug: text("slug").notNull().unique(),
  
  // Device dimensions
  height: integer("height").notNull(),
  width: integer("width").notNull(),
  
  // Aspect ratio tolerance (e.g., 0.2 means accept ratio +/- 0.2)
  aspectRatioDeviation: real("aspect_ratio_deviation").notNull().default(0.2),
  
  // Resolution constraints (optional)
  minHeight: integer("min_height"),
  maxHeight: integer("max_height"),
  minWidth: integer("min_width"),
  maxWidth: integer("max_width"),
  
  // Filesize constraints in bytes (optional)
  minFilesize: integer("min_filesize"),
  maxFilesize: integer("max_filesize"),
  
  // NSFW filter: 0 = accept all, 1 = reject nsfw, 2 = nsfw only
  nsfw: integer("nsfw").notNull().default(1),
  
  // Timestamps (stored as unix timestamp)
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const devicesRelations = relations(devices, ({ many }) => ({
  subscriptions: many(subscriptions),
  deviceImages: many(deviceImages),
}));

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
