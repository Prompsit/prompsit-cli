// See API-455: Health check command

import { Command } from "@commander-js/extra-typings";
import { getApiClient } from "../api/client.ts";
import { terminal, createHealthTableModel } from "../output/index.ts";
import { toHealthResponseVM } from "./mappers.ts";
import { getSettings } from "../config/settings.ts";
import { getLogger } from "../logging/index.ts";
import { handleCommandError } from "./error-handler.ts";

const log = getLogger(import.meta.url);

/**
 * Health check command.
 *
 * Calls GET /health, displays table.
 */
export const healthCommand = new Command("health")
  .description("Check API health status")
  .action(async () => {
    const startMs = Date.now();
    log.info("Command started", { command: "health" });
    try {
      const health = await getApiClient().health.check();
      log.info("Command completed", {
        command: "health",
        duration_ms: String(Date.now() - startMs),
      });
      terminal.table(
        createHealthTableModel(toHealthResponseVM(health), getSettings().api.base_url)
      );
    } catch (error: unknown) {
      handleCommandError(log, error, {
        command: "health",
        duration_ms: String(Date.now() - startMs),
      });
    }
  });
