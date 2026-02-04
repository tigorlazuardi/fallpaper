import { describe, it, expect } from "vitest";
import {
  databaseConfigSchema,
  schedulerConfigSchema,
  runnerConfigSchema,
  appConfigSchema,
  partialAppConfigSchema,
  defaultConfig,
} from "./schema";

describe("databaseConfigSchema", () => {
  it("should parse valid config", () => {
    const input = {
      path: "/data/test.db",
      logging: true,
      tracing: false,
    };
    const result = databaseConfigSchema.parse(input);
    expect(result).toEqual(input);
  });

  it("should apply defaults for empty object", () => {
    const result = databaseConfigSchema.parse({});
    expect(result.path).toContain("fallpaper.db");
    expect(result.logging).toBe(true);
    expect(result.tracing).toBe(true);
  });

  it("should coerce boolean from string 'true'", () => {
    const result = databaseConfigSchema.parse({
      path: "/test.db",
      logging: "true",
      tracing: "false",
    });
    expect(result.logging).toBe(true);
    expect(result.tracing).toBe(false);
  });

  it("should coerce boolean from string '0' and '1'", () => {
    const result = databaseConfigSchema.parse({
      path: "/test.db",
      logging: "1",
      tracing: "0",
    });
    expect(result.logging).toBe(true);
    expect(result.tracing).toBe(false);
  });

  it("should reject empty path", () => {
    const result = databaseConfigSchema.safeParse({
      path: "",
      logging: true,
      tracing: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("schedulerConfigSchema", () => {
  it("should parse valid config", () => {
    const input = {
      pollCron: "*/5 * * * *",
      staleRunTimeoutMs: 60000,
      maxPendingRunsPerPoll: 20,
      retryBackoffBaseMs: 30000,
    };
    const result = schedulerConfigSchema.parse(input);
    expect(result).toEqual(input);
  });

  it("should apply defaults for empty object", () => {
    const result = schedulerConfigSchema.parse({});
    expect(result.pollCron).toBe("* * * * *");
    expect(result.staleRunTimeoutMs).toBe(30 * 60 * 1000);
    expect(result.maxPendingRunsPerPoll).toBe(10);
    expect(result.retryBackoffBaseMs).toBe(60 * 1000);
  });

  it("should coerce numbers from strings", () => {
    const result = schedulerConfigSchema.parse({
      pollCron: "* * * * *",
      staleRunTimeoutMs: "120000",
      maxPendingRunsPerPoll: "5",
      retryBackoffBaseMs: "60000",
    });
    expect(result.staleRunTimeoutMs).toBe(120000);
    expect(result.maxPendingRunsPerPoll).toBe(5);
    expect(result.retryBackoffBaseMs).toBe(60000);
  });

  it("should reject maxPendingRunsPerPoll > 100", () => {
    const result = schedulerConfigSchema.safeParse({
      pollCron: "* * * * *",
      staleRunTimeoutMs: 60000,
      maxPendingRunsPerPoll: 101,
      retryBackoffBaseMs: 60000,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative numbers", () => {
    const result = schedulerConfigSchema.safeParse({
      pollCron: "* * * * *",
      staleRunTimeoutMs: -1,
      maxPendingRunsPerPoll: 10,
      retryBackoffBaseMs: 60000,
    });
    expect(result.success).toBe(false);
  });
});

describe("runnerConfigSchema", () => {
  it("should parse valid config", () => {
    const input = {
      imageDir: "/data/images",
      tempDir: "/data/temp",
      maxConcurrentDownloads: 10,
      minSpeedBytesPerSec: 5120,
      slowSpeedTimeoutMs: 60000,
    };
    const result = runnerConfigSchema.parse(input);
    expect(result).toEqual(input);
  });

  it("should apply defaults for empty object", () => {
    const result = runnerConfigSchema.parse({});
    expect(result.imageDir).toContain("images");
    expect(result.tempDir).toContain("temp");
    expect(result.maxConcurrentDownloads).toBe(5);
    expect(result.minSpeedBytesPerSec).toBe(10 * 1024);
    expect(result.slowSpeedTimeoutMs).toBe(30 * 1000);
  });

  it("should coerce numbers from strings", () => {
    const result = runnerConfigSchema.parse({
      imageDir: "/images",
      tempDir: "/temp",
      maxConcurrentDownloads: "8",
      minSpeedBytesPerSec: "20480",
      slowSpeedTimeoutMs: "45000",
    });
    expect(result.maxConcurrentDownloads).toBe(8);
    expect(result.minSpeedBytesPerSec).toBe(20480);
    expect(result.slowSpeedTimeoutMs).toBe(45000);
  });

  it("should reject maxConcurrentDownloads > 50", () => {
    const result = runnerConfigSchema.safeParse({
      imageDir: "/images",
      tempDir: "/temp",
      maxConcurrentDownloads: 51,
      minSpeedBytesPerSec: 10240,
      slowSpeedTimeoutMs: 30000,
    });
    expect(result.success).toBe(false);
  });
});

describe("appConfigSchema", () => {
  it("should parse full valid config", () => {
    const input = {
      database: {
        path: "/data/test.db",
        logging: true,
        tracing: true,
      },
      scheduler: {
        pollCron: "* * * * *",
        staleRunTimeoutMs: 1800000,
        maxPendingRunsPerPoll: 10,
        retryBackoffBaseMs: 60000,
      },
      runner: {
        imageDir: "/data/images",
        tempDir: "/data/temp",
        maxConcurrentDownloads: 5,
        minSpeedBytesPerSec: 10240,
        slowSpeedTimeoutMs: 30000,
      },
    };
    const result = appConfigSchema.parse(input);
    expect(result).toEqual(input);
  });
});

describe("partialAppConfigSchema", () => {
  it("should apply all defaults for empty object", () => {
    const result = partialAppConfigSchema.parse({});
    expect(result.database.path).toContain("fallpaper.db");
    expect(result.scheduler.pollCron).toBe("* * * * *");
    expect(result.runner.maxConcurrentDownloads).toBe(5);
  });

  it("should merge partial config with defaults", () => {
    const result = partialAppConfigSchema.parse({
      database: {
        path: "/custom/path.db",
      },
      scheduler: {
        maxPendingRunsPerPoll: 20,
      },
    });
    expect(result.database.path).toBe("/custom/path.db");
    expect(result.database.logging).toBe(true); // default
    expect(result.scheduler.maxPendingRunsPerPoll).toBe(20);
    expect(result.scheduler.pollCron).toBe("* * * * *"); // default
    expect(result.runner.maxConcurrentDownloads).toBe(5); // default
  });

  it("should handle missing sections", () => {
    const result = partialAppConfigSchema.parse({
      database: {
        path: "/test.db",
        logging: false,
        tracing: false,
      },
    });
    expect(result.database.path).toBe("/test.db");
    expect(result.scheduler).toBeDefined();
    expect(result.runner).toBeDefined();
  });
});

describe("defaultConfig", () => {
  it("should have valid default values", () => {
    expect(defaultConfig.database.path).toContain("fallpaper.db");
    expect(defaultConfig.database.logging).toBe(true);
    expect(defaultConfig.database.tracing).toBe(true);

    expect(defaultConfig.scheduler.pollCron).toBe("* * * * *");
    expect(defaultConfig.scheduler.staleRunTimeoutMs).toBe(30 * 60 * 1000);
    expect(defaultConfig.scheduler.maxPendingRunsPerPoll).toBe(10);
    expect(defaultConfig.scheduler.retryBackoffBaseMs).toBe(60 * 1000);

    expect(defaultConfig.runner.maxConcurrentDownloads).toBe(5);
    expect(defaultConfig.runner.minSpeedBytesPerSec).toBe(10 * 1024);
    expect(defaultConfig.runner.slowSpeedTimeoutMs).toBe(30 * 1000);
  });

  it("should pass validation", () => {
    const result = appConfigSchema.safeParse(defaultConfig);
    expect(result.success).toBe(true);
  });
});
