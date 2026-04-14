// Browser-link commands: contact, feedback.

import { Command } from "@commander-js/extra-typings";
import { getSettings } from "../config/settings.ts";
import { openBrowser } from "../runtime/browser.ts";
import { terminal } from "../output/index.ts";
import { t } from "../i18n/index.ts";
import { getLogger } from "../logging/index.ts";
import { handleCommandError } from "./error-handler.ts";

const log = getLogger(import.meta.url);

export const contactCommand = new Command("contact")
  .description("Open the Prompsit contact page")
  .action(async () => {
    const startMs = Date.now();
    log.info("Command started", { command: "contact" });
    try {
      const url = getSettings().cli.contact_url;
      terminal.dim(t("links.opening", { url }));
      const opened = await openBrowser(url);
      if (!opened) {
        terminal.warn(t("links.failed", { url }));
      }
      log.info("Command completed", {
        command: "contact",
        duration_ms: String(Date.now() - startMs),
      });
    } catch (error: unknown) {
      handleCommandError(log, error, {
        command: "contact",
        duration_ms: String(Date.now() - startMs),
      });
    }
  });

export const feedbackCommand = new Command("feedback")
  .description("Open the GitHub issues page")
  .action(async () => {
    const startMs = Date.now();
    log.info("Command started", { command: "feedback" });
    try {
      const url = getSettings().cli.feedback_url;
      terminal.dim(t("links.opening", { url }));
      const opened = await openBrowser(url);
      if (!opened) {
        terminal.warn(t("links.failed", { url }));
      }
      log.info("Command completed", {
        command: "feedback",
        duration_ms: String(Date.now() - startMs),
      });
    } catch (error: unknown) {
      handleCommandError(log, error, {
        command: "feedback",
        duration_ms: String(Date.now() - startMs),
      });
    }
  });
