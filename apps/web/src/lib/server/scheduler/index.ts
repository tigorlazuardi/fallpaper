import { Cron } from "croner";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { schedules, sources, withQueryName, type Schedule } from "@packages/database";
import { getLogger } from "@packages/otel-server";
import { getSchedulerConfig } from "$lib/server/config";
import { createScheduledRun, processPendingRuns, recoverRunsOnStartup } from "./run-processor";

const logger = getLogger();

/**
 * Scheduler service that manages cron jobs for source schedules
 */
class SchedulerService {
  private jobs: Map<string, Cron> = new Map();
  private runProcessorJob: Cron | null = null;
  private isRunning = false;

  /**
   * Start the scheduler service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Scheduler is already running");
      return;
    }

    logger.info("Starting scheduler service");
    this.isRunning = true;

    // Recover any runs that were stuck in "running" state from previous process
    await recoverRunsOnStartup();

    // Load existing schedules
    await this.loadSchedules();

    // Start run processor based on config
    const config = getSchedulerConfig();
    this.runProcessorJob = new Cron(config.pollCron, async () => {
      try {
        const processed = await processPendingRuns();
        if (processed > 0) {
          logger.debug({ processed }, "Processed pending runs");
        }
      } catch (err) {
        logger.error({ err }, "Error processing pending runs");
      }
    });

    logger.info({ pollCron: config.pollCron }, "Scheduler service started");
  }

  /**
   * Stop the scheduler service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping scheduler service");

    // Stop all cron jobs
    for (const [id, job] of this.jobs) {
      job.stop();
      logger.debug({ scheduleId: id }, "Stopped cron job");
    }
    this.jobs.clear();

    // Stop run processor
    if (this.runProcessorJob) {
      this.runProcessorJob.stop();
      this.runProcessorJob = null;
    }

    this.isRunning = false;
    logger.info("Scheduler service stopped");
  }

  /**
   * Load all schedules from database and create cron jobs
   */
  async loadSchedules(): Promise<void> {
    const allSchedules = await withQueryName("Scheduler.LoadSchedules", async () =>
      await db.query.schedules.findMany({
        with: {
          source: true,
        },
      })
    );

    logger.info({ count: allSchedules.length }, "Loading schedules");

    for (const schedule of allSchedules) {
      // Only create job if source is enabled
      if (schedule.source?.enabled) {
        await this.addSchedule(schedule);
      }
    }
  }

  /**
   * Add a new schedule and create its cron job
   */
  async addSchedule(schedule: Schedule): Promise<void> {
    // Remove existing job if any
    this.removeSchedule(schedule.id);

    try {
      const job = new Cron(schedule.cron, async () => {
        try {
          logger.info(
            { scheduleId: schedule.id, sourceId: schedule.sourceId, cron: schedule.cron },
            "Cron triggered, creating run"
          );

          // Verify source is still enabled
          const source = await withQueryName("Scheduler.VerifySourceEnabled", async () =>
            await db.query.sources.findFirst({
              where: eq(sources.id, schedule.sourceId),
            })
          );

          if (!source || !source.enabled) {
            logger.info(
              { scheduleId: schedule.id, sourceId: schedule.sourceId },
              "Source disabled, skipping run creation"
            );
            return;
          }

          // Create a new run
          await createScheduledRun(schedule.id, schedule.sourceId);
        } catch (err) {
          logger.error({ err, scheduleId: schedule.id }, "Error creating scheduled run");
        }
      });

      this.jobs.set(schedule.id, job);

      // Get next run time
      const nextRun = job.nextRun();
      logger.info(
        {
          scheduleId: schedule.id,
          sourceId: schedule.sourceId,
          cron: schedule.cron,
          nextRun: nextRun?.toISOString(),
        },
        "Added cron job"
      );
    } catch (err) {
      logger.error({ err, scheduleId: schedule.id, cron: schedule.cron }, "Invalid cron expression");
    }
  }

  /**
   * Remove a schedule's cron job
   */
  removeSchedule(scheduleId: string): void {
    const job = this.jobs.get(scheduleId);
    if (job) {
      job.stop();
      this.jobs.delete(scheduleId);
      logger.debug({ scheduleId }, "Removed cron job");
    }
  }

  /**
   * Update a schedule (removes old job and creates new one)
   */
  async updateSchedule(schedule: Schedule): Promise<void> {
    await this.addSchedule(schedule);
  }

  /**
   * Reload schedules from database
   */
  async reloadSchedules(): Promise<void> {
    // Stop all existing jobs
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();

    // Reload
    await this.loadSchedules();
  }

  /**
   * Get status of all scheduled jobs
   */
  getStatus(): Array<{
    scheduleId: string;
    nextRun: Date | null;
    isRunning: boolean;
  }> {
    const status = [];
    for (const [id, job] of this.jobs) {
      status.push({
        scheduleId: id,
        nextRun: job.nextRun(),
        isRunning: job.isBusy(),
      });
    }
    return status;
  }

  /**
   * Check if scheduler is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Trigger immediate processing of pending runs (don't wait for poll interval)
   */
  async triggerProcessing(): Promise<number> {
    if (!this.isRunning) {
      logger.warn("Scheduler not running, cannot trigger processing");
      return 0;
    }

    logger.debug("Triggering immediate run processing");
    try {
      const processed = await processPendingRuns();
      if (processed > 0) {
        logger.info({ processed }, "Immediate processing completed");
      }
      return processed;
    } catch (err) {
      logger.error({ err }, "Error in immediate processing");
      throw err;
    }
  }
}

// Singleton instance
let schedulerInstance: SchedulerService | null = null;

/**
 * Get the scheduler service singleton
 */
export function getScheduler(): SchedulerService {
  if (!schedulerInstance) {
    schedulerInstance = new SchedulerService();
  }
  return schedulerInstance;
}

/**
 * Start the scheduler (should be called once at app startup)
 */
export async function startScheduler(): Promise<void> {
  const scheduler = getScheduler();
  await scheduler.start();
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}

// Re-export run processor functions for external use
export {
  createScheduledRun,
  processPendingRuns,
  executeRun,
  updateRunState,
  recoverStaleRuns,
  recoverRunsOnStartup,
} from "./run-processor";
