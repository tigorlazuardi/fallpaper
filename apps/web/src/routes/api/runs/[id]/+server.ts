import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { runs, withQueryName } from "@packages/database";
import type { RequestHandler } from "./$types";

/**
 * GET /api/runs/[id] - Get run details
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const run = await withQueryName("API.GetRunById", async () =>
      await db.query.runs.findFirst({
        where: eq(runs.id, params.id),
        with: {
          source: {
            columns: {
              id: true,
              name: true,
              kind: true,
              enabled: true,
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

    if (!run) {
      return json({ error: "Run not found" }, { status: 404 });
    }

    return json({ run });
  } catch (err) {
    console.error("Failed to get run:", err);
    return json({ error: "Failed to get run" }, { status: 500 });
  }
};

/**
 * DELETE /api/runs/[id] - Cancel a pending run
 * Only pending runs can be cancelled
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    // Get current run state
    const run = await withQueryName("API.GetRunForCancel", async () =>
      await db.query.runs.findFirst({
        where: eq(runs.id, params.id),
        columns: {
          id: true,
          state: true,
        },
      })
    );

    if (!run) {
      return json({ error: "Run not found" }, { status: 404 });
    }

    if (run.state !== "pending") {
      return json(
        { error: `Cannot cancel run with state "${run.state}". Only pending runs can be cancelled.` },
        { status: 400 }
      );
    }

    // Update to cancelled
    await withQueryName("API.CancelRun", async () =>
      await db
        .update(runs)
        .set({
          state: "cancelled",
          completedAt: new Date(),
          progressMessage: "Cancelled by user",
          updatedAt: new Date(),
        })
        .where(eq(runs.id, params.id))
    );

    return json({ message: "Run cancelled successfully" });
  } catch (err) {
    console.error("Failed to cancel run:", err);
    return json({ error: "Failed to cancel run" }, { status: 500 });
  }
};
