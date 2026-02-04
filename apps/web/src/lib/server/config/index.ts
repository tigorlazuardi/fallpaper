import { env } from "$env/dynamic/private";
import { loadConfig, getConfigPath, configFileExists, saveConfig, generateEnvContent, validateConfig } from "./loader";
import type { AppConfig, DatabaseConfig, SchedulerConfig, RunnerConfig } from "./schema";

export type { AppConfig, DatabaseConfig, SchedulerConfig, RunnerConfig };
export {
  defaultConfig,
  getDefaultConfigPath,
  envMappings,
  appConfigSchema,
  partialAppConfigSchema,
  databaseConfigSchema,
  schedulerConfigSchema,
  runnerConfigSchema,
} from "./schema";
export { getConfigPath, configFileExists, saveConfig, generateEnvContent, validateConfig } from "./loader";

// Singleton config instance
let configInstance: AppConfig | null = null;

/**
 * Get the application configuration
 * Loads once and caches the result
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig(env);
  }
  return configInstance;
}

/**
 * Get database configuration
 */
export function getDatabaseConfig(): DatabaseConfig {
  return getConfig().database;
}

/**
 * Get scheduler configuration
 */
export function getSchedulerConfig(): SchedulerConfig {
  return getConfig().scheduler;
}

/**
 * Get runner configuration
 */
export function getRunnerConfig(): RunnerConfig {
  return getConfig().runner;
}

/**
 * Reload configuration (useful for testing or hot-reload scenarios)
 */
export function reloadConfig(): AppConfig {
  configInstance = loadConfig(env);
  return configInstance;
}

/**
 * Reset config instance (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}
