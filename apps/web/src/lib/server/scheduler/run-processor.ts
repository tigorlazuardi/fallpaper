import { eq, and, lte } from "drizzle-orm";
import { db } from "$lib/server/db";
import { runs, sources, withQueryName, type Run } from "@packages/database";
import { getLogger } from "@packages/otel-server";
import { createRedditRunner, type BaseRunnerConfig } from "../runner";
import { getSchedulerConfig, getRunnerConfig } from "$lib/server/config";

const logger = getLogger();

/**
 * Recover ALL runs that are stuck in "running" state on app startup.
 * Called once when scheduler starts - any "running" run at this point
 * must be from a previous process that crashed/restarted.
 */
export async function recoverRunsOnStartup(): Promise<number> {
  const config = getSchedulerConfig();

  // Find ALL runs that are "running" - they're all stuck since we just started
  const stuckRuns = await withQueryName("Scheduler.GetStuckRunsOnStartup", async () =>
    await db.query.runs.findMany({
      where: eq(runs.state, "running"),
    })
  );

  if (stuckRuns.length === 0) {
    logger.info("No stuck runs found on startup");
    return 0;
  }

  logger.warn({ count: stuckRuns.length }, "Found stuck runs on startup, recovering...");

  for (const run of stuckRuns) {
    if (run.retryCount < run.maxRetries) {
      await withQueryName("Scheduler.RecoverStuckRunOnStartup", async () =>
        await db
          .update(runs)
          .set({
            state: "pending",
            retryCount: run.retryCount + 1,
            error: "Run interrupted by server restart",
            progressMessage: `Recovered on startup, retry ${run.retryCount + 1}/${run.maxRetries}`,
            updatedAt: new Date(),
            scheduledAt: new Date(), // Retry immediately
          })
          .where(eq(runs.id, run.id))
      );

      logger.info({ runId: run.id }, "Stuck run recovered on startup, scheduled for immediate retry");
    } else {
      await withQueryName("Scheduler.FailStuckRunOnStartup", async () =>
        await db
          .update(runs)
          .set({
            state: "failed",
            completedAt: new Date(),
            error: "Run interrupted by server restart, max retries reached",
            progressMessage: `Failed: interrupted after ${run.maxRetries} retries`,
            updatedAt: new Date(),
          })
          .where(eq(runs.id, run.id))
      );

      logger.warn({ runId: run.id }, "Stuck run marked as failed on startup (max retries reached)");
    }
  }

  return stuckRuns.length;
}

/**
 * Get runner configuration from config
 */
function getRunnerBaseConfig(): BaseRunnerConfig {
  const config = getRunnerConfig();
  return {
    imageBaseDir: config.imageDir,
    tempDir: config.tempDir,
    maxConcurrentDownloads: config.maxConcurrentDownloads,
    minSpeedBytesPerSec: config.minSpeedBytesPerSec,
    slowSpeedTimeoutMs: config.slowSpeedTimeoutMs,
  };
}

/**
 * Create a new run record for a schedule
 */
export async function createScheduledRun(scheduleId: string, sourceId: string): Promise<Run> {
  const [run] = await withQueryName("Scheduler.CreateRun", async () =>
    await db
      .insert(runs)
      .values({
        scheduleId,
        sourceId,
        name: "fetch_source",
        state: "pending",
        input: {},
        scheduledAt: new Date(),
      })
      .returning()
  );

  logger.info({ runId: run.id, scheduleId, sourceId }, "Created scheduled run");

  return run;
}

/**
 * Update run state
 */
export async function updateRunState(
  runId: string,
  state: string,
  updates: Partial<{
    startedAt: Date;
    completedAt: Date;
    error: string;
    output: unknown;
    progressCurrent: number;
    progressTotal: number;
    progressMessage: string;
  }> = {}
): Promise<void> {
  await withQueryName("Scheduler.UpdateRunState", async () =>
    await db
      .update(runs)
      .set({
        state,
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId))
  );
}

/**
 * Execute a single run
 */
