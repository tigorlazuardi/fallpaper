import { db } from "$lib/server/db";
import { devices } from "@packages/database";
import { deviceSchema } from "$lib/schemas/device";
import { superValidate, fail, message } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { eq } from "drizzle-orm";
import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad, Actions, RequestEvent } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const device = await db.query.devices.findFirst({
    where: eq(devices.id, params.id),
  });

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
      await db
        .update(devices)
        .set({
          enabled: form.data.enabled,
          name: form.data.name,
          slug: form.data.slug,
          width: form.data.width,
          height: form.data.height,
          aspectRatioDelta: form.data.aspectRatioDelta,
          nsfw: form.data.nsfw,
          minWidth: form.data.minWidth ?? null,
          maxWidth: form.data.maxWidth ?? null,
          minHeight: form.data.minHeight ?? null,
          maxHeight: form.data.maxHeight ?? null,
          minFilesize: form.data.minFilesize ?? null,
          maxFilesize: form.data.maxFilesize ?? null,
          updatedAt: new Date(),
        })
        .where(eq(devices.id, params.id));

      redirect(303, "/devices");
    } catch (err: any) {
      if (err.message?.includes("UNIQUE constraint failed")) {
        return message(form, "A device with this slug already exists", { status: 400 });
      }
      console.error("Failed to update device:", err);
      return message(form, "Failed to update device", { status: 500 });
    }
  },
};

// Handle DELETE requests
export async function DELETE({ params }: RequestEvent) {
  try {
    await db.delete(devices).where(eq(devices.id, params.id));
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Failed to delete device:", err);
    return new Response(JSON.stringify({ error: "Failed to delete device" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
