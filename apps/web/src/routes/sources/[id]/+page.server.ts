import { db } from "$lib/server/db";
import { sources, schedules, subscriptions, devices, withQueryName } from "@packages/database";
import { redditSourceSchema, formDataToDbSource, dbSourceToFormData } from "$lib/schemas/source";
import { superValidate, fail, message } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { eq } from "drizzle-orm";
import { error, redirect, isRedirect } from "@sveltejs/kit";
import { getScheduler } from "$lib/server/scheduler";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const source = await withQueryName("Sources.GetById", async () =>
    await db.query.sources.findFirst({
      where: eq(sources.id, params.id),
    })
  );

  if (!source) {
    throw error(404, "Source not found");
  }

  // Load schedules for this source
  const sourceSchedules = await withQueryName("Sources.GetSchedules", async () =>
    await db.query.schedules.findMany({
      where: eq(schedules.sourceId, params.id),
    })
  );
  const scheduleCrons = sourceSchedules.map((s) => s.cron);

  // Load subscriptions (device IDs) for this source
  const sourceSubscriptions = await withQueryName("Sources.GetSubscriptions", async () =>
    await db.query.subscriptions.findMany({
      where: eq(subscriptions.sourceId, params.id),
    })
  );
  const deviceIds = sourceSubscriptions.map((s) => s.deviceId);

  // Load all devices for the form
  const allDevices = await withQueryName("Sources.ListDevicesForForm", async () =>
    await db.query.devices.findMany({
      orderBy: (devices, { asc }) => [asc(devices.name)],
    })
  );

  // Convert DB format to form data
  const formData = dbSourceToFormData(source, scheduleCrons, deviceIds);
  const form = await superValidate(formData, zod4(redditSourceSchema));

  return { source, form, devices: allDevices };
};

export const actions: Actions = {
  default: async ({ request, params }) => {
    // Clone request to read body twice if needed
    const clonedRequest = request.clone();
    
    // Try to get submitAction from form data or JSON
    let submitAction: string | undefined;
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const json = await request.json();
      submitAction = json.submitAction;
    } else {
      const formData = await request.formData();
      submitAction = formData.get('submitAction')?.toString();
    }

    // superValidate with cloned request handles both JSON and FormData
    const form = await superValidate(clonedRequest, zod4(redditSourceSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      const dbData = formDataToDbSource(form.data);

      // Update source
      await withQueryName("Sources.Update", async () =>
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
          .where(eq(sources.id, params.id))
      );

      // Update schedules: delete old, insert new
      await withQueryName("Sources.DeleteSchedules", async () =>
        await db.delete(schedules).where(eq(schedules.sourceId, params.id))
      );
      if (dbData.schedules.length > 0) {
        await withQueryName("Sources.InsertSchedules", async () =>
          await db.insert(schedules).values(
            dbData.schedules.map((cron) => ({
              sourceId: params.id,
              cron,
            }))
          )
        );
      }

      // Notify scheduler of schedule changes
      await getScheduler().reloadSchedules();

      // Update subscriptions: delete old, insert new
      await withQueryName("Sources.DeleteSubscriptions", async () =>
        await db.delete(subscriptions).where(eq(subscriptions.sourceId, params.id))
      );
      if (dbData.deviceIds.length > 0) {
        await withQueryName("Sources.InsertSubscriptions", async () =>
          await db.insert(subscriptions).values(
            dbData.deviceIds.map((deviceId) => ({
              deviceId,
              sourceId: params.id,
            }))
          )
        );
      }

      // If submitAction is "create_and_fetch", redirect with fetch param
      if (submitAction === "create_and_fetch") {
        redirect(303, `/sources?fetch=${params.id}`);
      }

      redirect(303, "/sources");
    } catch (err: any) {
      if (isRedirect(err)) throw err;
      if (err.message?.includes("UNIQUE constraint failed")) {
        return message(form, "A source with this name already exists", { status: 400 });
      }
      console.error("Failed to update source:", err);
      return message(form, "Failed to update source", { status: 500 });
    }
  },
};
