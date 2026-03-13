import { Command } from "@commander-js/extra-typings";
import { clearTokens, deleteConfigFile, reloadSettings } from "../../config/index.ts";
import { resetApiClient } from "../../api/client.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { t } from "../../i18n/index.ts";
import { terminal } from "../../output/index.ts";
import { failCommand } from "../error-handler.ts";
import { promptConfirm } from "../../cli/prompts.ts";

export function registerConfigReset(configCommand: Command): void {
  configCommand
    .command("reset")
    .description("Clear configuration file and credentials")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (opts) => {
      if (!opts.force && !process.stdin.isTTY) {
        failCommand(ErrorCode.CONFIG_INTERACTIVE, "Use --force for non-interactive environments.");
        return;
      }

      if (!opts.force) {
        const confirmed = await promptConfirm(t("config.reset.confirm_full"));
        if (!confirmed) {
          terminal.info(t("config.reset.cancelled"));
          return;
        }
      }

      deleteConfigFile();
      clearTokens();
      resetApiClient();
      reloadSettings();

      terminal.success(t("config.reset.done"));
    });
}
