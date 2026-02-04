import { db } from "$lib/server/db";
import { sources, schedules, subscriptions, devices } from "@packages/database";
import { redditSourceSchema, formDataToDbSource, dbSourceToFormData } from "$lib/schemas/source";
import { superValidate, fail, message } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { eq } from "drizzle-orm";
import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad, Actions, RequestEvent } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, params.id),
  });

  if (!source) {
    throw error(404, "Source not found");
  }

  // Load schedules for this source
  const sourceSchedules = await db.query.schedules.findMany({
    where: eq(schedules.sourceId, params.id),
  });
  const scheduleCrons = sourceSchedules.map((s) => s.cron);

  // Load subscriptions (device IDs) for this source
  const sourceSubscriptions = await db.query.subscriptions.findMany({
    where: eq(subscriptions.sourceId, params.id),
  });
  const deviceIds = sourceSubscriptions.map((s) => s.deviceId);

  // Load all devices for the form
  const allDevices = await db.query.devices.findMany({
    orderBy: (devices, { asc }) => [asc(devices.name)],
  });

  // Convert DB format to form data
  const formData = dbSourceToFormData(source, scheduleCrons, deviceIds);
  const form = await superValidate(formData, zod4(redditSourceSchema));

  return { source, form, devices: allDevices };
};

export const actions: Actions = {
  default: async ({ request, params }) => {
    const formData = await request.formData();
    const action = formData.get("action");

    const form = await superValidate(formData, zod4(redditSourceSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      const dbData = formDataToDbSource(form.data);

      // Update source
      await db
        .update(sources)
        .set({
          enabled: dbData.enabled,
          name: dbData.name,
          kind: dbData.kind,
          params: dbData.params,
          lookupLimit: dbData.lookupLimit,
          updatedAt: new Date(),
        })
        .where(eq(sources.id, params.id));

      // Update schedules: delete old, insert new
      await db.delete(schedules).where(eq(schedules.sourceId, params.id));
      if (dbData.schedules.length > 0) {
        await db.insert(schedules).values(
          dbData.schedules.map((cron) => ({
            sourceId: params.id,
            cron,
          }))
        );
      }

      // Update subscriptions: delete old, insert new
      await db.delete(subscriptions).where(eq(subscriptions.sourceId, params.id));
      if (dbData.deviceIds.length > 0) {
        await db.insert(subscriptions).values(
          dbData.deviceIds.map((deviceId) => ({
            deviceId,
            sourceId: params.id,
          }))
        );
      }

      // If action is "create_and_fetch", redirect with fetch param
      if (action === "create_and_fetch") {
        redirect(303, `/sources?fetch=${params.id}`);
      }

      redirect(303, "/sources");
    } catch (err: any) {
      if (err.message?.includes("UNIQUE constraint failed")) {
        return message(form, "A source with this name already exists", { status: 400 });
      }
      console.error("Failed to update source:", err);
      return message(form, "Failed to update source", { status: 500 });
    }
  },
};

// Handle DELETE requests
export async function DELETE({ params }: RequestEvent) {
  try {
    await db.delete(sources).where(eq(sources.id, params.id));
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Failed to delete source:", err);
    return new Response(JSON.stringify({ error: "Failed to delete source" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
