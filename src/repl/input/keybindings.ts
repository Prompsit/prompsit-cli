// See API-501: REPL keybinding handlers.
//
// Shared snippet-style keybinding helpers used by the REPL input layer.

import { recordInterrupt, getLastInterruptTime } from "../ui/ctrl-c-state.ts";
import { showStatusHint } from "../ui/hint-state.ts";
import { t } from "../../i18n/index.ts";

const DOUBLE_CTRL_C_THRESHOLD_MS = 3000;

/**
 * Handle Ctrl+C keypress.
 * Returns "clear" to clear input, "exit" to exit REPL.
 */
export function handleCtrlC(): "clear" | "exit" {
  const now = Date.now();
  const last = getLastInterruptTime();

  if (now - last < DOUBLE_CTRL_C_THRESHOLD_MS) {
    return "exit";
  }

  recordInterrupt();
  showStatusHint(t("repl.ctrl_c_hint"), 3000);
  return "clear";
}
