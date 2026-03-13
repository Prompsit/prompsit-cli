// Main REPL loop.
//
// Terminal wiring (Ports & Adapters):
// - setTerminal(ReplTerminal) routes all output through outputBridge → TUI viewport
// - clearTerminal() restores CliTerminal on REPL shutdown

import { ReplController } from "./controller.ts";
import { ReplService } from "./service.ts";
import { ensureExamples } from "./examples.ts";
import { outputBridge } from "./core/output-bridge.ts";
import { setTerminal, clearTerminal, ReplTerminal } from "../output/terminal.ts";
import { silenceConsole } from "../logging/setup.ts";
import { getSettings } from "../config/settings.ts";
import { isAuthenticated } from "../config/credentials.ts";
import { setCurlEnabled } from "../api/curl.ts";
import { getLogger } from "../logging/index.ts";
import { currentLang, needsRefresh, clearRefreshFlag, setTranslations } from "../i18n/index.ts";
import { translateCatalog } from "../i18n/translator.ts";
import { createTranslator } from "../api/translator-adapter.ts";
import { NULL_SINK } from "../runtime/progress-sink.ts";
import { warmFormatExtensions } from "../runtime/format-extensions.ts";
import { warmUpdateCheck } from "../runtime/update-check.ts";
import { enterReplMode } from "../runtime/execution-mode.ts";

const log = getLogger(import.meta.url);

/** Run the interactive REPL mode. */
export async function runRepl(): Promise<void> {
  enterReplMode();
  const service = new ReplService();
  let controller: ReplController | null = null;
  const settings = getSettings();
  outputBridge.enable();
  silenceConsole();

  try {
    // Wire terminal → outputBridge → batched → TUI viewport (Ports & Adapters)
    setTerminal(new ReplTerminal(outputBridge));
    setCurlEnabled(settings.cli.show_curl);

    // Background refresh of stale translation cache (best-effort, silent)
    if (needsRefresh() && isAuthenticated()) {
      const lang = currentLang();
      translateCatalog(createTranslator(), lang, settings.cli.batch_size, NULL_SINK)
        .then((result) => {
          if (Object.keys(result.translations).length > 0) {
            setTranslations(result.translations, lang);
            clearRefreshFlag();
          }
        })
        .catch((error: unknown) => {
          log.warn("i18n background refresh failed", { error: String(error) });
        });
    }

    // Background warm format extensions cache for file autocomplete (no auth needed)
    warmFormatExtensions().catch((error: unknown) => {
      log.warn("format extensions warm failed", { error: String(error) });
    });

    // Background check for CLI updates on npm (best-effort, silent)
    warmUpdateCheck().catch((error: unknown) => {
      log.debug("update check warm failed", { error: String(error) });
    });

    // Deploy bundled example files to ~/.prompsit/examples/ on first run
    try {
      ensureExamples();
    } catch {
      /* Non-critical */
    }

    controller = new ReplController(service);
    await controller.start();
  } finally {
    controller?.stop();
    clearTerminal();
    outputBridge.disable();
    service.dispose();
  }
}
