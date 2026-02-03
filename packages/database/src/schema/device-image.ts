import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { devices } from "./device";
import { images } from "./image";

export const deviceImages = sqliteTable(
  "device_images",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),

    deviceId: text("device_id")
      .references(() => devices.id, { onDelete: "set null" }),

    imageId: text("image_id")
      .references(() => images.id, { onDelete: "set null" }),

    // Path file di folder device (berdasarkan slug)
    localPath: text("local_path").notNull(),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    unique("device_images_device_image_unique").on(table.deviceId, table.imageId),
    index("device_images_device_id_idx").on(table.deviceId),
    index("device_images_image_id_idx").on(table.imageId),
  ]
);

export const deviceImagesRelations = relations(deviceImages, ({ one }) => ({
  device: one(devices, {
    fields: [deviceImages.deviceId],
    references: [devices.id],
  }),
  image: one(images, {
    fields: [deviceImages.imageId],
    references: [images.id],
  }),
}));

export type DeviceImage = typeof deviceImages.$inferSelect;
export type NewDeviceImage = typeof deviceImages.$inferInsert;
