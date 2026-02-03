import { z } from "zod";

// Slug validation: lowercase letters, numbers, and hyphens only
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const deviceSchema = z.object({
  enabled: z.boolean().default(true),

  name: z
    .string()
    .min(1, { error: "Name is required" })
    .max(100, { error: "Name must be 100 characters or less" }),

  slug: z
    .string()
    .min(1, { error: "Slug is required" })
    .max(100, { error: "Slug must be 100 characters or less" })
    .regex(slugRegex, { error: "Slug must be lowercase letters, numbers, and hyphens only" }),

  width: z
    .number({ error: "Width is required" })
    .int({ error: "Width must be a whole number" })
    .positive({ error: "Width must be greater than 0" }),

  height: z
    .number({ error: "Height is required" })
    .int({ error: "Height must be a whole number" })
    .positive({ error: "Height must be greater than 0" }),

  aspectRatioDelta: z
    .number()
    .min(0, { error: "Aspect ratio delta must be 0 or greater" })
    .max(2, { error: "Aspect ratio delta must be 2 or less" })
    .default(0.2),

  minWidth: z
    .number()
    .int({ error: "Min width must be a whole number" })
    .min(1, { error: "Min width must be at least 1" })
    .nullish(),

  maxWidth: z
    .number()
    .int({ error: "Max width must be a whole number" })
    .min(1, { error: "Max width must be at least 1" })
    .nullish(),

  minHeight: z
    .number()
    .int({ error: "Min height must be a whole number" })
    .min(1, { error: "Min height must be at least 1" })
    .nullish(),

  maxHeight: z
    .number()
    .int({ error: "Max height must be a whole number" })
    .min(1, { error: "Max height must be at least 1" })
    .nullish(),

  minFilesize: z
    .number()
    .int({ error: "Min filesize must be a whole number" })
    .min(0, { error: "Min filesize must be 0 or greater" })
    .nullish(),

  maxFilesize: z
    .number()
    .int({ error: "Max filesize must be a whole number" })
    .min(0, { error: "Max filesize must be 0 or greater" })
    .nullish(),

  nsfw: z
    .number()
    .int()
    .min(0)
    .max(2)
    .default(1),
}).refine(
  (data) => {
    if (data.minWidth && data.maxWidth) {
      return data.minWidth <= data.maxWidth;
    }
    return true;
  },
  { error: "Min width must be less than or equal to max width", path: ["minWidth"] }
).refine(
  (data) => {
    if (data.minHeight && data.maxHeight) {
      return data.minHeight <= data.maxHeight;
    }
    return true;
  },
  { error: "Min height must be less than or equal to max height", path: ["minHeight"] }
).refine(
  (data) => {
    if (data.minFilesize && data.maxFilesize) {
      return data.minFilesize <= data.maxFilesize;
    }
    return true;
  },
  { error: "Min filesize must be less than or equal to max filesize", path: ["minFilesize"] }
);

export type DeviceFormData = z.infer<typeof deviceSchema>;