export async function executeRun(run: Run): Promise<void> {
  logger.info({ runId: run.id, sourceId: run.sourceId, name: run.name }, "Starting run execution");

  // Mark as running
  await updateRunState(run.id, "running", {
    startedAt: new Date(),
    progressMessage: "Starting...",
  });

  try {
    const sourceId = run.sourceId;
    if (!sourceId) {
      throw new Error("Run has no sourceId");
    }

    // Get source to determine runner type
    const source = await withQueryName("Scheduler.GetSourceForRun", async () =>
      await db.query.sources.findFirst({
        where: eq(sources.id, sourceId),
      })
    );

    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // Get runner based on source kind
    let result;
    const runnerConfig = getRunnerBaseConfig();

    switch (source.kind) {
      case "reddit":
        const redditRunner = createRedditRunner();
        result = await redditRunner.run(sourceId, runnerConfig);
        break;
      default:
        throw new Error(`Unknown source kind: ${source.kind}`);
    }

    // Mark as completed or failed based on result
    if (result.success) {
      await updateRunState(run.id, "completed", {
        completedAt: new Date(),
        output: result,
        progressCurrent: result.imagesDownloaded,
        progressTotal: result.imagesFound,
        progressMessage: `Completed: ${result.imagesDownloaded} downloaded, ${result.imagesSkipped} skipped, ${result.imagesFailed} failed`,
      });

      logger.info(
        {
          runId: run.id,
          downloaded: result.imagesDownloaded,
          skipped: result.imagesSkipped,
          failed: result.imagesFailed,
        },
        "Run completed successfully"
      );
    } else {
      await updateRunState(run.id, "failed", {
        completedAt: new Date(),
        error: result.error || "Unknown error",
        output: result,
        progressMessage: `Failed: ${result.error}`,
      });

      logger.warn({ runId: run.id, error: result.error }, "Run completed with failure");
    }
  } catch (err: any) {
    logger.error({ err, runId: run.id }, "Run execution failed");

    // Check if we should retry
    if (run.retryCount < run.maxRetries) {
      const schedulerConfig = getSchedulerConfig();
      await withQueryName("Scheduler.ScheduleRetry", async () =>
        await db
          .update(runs)
          .set({
            state: "pending",
            retryCount: run.retryCount + 1,
            error: err.message,
            progressMessage: `Retry ${run.retryCount + 1}/${run.maxRetries}: ${err.message}`,
            updatedAt: new Date(),
            // Schedule retry with exponential backoff
            scheduledAt: new Date(Date.now() + Math.pow(2, run.retryCount) * schedulerConfig.retryBackoffBaseMs),
          })
          .where(eq(runs.id, run.id))
      );

      logger.info(
        { runId: run.id, retryCount: run.retryCount + 1, maxRetries: run.maxRetries },
        "Run scheduled for retry"
      );
    } else {
      await updateRunState(run.id, "failed", {
        completedAt: new Date(),
        error: err.message,
        progressMessage: `Failed after ${run.maxRetries} retries: ${err.message}`,
      });
    }
  }
}

/**
 * Recover stale runs that are stuck in "running" state
 * This can happen if the server crashes while a run is in progress
 */
export async function recoverStaleRuns(): Promise<number> {
  const config = getSchedulerConfig();
  const staleThreshold = new Date(Date.now() - config.staleRunTimeoutMs);

  // Find runs that are "running" but started too long ago
  const staleRuns = await withQueryName("Scheduler.GetStaleRuns", async () =>
    await db.query.runs.findMany({
      where: and(
        eq(runs.state, "running"),
        lte(runs.startedAt, staleThreshold)
      ),
    })
  );

  if (staleRuns.length === 0) {
    return 0;
  }

  logger.warn({ count: staleRuns.length }, "Found stale runs, recovering...");

  for (const run of staleRuns) {
    // Check if we should retry or mark as failed
    if (run.retryCount < run.maxRetries) {
      await withQueryName("Scheduler.RecoverStaleRunRetry", async () =>
        await db
          .update(runs)
          .set({
            state: "pending",
            retryCount: run.retryCount + 1,
            error: "Run timed out (server may have restarted)",
            progressMessage: `Recovered from stale state, retry ${run.retryCount + 1}/${run.maxRetries}`,
            updatedAt: new Date(),
            // Schedule retry with backoff
            scheduledAt: new Date(Date.now() + Math.pow(2, run.retryCount) * config.retryBackoffBaseMs),
          })
          .where(eq(runs.id, run.id))
      );

      logger.info(
        { runId: run.id, retryCount: run.retryCount + 1 },
        "Stale run recovered, scheduled for retry"
      );
    } else {
      await withQueryName("Scheduler.RecoverStaleRunFailed", async () =>
        await db
          .update(runs)
          .set({
            state: "failed",
            completedAt: new Date(),
            error: "Run timed out after maximum retries",
            progressMessage: `Failed: timed out after ${run.maxRetries} retries`,
            updatedAt: new Date(),
          })
          .where(eq(runs.id, run.id))
      );

      logger.warn({ runId: run.id }, "Stale run marked as failed (max retries reached)");
    }
  }

  return staleRuns.length;
}

/**
 * Process pending runs that are due
 */
export async function processPendingRuns(): Promise<number> {
  const config = getSchedulerConfig();

  // First, recover any stale runs
  await recoverStaleRuns();

  const now = new Date();

  // Find pending runs that are due
  const pendingRuns = await withQueryName("Scheduler.GetPendingRuns", async () =>
    await db.query.runs.findMany({
      where: and(eq(runs.state, "pending"), lte(runs.scheduledAt, now)),
      orderBy: (runs, { asc }) => [asc(runs.scheduledAt)],
      limit: config.maxPendingRunsPerPoll,
    })
  );

  if (pendingRuns.length === 0) {
    return 0;
  }

  logger.info({ count: pendingRuns.length }, "Processing pending runs");

  // Execute runs sequentially to avoid overwhelming resources
  for (const run of pendingRuns) {
    await executeRun(run);
  }

  return pendingRuns.length;
}
