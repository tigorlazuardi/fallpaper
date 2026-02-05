import { json } from "@sveltejs/kit";
import { eq, desc } from "drizzle-orm";
import { db } from "$lib/server/db";
import { runs, sources, withQueryName } from "@packages/database";
import { getScheduler } from "$lib/server/scheduler";
import type { RequestHandler } from "./$types";

/**
 * GET /api/runs - List recent runs
 * Query params:
 *   - limit: number (default 20, max 100)
 *   - sourceId: filter by source
 *   - state: filter by state (pending, running, completed, failed)
 */
export const GET: RequestHandler = async ({ url }) => {
  const limitParam = url.searchParams.get("limit");
  const sourceId = url.searchParams.get("sourceId");
  const state = url.searchParams.get("state");

  const limit = Math.min(Math.max(parseInt(limitParam || "20", 10), 1), 100);

  try {
    let query = db.query.runs.findMany({
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
    });

    // Note: Drizzle doesn't support dynamic where in findMany with "with"
    // For filtering, we'll do a separate query
    const allRuns = await withQueryName("API.ListRuns", async () => {
      const result = await db.query.runs.findMany({
        orderBy: [desc(runs.createdAt)],
        limit: limit * 2, // Fetch more to filter
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
      });

      // Filter in JS (not ideal but works for small datasets)
      let filtered = result;
      if (sourceId) {
        filtered = filtered.filter((r) => r.sourceId === sourceId);
      }
      if (state) {
        filtered = filtered.filter((r) => r.state === state);
      }

      return filtered.slice(0, limit);
    });

    return json({ runs: allRuns });
  } catch (err) {
    console.error("Failed to list runs:", err);
    return json({ error: "Failed to list runs" }, { status: 500 });
  }
};

/**
 * POST /api/runs - Create and trigger a manual run
 * Body:
 *   - sourceId: string (required) - The source to run
 *   - immediate: boolean (default true) - If true, scheduledAt is now; if false, just create pending
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { sourceId, immediate = true } = body;

    if (!sourceId || typeof sourceId !== "string") {
      return json({ error: "sourceId is required" }, { status: 400 });
    }

    // Verify source exists and is enabled
    const source = await withQueryName("API.GetSourceForRun", async () =>
      await db.query.sources.findFirst({
        where: eq(sources.id, sourceId),
      })
    );

    if (!source) {
      return json({ error: "Source not found" }, { status: 404 });
    }

    if (!source.enabled) {
      return json({ error: "Source is disabled" }, { status: 400 });
    }

    // Create run record (no scheduleId since this is manual)
    const [run] = await withQueryName("API.CreateManualRun", async () =>
      await db
        .insert(runs)
        .values({
          sourceId,
          scheduleId: null, // Manual run, no schedule
          name: "fetch_source",
          state: "pending",
          input: { manual: true },
          scheduledAt: immediate ? new Date() : new Date(Date.now() + 60_000), // Now or 1 min later
        })
        .returning()
    );

    // Trigger immediate processing if requested
    if (immediate) {
      // Don't await - let it run in background so API responds quickly
      getScheduler().triggerProcessing().catch((err) => {
        console.error("Failed to trigger immediate processing:", err);
      });
    }

    return json(
      {
        message: "Run created successfully",
        run: {
          id: run.id,
          sourceId: run.sourceId,
          state: run.state,
          scheduledAt: run.scheduledAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to create run:", err);
    return json({ error: "Failed to create run" }, { status: 500 });
  }
};
