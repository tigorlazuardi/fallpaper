import {
  getConfig,
  getConfigPath,
  configFileExists,
  saveConfig,
  reloadConfig,
  defaultConfig,
  appConfigSchema,
} from "$lib/server/config";
import { superValidate, fail, message } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async () => {
  const config = getConfig();
  const configPath = getConfigPath();
  const fileExists = configFileExists();

  // Create form with current config values
  const form = await superValidate(config, zod4(appConfigSchema));

  return {
    form,
    configPath,
    fileExists,
    defaults: defaultConfig,
  };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const form = await superValidate(request, zod4(appConfigSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      // Save to config file
      const configPath = getConfigPath();
      saveConfig(form.data, configPath);

      // Reload config in memory
      reloadConfig();

      return message(form, "Configuration saved successfully");
    } catch (err: any) {
      console.error("Failed to save config:", err);
      return message(form, err.message || "Failed to save configuration", { status: 500 });
    }
  },

  reset: async () => {
    try {
      // Save default config
      const configPath = getConfigPath();
      saveConfig(defaultConfig, configPath);

      // Reload config in memory
      reloadConfig();

      // Return form with default values
      const form = await superValidate(defaultConfig, zod4(appConfigSchema));
      return message(form, "Configuration reset to defaults");
    } catch (err: any) {
      console.error("Failed to reset config:", err);
      const form = await superValidate(defaultConfig, zod4(appConfigSchema));
      return message(form, err.message || "Failed to reset configuration", { status: 500 });
    }
  },
};
