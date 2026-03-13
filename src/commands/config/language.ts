import { Command } from "@commander-js/extra-typings";
import {
  isAuthenticated,
  getSettings,
  setConfigValue,
  writeConfigToml,
} from "../../config/index.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { t, currentLang, setTranslations } from "../../i18n/index.ts";
import { translateCatalog } from "../../i18n/translator.ts";
import { createTranslator } from "../../api/translator-adapter.ts";
import { getLogger } from "../../logging/index.ts";
import { terminal } from "../../output/index.ts";
import { createProgressSink } from "../../output/progress-display.ts";
import { failCommand, handleCommandError } from "../error-handler.ts";
import { fmtCmd } from "../../runtime/execution-mode.ts";

const log = getLogger(import.meta.url);

export function registerConfigLanguage(configCommand: Command): void {
  configCommand
    .command("language")
    .description("Show or switch CLI interface language (translates all UI strings via API)")
    .argument("[code]", "Language code (e.g., es, fr, de) or 'en' to reset")
    .action(async (code) => {
      if (!code) {
        const lang = currentLang();
        terminal.info(t("config.language.current", { lang }));
        if (lang === "en") {
          terminal.dim(t("config.language.hint", { cmd: fmtCmd("config language <code>") }));
        }
        return;
      }

      if (code === "en") {
        setConfigValue("language", "en");
        writeConfigToml(getSettings());
        setTranslations({}, "en");
        terminal.success(t("config.language.reset_success"));
        return;
      }

      if (!isAuthenticated()) {
        failCommand(
          ErrorCode.CONFIG_LOGIN_REQUIRED,
          t("config.language.login_required", { cmd: fmtCmd("login") })
        );
        return;
      }

      const startMs = Date.now();
      log.info("Command started", { command: "config language", language: code });

      try {
        const translator = createTranslator();

        const result = await translateCatalog(
          translator,
          code,
          50,
          createProgressSink(`Translating CLI to ${code}...`)
        );

        const total = Object.keys(result.translations).length;
        if (total === 0) {
          failCommand(
            ErrorCode.CONFIG_TRANSLATE,
            t("config.language.translate_failed", { lang: code })
          );
          return;
        }

        if (result.fromCache) {
          terminal.success(t("config.language.loaded_cache", { count: total, lang: code }));
        }

        setTranslations(result.translations, code);
        const settings = getSettings();
        setConfigValue("language", code);
        writeConfigToml(settings);

        const catalogSize = 300;
        if (!result.fromCache && total < catalogSize * 0.9) {
          terminal.warn(t("config.language.partial", { count: total }));
        }

        log.info("Command completed", {
          command: "config language",
          language: code,
          duration_ms: String(Date.now() - startMs),
        });
      } catch (error: unknown) {
        handleCommandError(log, error, {
          command: "config language",
          duration_ms: String(Date.now() - startMs),
        });
      }
    });
}
