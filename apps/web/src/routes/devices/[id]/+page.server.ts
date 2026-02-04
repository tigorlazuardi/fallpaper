import { db } from "$lib/server/db";
import { devices, withQueryName } from "@packages/database";
import { deviceSchema } from "$lib/schemas/device";
import { superValidate, fail, message } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { eq } from "drizzle-orm";
import { error, redirect, isRedirect } from "@sveltejs/kit";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const device = await withQueryName("Devices.GetById", async () =>
    await db.query.devices.findFirst({
      where: eq(devices.id, params.id),
    })
  );

  if (!device) {
    throw error(404, "Device not found");
  }

  const form = await superValidate(device, zod4(deviceSchema));

  return { device, form };
};

export const actions: Actions = {
  default: async ({ request, params }) => {
    const form = await superValidate(request, zod4(deviceSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      await withQueryName("Devices.Update", async () =>
        await db
          .update(devices)
          .set({
            enabled: form.data.enabled,
            name: form.data.name,
            slug: form.data.slug,
            width: form.data.width,
            height: form.data.height,
            aspectRatioDeviation: form.data.aspectRatioDeviation,
            nsfw: form.data.nsfw,
            minWidth: form.data.minWidth ?? null,
            maxWidth: form.data.maxWidth ?? null,
            minHeight: form.data.minHeight ?? null,
            maxHeight: form.data.maxHeight ?? null,
            minFilesize: form.data.minFilesize ?? null,
            maxFilesize: form.data.maxFilesize ?? null,
            updatedAt: new Date(),
          })
          .where(eq(devices.id, params.id))
      );

      redirect(303, "/devices");
    } catch (err: any) {
      if (isRedirect(err)) throw err;
      if (err.message?.includes("UNIQUE constraint failed")) {
        return message(form, "A device with this slug already exists", { status: 400 });
      }
      console.error("Failed to update device:", err);
      return message(form, "Failed to update device", { status: 500 });
    }
  },
};


