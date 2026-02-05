import { db } from "$lib/server/db";
import { runs, withQueryName } from "@packages/database";
import { desc } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "50", 10), 1), 200);

  const allRuns = await withQueryName("Runs.List", async () =>
    await db.query.runs.findMany({
      orderBy: [desc(runs.createdAt)],
      limit,
      with: {
        source: {
          columns: {
            id: true,
            name: true,
            kind: true,
          },
        },
        schedule: {
          columns: {
            id: true,
            cron: true,
          },
        },
      },
    })
  );

  return { runs: allRuns, limit };
};
