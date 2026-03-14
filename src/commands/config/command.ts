import { Command } from "@commander-js/extra-typings";
import {
  getConfigValue,
  getSettings,
  setConfigValue,
  writeConfigToml,
} from "../../config/index.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { toErrorMessage } from "../../errors/contracts.ts";
import { t } from "../../i18n/index.ts";
import { terminal } from "../../output/index.ts";
import { runSettingsScreen } from "../../tui/settings-screen.ts";
import { failCommand } from "../error-handler.ts";
import { registerConfigApiUrl } from "./api-url.ts";
import { registerConfigLanguage } from "./language.ts";
import { registerConfigPath } from "./path.ts";
import { registerConfigReset } from "./reset.ts";
import { registerConfigShow } from "./show.ts";
import { applyApiUrlChangeAndNotify, ensureValidConfigKey } from "./shared.ts";

export const configCommand = new Command("config")
  .description("View and manage CLI configuration")
  .helpCommand(false)
  .action(async () => {
    if (process.stdin.isTTY && !process.stdin.isRaw) {
      await runSettingsScreen();
      return;
    }
    const showSubcommand = configCommand.commands.find((c) => c.name() === "show");
    if (showSubcommand) {
      showSubcommand.parse([], { from: "user" });
    }
  });

// Default subcommand: config <key> [value] — get or set config values
configCommand
  .command("kv", { isDefault: true, hidden: true })
  .argument("<key>", "Configuration key (e.g. api-base-url)")
  .argument("[value]", "New value to set")
  .action((key, value) => {
    if (!ensureValidConfigKey(key)) return;

    if (value === undefined) {
      // GET: print current value
      terminal.line(String(getConfigValue(key)));
    } else {
      // SET: write + side effects
      try {
        setConfigValue(key, value);
      } catch (error: unknown) {
        failCommand(ErrorCode.CONFIG_WRITE, toErrorMessage(error));
        return;
      }
      writeConfigToml(getSettings());
      if (key === "api-base-url") {
        applyApiUrlChangeAndNotify();
      }
      terminal.success(t("config.set_success", { name: key, value }));
    }
  });

registerConfigShow(configCommand);
registerConfigReset(configCommand);
registerConfigPath(configCommand);
registerConfigApiUrl(configCommand);
registerConfigLanguage(configCommand);
