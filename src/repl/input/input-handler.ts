// TUI input listener — handles raw key/mouse events for the REPL.
// Extracted from controller.ts to keep the controller focused on lifecycle/wiring.

import { Key, matchesKey } from "@mariozechner/pi-tui";
import { showStatusHint } from "../ui/hint-state.ts";
import { isCurlEnabled } from "../../api/curl.ts";
import { getRawCurl } from "../ui/curl-store.ts";
import { t } from "../../i18n/index.ts";

/** Minimal contract the input handler needs from the controller. */
export interface InputContext {
  readonly isInSettingsMode: boolean;
  readonly editor: {
    isShowingAutocomplete(): boolean;
    insertTextAtCursor(text: string): void;
  } | null;
  historyComponent: {
    scroll(delta: number): void;
    clearSelection(): void;
    startSelection(row: number, col: number): void;
    extendSelection(row: number, col: number): void;
    endSelection(row: number, col: number): void;
    getSelectedText(): string;
  } | null;
  settingsInterceptor: ((data: string) => { consume: boolean } | undefined) | null;
  computeHistoryMaxLines(): number;
  requestRender(): void;
  writeToClipboard(text: string): Promise<boolean>;
  pasteFromClipboard(): void;
  closeSettings(): void;
  onCtrlC(): void;
  onEsc(): void;
}

/**
 * Build the input listener callback for pi-tui's `addInputListener`.
 * Returns a function compatible with `TUI.addInputListener()`.
 */
export function createInputListener(
  ctx: InputContext
): (data: string) => { consume: boolean } | undefined {
  return (data: string) => {
    // --- Settings overlay ---
    if (ctx.isInSettingsMode) {
      if (data === "q" || matchesKey(data, Key.ctrl("c"))) {
        ctx.closeSettings();
        return { consume: true };
      }
      const intercepted = ctx.settingsInterceptor?.(data);
      if (intercepted?.consume) {
        ctx.requestRender(); // cycleValue mutates piItems but pi-tui won't re-render consumed input
        return intercepted;
      }
      return; // Let SettingsList handle Up/Down/Space/Esc
    }

    // --- SGR mouse (ESC[<Btn;X;Y M|m) ---
    if (data.startsWith("\u001B[<")) {
      handleSgrMouse(data, ctx);
      return { consume: true };
    }

    // --- F8: copy raw curl to clipboard ---
    if (matchesKey(data, Key.f8)) {
      const raw = isCurlEnabled() ? getRawCurl() : null;
      if (raw) {
        void ctx.writeToClipboard(raw.replaceAll("\n", " \\\n")).then((ok) => {
          showStatusHint(ok ? t("repl.curl_panel.copied") : t("repl.clipboard.sent_osc52"));
          ctx.requestRender();
        });
      }
      return { consume: true };
    }

    // --- Ctrl+C: copy selection or interrupt ---
    if (matchesKey(data, Key.ctrl("c"))) {
      const selected = ctx.historyComponent?.getSelectedText() ?? "";
      if (selected) {
        ctx.historyComponent?.clearSelection();
        void ctx.writeToClipboard(selected).then((ok) => {
          showStatusHint(ok ? t("repl.curl_panel.copied") : t("repl.clipboard.sent_osc52"));
          ctx.requestRender();
        });
      } else {
        ctx.onCtrlC();
      }
      return { consume: true };
    }

    // --- Esc ---
    if (matchesKey(data, Key.escape)) {
      if (ctx.editor?.isShowingAutocomplete()) {
        return; // Let pi-tui close the dropdown
      }
      ctx.onEsc();
      return { consume: true };
    }

    // --- Ctrl+V: paste from system clipboard ---
    if (matchesKey(data, Key.ctrl("v"))) {
      ctx.pasteFromClipboard();
      return { consume: true };
    }

    return;
  };
}

// ── SGR mouse handling ──────────────────────────────────────────────

function handleSgrMouse(data: string, ctx: InputContext): void {
  const sgrMouse = /^(\d+);(\d+);(\d+)([Mm])$/u.exec(data.slice(3));
  if (!sgrMouse) return;

  const [, btnRaw, xRaw, yRaw, action] = sgrMouse;
  const btn = Number.parseInt(btnRaw, 10);
  const x = Number.parseInt(xRaw, 10) - 1;
  const y = Number.parseInt(yRaw, 10) - 1;
  const isPress = action === "M";
  const inHistory = y < ctx.computeHistoryMaxLines();

  if (btn === 64) {
    // scroll up
    ctx.historyComponent?.scroll(3);
  } else if (btn === 65) {
    // scroll down
    ctx.historyComponent?.scroll(-3);
  } else if (btn === 0 && isPress && inHistory) {
    // left press in history
    ctx.historyComponent?.clearSelection();
    ctx.historyComponent?.startSelection(y, x);
  } else if (btn === 32 && inHistory) {
    // drag in history
    ctx.historyComponent?.extendSelection(y, x);
  } else if (btn === 0 && !isPress) {
    // left release
    ctx.historyComponent?.endSelection(y, x);
  } else if (btn === 2 && isPress) {
    // right click → copy / paste
    const text = ctx.historyComponent?.getSelectedText() ?? "";
    if (text) {
      ctx.historyComponent?.clearSelection();
      void ctx.writeToClipboard(text).then((ok) => {
        showStatusHint(ok ? t("repl.curl_panel.copied") : t("repl.clipboard.sent_osc52"));
        ctx.requestRender();
      });
    } else {
      ctx.pasteFromClipboard();
    }
  } else if (!inHistory) {
    // click outside history → clear
    ctx.historyComponent?.clearSelection();
  }

  ctx.requestRender();
}
