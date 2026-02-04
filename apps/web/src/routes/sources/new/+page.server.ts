import { db } from "$lib/server/db";
import { sources, schedules, subscriptions, devices } from "@packages/database";
import { redditSourceSchema, formDataToDbSource } from "$lib/schemas/source";
import { superValidate, fail, message } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const kind = url.searchParams.get("kind");

  // Always load devices for the form
  const allDevices = await db.query.devices.findMany({
    orderBy: (devices, { asc }) => [asc(devices.name)],
  });

  // If no kind selected, return null form
  if (!kind || kind !== "reddit") {
    return { kind: null, form: null, devices: allDevices };
  }

  // For Reddit, create form with defaults (lookupLimit: 300 for UI)
  const form = await superValidate(
    {
      kind: "reddit",
      enabled: true,
      name: "",
      subreddit: "",
      lookupLimit: 300,
      schedules: [],
      deviceIds: [],
    },
    zod4(redditSourceSchema)
  );

  return { kind: "reddit" as const, form, devices: allDevices };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const action = formData.get("action");

    const form = await superValidate(formData, zod4(redditSourceSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      const dbData = formDataToDbSource(form.data);

      // Insert source
      const [newSource] = await db
        .insert(sources)
        .values({
          enabled: dbData.enabled,
          name: dbData.name,
          kind: dbData.kind,
          params: dbData.params,
          lookupLimit: dbData.lookupLimit,
        })
        .returning({ id: sources.id });

      // Create schedules
      if (dbData.schedules.length > 0) {
        await db.insert(schedules).values(
          dbData.schedules.map((cron) => ({
            sourceId: newSource.id,
            cron,
          }))
        );
      }

      // Create subscriptions (device -> source links)
      if (dbData.deviceIds.length > 0) {
        await db.insert(subscriptions).values(
          dbData.deviceIds.map((deviceId) => ({
            deviceId,
            sourceId: newSource.id,
          }))
        );
      }

      // If action is "create_and_fetch", redirect with fetch param
      if (action === "create_and_fetch") {
        redirect(303, `/sources?fetch=${newSource.id}`);
      }

      redirect(303, "/sources");
    } catch (err: any) {
      if (err.message?.includes("UNIQUE constraint failed")) {
        return message(form, "A source with this name already exists", { status: 400 });
      }
      console.error("Failed to create source:", err);
      return message(form, "Failed to create source", { status: 500 });
    }
  },
};
