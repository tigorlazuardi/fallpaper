import { db } from "$lib/server/db";
import { sources, withQueryName } from "@packages/database";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    await withQueryName("Sources.Delete", async () =>
      await db.delete(sources).where(eq(sources.id, params.id))
    );
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Failed to delete source:", err);
    return new Response(JSON.stringify({ error: "Failed to delete source" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
