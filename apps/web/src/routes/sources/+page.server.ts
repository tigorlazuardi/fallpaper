import { db } from "$lib/server/db";
import { sources } from "@packages/database";
import { desc } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const allSources = await db.query.sources.findMany({
    orderBy: [desc(sources.createdAt)],
  });

  return { sources: allSources };
};
