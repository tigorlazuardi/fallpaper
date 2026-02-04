import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadConfig,
  getConfigPath,
  configFileExists,
  saveConfig,
  generateEnvContent,
  validateConfig,
} from "./loader";
import { defaultConfig } from "./schema";

// Use temp directory for tests
const TEST_DIR = join(tmpdir(), "fallpaper-config-test");
const TEST_CONFIG_PATH = join(TEST_DIR, "config");

describe("loadConfig", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should return defaults when no config file and no env vars", () => {
    const config = loadConfig({
      FALLPAPER_CONFIG: TEST_CONFIG_PATH,
    });

    expect(config.database.logging).toBe(true);
    expect(config.scheduler.pollCron).toBe("* * * * *");
    expect(config.runner.maxConcurrentDownloads).toBe(5);
  });

  it("should load config from file", () => {
    const configContent = `
FALLPAPER_DATABASE_PATH=/custom/db.sqlite
FALLPAPER_DATABASE_LOGGING=false
FALLPAPER_SCHEDULER_MAX_PENDING_RUNS=20
FALLPAPER_RUNNER_MAX_CONCURRENT_DOWNLOADS=10
`;
    writeFileSync(TEST_CONFIG_PATH, configContent);

    const config = loadConfig({
      FALLPAPER_CONFIG: TEST_CONFIG_PATH,
    });

    expect(config.database.path).toBe("/custom/db.sqlite");
    expect(config.database.logging).toBe(false);
    expect(config.scheduler.maxPendingRunsPerPoll).toBe(20);
    expect(config.runner.maxConcurrentDownloads).toBe(10);
  });

  it("should override config file with env vars", () => {
    const configContent = `
FALLPAPER_DATABASE_PATH=/from/file.db
FALLPAPER_RUNNER_MAX_CONCURRENT_DOWNLOADS=5
`;
    writeFileSync(TEST_CONFIG_PATH, configContent);

    const config = loadConfig({
      FALLPAPER_CONFIG: TEST_CONFIG_PATH,
      FALLPAPER_DATABASE_PATH: "/from/env.db",
      FALLPAPER_RUNNER_MAX_CONCURRENT_DOWNLOADS: "15",
    });

    expect(config.database.path).toBe("/from/env.db");
    expect(config.runner.maxConcurrentDownloads).toBe(15);
  });

  it("should handle boolean coercion from env vars", () => {
    const config = loadConfig({
      FALLPAPER_CONFIG: TEST_CONFIG_PATH,
      FALLPAPER_DATABASE_LOGGING: "false",
      FALLPAPER_DATABASE_TRACING: "0",
    });

    expect(config.database.logging).toBe(false);
    expect(config.database.tracing).toBe(false);
  });

  it("should handle number coercion from env vars", () => {
    const config = loadConfig({
      FALLPAPER_CONFIG: TEST_CONFIG_PATH,
      FALLPAPER_SCHEDULER_STALE_RUN_TIMEOUT_MS: "3600000",
      FALLPAPER_SCHEDULER_MAX_PENDING_RUNS: "50",
    });

    expect(config.scheduler.staleRunTimeoutMs).toBe(3600000);
    expect(config.scheduler.maxPendingRunsPerPoll).toBe(50);
  });

  it("should ignore empty env var values", () => {
    const config = loadConfig({
      FALLPAPER_CONFIG: TEST_CONFIG_PATH,
      FALLPAPER_DATABASE_PATH: "",
    });

    // Should use default, not empty string
    expect(config.database.path).toContain("fallpaper.db");
  });
});

describe("getConfigPath", () => {
  it("should return FALLPAPER_CONFIG if set", () => {
    const path = getConfigPath({ FALLPAPER_CONFIG: "/custom/config" });
    expect(path).toBe("/custom/config");
  });

  it("should return XDG config path if no env var", () => {
    const path = getConfigPath({});
    expect(path).toContain("fallpaper");
    expect(path).toContain("config");
  });

  it("should respect XDG_CONFIG_HOME", () => {
    const path = getConfigPath({ XDG_CONFIG_HOME: "/custom/xdg" });
    expect(path).toBe("/custom/xdg/fallpaper/config");
  });
});

