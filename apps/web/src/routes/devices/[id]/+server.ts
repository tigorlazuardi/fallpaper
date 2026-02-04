import { db } from "$lib/server/db";
import { devices, withQueryName } from "@packages/database";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    await withQueryName("Devices.Delete", async () =>
      await db.delete(devices).where(eq(devices.id, params.id))
    );
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Failed to delete device:", err);
    return new Response(JSON.stringify({ error: "Failed to delete device" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
