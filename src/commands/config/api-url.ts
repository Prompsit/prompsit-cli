import { Command } from "@commander-js/extra-typings";
import {
  API_URL_PRESETS,
  getConfigValue,
  getSettings,
  setConfigValue,
  writeConfigToml,
} from "../../config/index.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { t } from "../../i18n/index.ts";
import { terminal } from "../../output/index.ts";
import { failCommand } from "../error-handler.ts";
import { applyApiUrlChangeAndNotify, isApiPreset } from "./shared.ts";

export function registerConfigApiUrl(configCommand: Command): void {
  configCommand
    .command("api-url")
    .description("Show or switch the API URL (presets: test, local, or custom URL)")
    .argument("[preset]", "Preset name (test, local) or custom URL")
    .action((preset) => {
      const currentUrl = getConfigValue("api-base-url") as string;

      if (!preset) {
        terminal.info(t("config.api_url.current", { url: currentUrl }));
        terminal.info(t("config.api_url.presets"));
        for (const [name, url] of Object.entries(API_URL_PRESETS)) {
          const marker = url === currentUrl ? ` ${t("config.api_url.active")}` : "";
          terminal.info(`  ${name}: ${url}${marker}`);
        }
        return;
      }

      let resolvedUrl: string;

      if (isApiPreset(preset)) {
        resolvedUrl = API_URL_PRESETS[preset];
      } else {
        try {
          const parsed = new URL(preset);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            failCommand(
              ErrorCode.CONFIG_TOML_PARSE,
              t("config.api_url.invalid_scheme", { scheme: parsed.protocol.replace(":", "") })
            );
            return;
          }
          resolvedUrl = preset;
        } catch {
          failCommand(
            ErrorCode.CONFIG_TOML_WRITE,
            t("config.api_url.unknown_preset", {
              name: preset,
              list: Object.keys(API_URL_PRESETS).join(", "),
            })
          );
          return;
        }
      }

      setConfigValue("api-base-url", resolvedUrl);
      writeConfigToml(getSettings());
      applyApiUrlChangeAndNotify(resolvedUrl);
    });
}