describe("configFileExists", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should return false if file does not exist", () => {
    const exists = configFileExists({ FALLPAPER_CONFIG: TEST_CONFIG_PATH });
    expect(exists).toBe(false);
  });

  it("should return true if file exists", () => {
    writeFileSync(TEST_CONFIG_PATH, "# config");
    const exists = configFileExists({ FALLPAPER_CONFIG: TEST_CONFIG_PATH });
    expect(exists).toBe(true);
  });
});

describe("saveConfig", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should save config to file", () => {
    const config = {
      ...defaultConfig,
      database: {
        ...defaultConfig.database,
        path: "/saved/db.sqlite",
      },
    };

    saveConfig(config, TEST_CONFIG_PATH);

    expect(existsSync(TEST_CONFIG_PATH)).toBe(true);

    // Load it back
    const loaded = loadConfig({ FALLPAPER_CONFIG: TEST_CONFIG_PATH });
    expect(loaded.database.path).toBe("/saved/db.sqlite");
  });

  it("should create parent directories", () => {
    const nestedPath = join(TEST_DIR, "nested", "deep", "config");
    saveConfig(defaultConfig, nestedPath);
    expect(existsSync(nestedPath)).toBe(true);
  });

  it("should validate config before saving", () => {
    const invalidConfig = {
      database: {
        path: "", // Invalid: empty
        logging: true,
        tracing: true,
      },
      scheduler: defaultConfig.scheduler,
      runner: defaultConfig.runner,
    };

    expect(() => saveConfig(invalidConfig as any, TEST_CONFIG_PATH)).toThrow();
  });
});

describe("generateEnvContent", () => {
  it("should generate valid env file content", () => {
    const content = generateEnvContent(defaultConfig);

    expect(content).toContain("# Fallpaper Configuration");
    expect(content).toContain("# Database");
    expect(content).toContain("FALLPAPER_DATABASE_PATH=");
    expect(content).toContain("FALLPAPER_DATABASE_LOGGING=true");
    expect(content).toContain("# Scheduler");
    expect(content).toContain('FALLPAPER_SCHEDULER_POLL_CRON="* * * * *"');
    expect(content).toContain("# Runner");
    expect(content).toContain("FALLPAPER_RUNNER_MAX_CONCURRENT_DOWNLOADS=5");
  });

  it("should quote values with spaces", () => {
    const config = {
      ...defaultConfig,
      database: {
        ...defaultConfig.database,
        path: "/path with spaces/db.sqlite",
      },
    };
    const content = generateEnvContent(config);
    expect(content).toContain('FALLPAPER_DATABASE_PATH="/path with spaces/db.sqlite"');
  });
});

describe("validateConfig", () => {
  it("should return validated config for valid input", () => {
    const result = validateConfig(defaultConfig);
    expect(result).toEqual(defaultConfig);
  });

  it("should throw for invalid config", () => {
    const invalid = {
      database: {
        path: "",
        logging: true,
        tracing: true,
      },
    };
    expect(() => validateConfig(invalid)).toThrow();
  });

  it("should coerce types during validation", () => {
    const input = {
      database: {
        path: "/test.db",
        logging: "true",
        tracing: "false",
      },
      scheduler: {
        pollCron: "* * * * *",
        staleRunTimeoutMs: "60000",
        maxPendingRunsPerPoll: "10",
        retryBackoffBaseMs: "30000",
      },
      runner: {
        imageDir: "/images",
        tempDir: "/temp",
        maxConcurrentDownloads: "5",
        minSpeedBytesPerSec: "10240",
        slowSpeedTimeoutMs: "30000",
      },
    };

    const result = validateConfig(input);
    expect(result.database.logging).toBe(true);
    expect(result.database.tracing).toBe(false);
    expect(result.scheduler.staleRunTimeoutMs).toBe(60000);
    expect(result.runner.maxConcurrentDownloads).toBe(5);
  });
});
