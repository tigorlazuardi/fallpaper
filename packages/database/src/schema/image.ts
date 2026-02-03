import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { sources } from "./source";
import { deviceImages } from "./device-image";

export const images = sqliteTable(
  "images",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),

    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),

    // URLs
    websiteUrl: text("website_url").notNull(),
    downloadUrl: text("download_url").notNull().unique(),
    
    // Dedupe
    checksum: text("checksum"),

    // Image metadata
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    aspectRatio: real("aspect_ratio").notNull(),
    filesize: integer("filesize").notNull(),
    format: text("format").notNull(),

    // Content info
    title: text("title"),
    nsfw: integer("nsfw").notNull().default(0), // 0: sfw, 1: nsfw, 2: unknown
    author: text("author"),
    authorUrl: text("author_url"),

    // Storage
    thumbnailPath: text("thumbnail_path"),

    // Timestamps
    sourceCreatedAt: integer("source_created_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("images_source_id_idx").on(table.sourceId),
    index("images_checksum_idx").on(table.checksum),
    index("images_aspect_ratio_idx").on(table.aspectRatio),
    index("images_nsfw_idx").on(table.nsfw),
  ]
);

export const imagesRelations = relations(images, ({ one, many }) => ({
  source: one(sources, {
    fields: [images.sourceId],
    references: [sources.id],
  }),
  deviceImages: many(deviceImages),
}));

export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
