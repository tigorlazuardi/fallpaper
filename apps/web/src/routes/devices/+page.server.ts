import { db } from "$lib/server/db";
import { devices, withQueryName } from "@packages/database";
import { desc } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const allDevices = await withQueryName("Devices.List", async () =>
    await db
      .select()
      .from(devices)
      .orderBy(desc(devices.createdAt))
  );

  return {
    devices: allDevices,
  };
};
