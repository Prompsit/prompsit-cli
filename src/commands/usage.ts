// Usage command — GET /v1/user/usage, display daily usage bar.

import { Command } from "@commander-js/extra-typings";
import { getApiClient } from "../api/client.ts";
import { terminal, renderUsageBar } from "../output/index.ts";
import { toUsageVM } from "./mappers.ts";
import { getLogger } from "../logging/index.ts";
import { handleCommandError } from "./error-handler.ts";
import { t } from "../i18n/index.ts";

const log = getLogger(import.meta.url);

/**
 * Usage command.
 *
 * Calls GET /v1/user/usage, displays colored progress bar.
 */
export const usageCommand = new Command("usage")
  .description("Show daily API usage")
  .action(async () => {
    const startMs = Date.now();
    log.info("Command started", { command: "usage" });
    try {
      const response = await getApiClient().user.getUsage();
      const vm = toUsageVM(response);

      log.info("Command completed", {
        command: "usage",
        duration_ms: String(Date.now() - startMs),
      });

      if (!vm.subscriptionActive) {
        terminal.warn(t("usage.subscription_inactive"));
      }

      terminal.line(renderUsageBar(vm));
    } catch (error: unknown) {
      handleCommandError(log, error, {
        command: "usage",
        duration_ms: String(Date.now() - startMs),
      });
    }
  });
