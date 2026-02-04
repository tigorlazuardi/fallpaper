import { json } from "@sveltejs/kit";
import {
  getConfig,
  getConfigPath,
  configFileExists,
  saveConfig,
  reloadConfig,
  defaultConfig,
  type AppConfig,
} from "$lib/server/config";
import type { RequestHandler } from "./$types";

/**
 * GET /api/config - Get current configuration
 */
export const GET: RequestHandler = async () => {
  try {
    const config = getConfig();
    const configPath = getConfigPath();
    const fileExists = configFileExists();

    return json({
      config,
      configPath,
      fileExists,
      defaults: defaultConfig,
    });
  } catch (err) {
    console.error("Failed to get config:", err);
    return json({ error: "Failed to get config" }, { status: 500 });
  }
};

/**
 * PUT /api/config - Update and save configuration
 */
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const newConfig = body.config as AppConfig;

    if (!newConfig) {
      return json({ error: "config is required" }, { status: 400 });
    }

    // Validate config structure
    if (!newConfig.database || !newConfig.scheduler || !newConfig.runner) {
      return json({ error: "Invalid config structure" }, { status: 400 });
    }

    // Save to config file
    const configPath = getConfigPath();
    saveConfig(newConfig, configPath);

    // Reload config in memory
    const reloaded = reloadConfig();

    return json({
      message: "Config saved successfully",
      config: reloaded,
      configPath,
    });
  } catch (err) {
    console.error("Failed to save config:", err);
    return json({ error: "Failed to save config" }, { status: 500 });
  }
};
