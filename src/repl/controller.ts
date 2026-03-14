import chalk from "chalk";
import {
  setClipboardText,
  getClipboardText,
  writeOsc52,
  probeSystemClipboard,
} from "../runtime/clipboard.ts";
import {
  ProcessTerminal,
  TUI,
  getEditorKeybindings,
  setEditorKeybindings,
  EditorKeybindingsManager,
  wrapTextWithAnsi,
  type EditorTheme,
  type SelectListTheme,
} from "@mariozechner/pi-tui";
import { GhostTextEditor } from "./ui/components/ghost-text-editor.ts";
import { getVersion } from "../shared/version.ts";
import { getLatestVersion, isNewerVersion } from "../runtime/update-check.ts";
import { BANNER_LINES, REPL_COLORS } from "./ui/data.ts";
import { getWelcomeRows } from "./registry.ts";
import { StatusBarLine } from "./ui/components/status-bar-line.ts";
import { showStatusHint, setHintExpireCallback } from "./ui/hint-state.ts";
import { t } from "../i18n/index.ts";
import { handleCtrlC } from "./input/keybindings.ts";
import { ReplAutocompleteProvider, isInAtFileContext } from "./input/autocomplete-provider.ts";
import { createInputListener } from "./input/input-handler.ts";
import { HistoryComponent } from "./ui/components/history-component.ts";
import { CurlPanel } from "./ui/components/curl-panel.ts";
import { ProgressController } from "./ui/progress-controller.ts";
import { setCurlPair, clearCurl } from "./ui/curl-store.ts";
import { setCurlOutputFn } from "../api/curl.ts";
import { terminal } from "../output/terminal.ts";
import { toErrorMessage } from "../errors/contracts.ts";
import { outputBridge, type OutputItem } from "./core/output-bridge.ts";
import type { ReplService } from "./service.ts";
import type { ProgressEvent, ProgressPhase } from "./core/progress-types.ts";
import { runWithProgressContext, type ProgressContext } from "../runtime/progress-context.ts";
import { setInvalidateCallback } from "../runtime/ui-invalidate.ts";
import { createSettingsOverlay, type SettingsInputInterceptor } from "../tui/settings-screen.ts";

// System clipboard preferred. OSC 52 only as fallback when system clipboard fails.
// Avoids Windows race condition where OSC 52 locks clipboard before our Win32 API call.
// Returns true if system clipboard succeeded, false if only OSC 52 was sent.
async function writeToClipboard(text: string): Promise<boolean> {
  const ok = await setClipboardText(text);
  if (!ok) writeOsc52(text);
  return ok;
}

const selectListTheme: SelectListTheme = {
  selectedPrefix: (s) => chalk.hex(REPL_COLORS.completionActiveFg)(s),
  selectedText: (s) =>
    chalk.bgHex(REPL_COLORS.completionActiveBg).hex(REPL_COLORS.completionActiveFg)(s),
  description: (s) => chalk.gray(s),
  scrollInfo: (s) => chalk.gray(s),
  noMatch: (s) => chalk.gray(s),
};

const editorTheme: EditorTheme = {
  borderColor: (s) => chalk.hex(REPL_COLORS.statusSep)(s),
  selectList: selectListTheme,
};

function updateHint(): string {
  const latest = getLatestVersion();
  const current = getVersion();
  return latest && isNewerVersion(current, latest) ? chalk.yellow(` (update: ${latest})`) : "";
}

function formatBannerLines(columns: number): string[] {
  const lines: string[] = [];

  if (columns < 60) {
    lines.push(
      chalk.gray(`Prompsit CLI v${getVersion()}`) + updateHint() + chalk.gray(" | type 'help'"),
      ""
    );
    return lines;
  }

  for (const [line, color] of BANNER_LINES) {
    lines.push(chalk.hex(color).bold(line));
  }
  lines.push(chalk.gray("  v" + getVersion()) + updateHint(), "");

  const rows = getWelcomeRows();

  // Content-aware: col1/col2 fit their content exactly, col3 gets remainder
  const col1 = Math.max(...rows.map(([cmd]) => cmd.length));
  const col2 = Math.max(...rows.map(([, desc]) => desc.length));

  const col3Start = 2 + col1 + 1 + col2 + 1;
  const col3Width = Math.max(20, columns - col3Start);

  for (const [cmd, desc, example] of rows) {
    const mainPart = "  " + chalk.cyan(cmd.padEnd(col1)) + " " + desc.padEnd(col2) + " ";
    const wrappedExample = wrapTextWithAnsi(chalk.gray(example), col3Width);

    lines.push(mainPart + wrappedExample[0]);
    const padding = " ".repeat(col3Start);
    for (let i = 1; i < wrappedExample.length; i++) {
      lines.push(padding + wrappedExample[i]);
    }
  }
  lines.push("");

  return lines;
}

export class ReplController {
  private readonly service: ReplService;

  private terminal: ProcessTerminal | null = null;
  private tui: TUI | null = null;
  private editor: GhostTextEditor | null = null;

  private readonly statusBar = new StatusBarLine();
  private readonly curlPanel = new CurlPanel();
  private historyComponent: HistoryComponent | null = null;

  private readonly progress = new ProgressController();
  private removeInputListener: (() => void) | null = null;
  private resizeListener: (() => void) | null = null;
  private exitResolve: (() => void) | null = null;
  private previousEditorKeybindings: EditorKeybindingsManager | null = null;
  private stopped = false;

  private isRunning = false;
  private isContinuation = false;
  private isInSettingsMode = false;
  private settingsInterceptor: SettingsInputInterceptor | null = null;

  private readonly boundOnOutputBatch: (items: OutputItem[]) => void;
  private readonly boundOnStateChange: (state: { isRunning: boolean }) => void;
  private readonly boundOnClear: () => void;
  private readonly boundOnExit: () => void;
  private readonly boundOnProgress: (event: ProgressEvent) => void;
  private readonly boundOnError: (error: Error) => void;

  constructor(service: ReplService) {
    this.service = service;

    this.boundOnOutputBatch = (items) => {
      this.onOutputBatch(items);
    };
    this.boundOnStateChange = (state) => {
      this.onStateChange(state);
    };
    this.boundOnClear = () => {
      this.onClear();
    };
    this.boundOnExit = () => {
      this.onExit();
    };
    this.boundOnProgress = (event) => {
      this.onProgress(event);
    };
    this.boundOnError = (error) => {
      terminal.error("REPL_SERVICE", toErrorMessage(error));
    };
  }

  async start(): Promise<void> {
    this.stopped = false;

    this.terminal = new ProcessTerminal();

    // Strip \x1b[3J (clear scrollback) from TUI render output.
    // pi-tui sends it during fullRender(true) assuming no alt screen,
    // but our REPL uses alt screen — and Terminal.app leaks the sequence
    // to the main buffer, destroying pre-REPL scrollback.
    const origTermWrite = this.terminal.write.bind(this.terminal);
    this.terminal.write = (data: string) => {
      origTermWrite(data.replaceAll("\u001B[3J", ""));
    };

    this.tui = new TUI(this.terminal);
    this.historyComponent = new HistoryComponent(
      () => this.computeHistoryMaxLines(),
      formatBannerLines
    );

    this.previousEditorKeybindings = getEditorKeybindings();
    setEditorKeybindings(new EditorKeybindingsManager({ copy: "ctrl+shift+c" }));

    // eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment -- needed for InputContext getters
    const self = this;
    this.removeInputListener = this.tui.addInputListener(
      createInputListener({
        get isInSettingsMode() {
          return self.isInSettingsMode;
        },
        get editor() {
          return self.editor;
        },
        get historyComponent() {
          return self.historyComponent;
        },
        get settingsInterceptor() {
          return self.settingsInterceptor;
        },
        computeHistoryMaxLines: () => this.computeHistoryMaxLines(),
        requestRender: () => {
          this.tui?.requestRender();
        },
        writeToClipboard,
        pasteFromClipboard: () => {
          void getClipboardText()
            .then((raw) => {
              if (raw === null) {
                showStatusHint(t("repl.clipboard.paste_unavailable"));
                this.tui?.requestRender();
                return;
              }
              const clip = raw.trim();
              if (clip) {
                this.editor?.insertTextAtCursor(clip);
                this.tui?.requestRender();
              }
            })
            .catch(() => {});
        },
        closeSettings: () => {
          this.closeSettings();
        },
        onCtrlC: () => {
          this.handleCtrlC();
        },
        onEsc: () => {
          this.handleEsc();
        },
      })
    );

    this.editor = new GhostTextEditor(this.tui, editorTheme);
    this.editor.setAutocompleteProvider(new ReplAutocompleteProvider());
    this.editor.onSubmit = (text) => {
      void this.handleSubmit(text);
    };
    this.editor.onChange = (_text: string) => {
      if (this.isRunning || !this.editor) return;
      if (this.editor.isShowingAutocomplete()) return;
      const lines = this.editor.getLines();
      const firstLine = lines[0] ?? "";
      if (lines.length !== 1) return;
      // Auto-trigger for first word (command name): single line, no spaces
      if (firstLine.length > 0 && !firstLine.includes(" ")) {
        this.editor.triggerAutocomplete();
      }
      // Auto-trigger for @"file" completion: unclosed @"... before cursor
      if (isInAtFileContext(firstLine, this.editor.getCursor().col)) {
        this.editor.triggerAutocomplete();
      }
    };

    this.tui.addChild(this.historyComponent);
    this.tui.addChild(this.curlPanel);
    this.tui.addChild(this.editor);
    this.tui.addChild(this.statusBar);
    this.progress.attach(this.tui, this.statusBar);

    const entries = this.service.commandHistory.getEntries(100);
    for (const entry of entries) {
      this.editor.addToHistory(entry);
    }

    this.tui.setFocus(this.editor);

    // Wire hint expiry → auto re-render (clears status bar toast after timeout)
    setHintExpireCallback(() => {
      this.tui?.requestRender();
    });

    // Wire async background state changes (update check, i18n) → re-render
    setInvalidateCallback(() => {
      this.tui?.requestRender();
    });

    // Wire curl output to curl panel (curl-store) for F8 copy
    setCurlOutputFn((sanitized, raw) => {
      setCurlPair(sanitized, raw);
      this.tui?.requestRender();
    });

    this.wireServiceEvents();
    process.stdout.write("\u001B[?1049h\u001B[2J\u001B[H"); // Enter alternate screen, clear + home cursor
    this.tui.start();
    process.stdout.write("\u001B[?1002h\u001B[?1006h"); // Enable SGR mouse inside alt screen (after tui.start)

    // One-time clipboard availability check (fire-and-forget)
    void probeSystemClipboard().then((result) => {
      if (!result.available) {
        const key =
          result.reason === "no-display"
            ? "repl.clipboard.no_display_warning"
            : "repl.clipboard.no_tools_warning";
        showStatusHint(t(key), 5000);
        this.tui?.requestRender();
      }
    });

    const onResize = () => {
      this.tui?.requestRender(true);
    };
    process.stdout.on("resize", onResize);
    this.resizeListener = onResize;

    return new Promise<void>((resolve) => {
      this.exitResolve = resolve;
    });
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    setCurlOutputFn(null);
    setInvalidateCallback(null);
    clearCurl();

    this.service.off("outputBatch", this.boundOnOutputBatch);
    this.service.off("stateChange", this.boundOnStateChange);
    this.service.off("clear", this.boundOnClear);
    this.service.off("exit", this.boundOnExit);
    this.service.off("progress", this.boundOnProgress);
    this.service.off("error", this.boundOnError);

    this.removeInputListener?.();
    this.removeInputListener = null;

    if (this.resizeListener) {
      process.stdout.off("resize", this.resizeListener);
      this.resizeListener = null;
    }

    this.progress.dispose();

    if (this.previousEditorKeybindings) {
      setEditorKeybindings(this.previousEditorKeybindings);
      this.previousEditorKeybindings = null;
    }

    this.tui?.stop();
    process.stdout.write("\u001B[?1006l\u001B[?1002l"); // Disable SGR mouse (LIFO: enabled last inside alt screen)
    process.stdout.write("\u001B[?1049l"); // Leave alternate screen

    const resolve = this.exitResolve;
    this.exitResolve = null;
    resolve?.();
  }

  private wireServiceEvents(): void {
    this.service.on("outputBatch", this.boundOnOutputBatch);
    this.service.on("stateChange", this.boundOnStateChange);
    this.service.on("clear", this.boundOnClear);
    this.service.on("exit", this.boundOnExit);
    this.service.on("progress", this.boundOnProgress);
    this.service.on("error", this.boundOnError);
  }

  private handleCtrlC(): void {
    if (!this.editor || !this.tui) return;

    if (this.isRunning) {
      this.service.abort();
      return;
    }

    if (this.isContinuation) {
      this.service.discardBuffer();
      this.service.commandHistory.reset();
      this.editor.setText("");
      this.isContinuation = false;
      this.updatePromptBorder();
      this.tui.requestRender();
      return;
    }

    const action = handleCtrlC();
    if (action === "exit") {
      this.stop();
      return;
    }

    this.service.commandHistory.reset();
    this.editor.setText("");
    this.tui.requestRender();
    setTimeout(() => {
      this.tui?.requestRender();
    }, 3000).unref();
  }

  private handleEsc(): void {
    if (!this.editor || !this.tui) return;

    if (this.isRunning) {
      this.service.abort();
      return;
    }

    if (this.isContinuation) {
      this.service.discardBuffer();
      this.service.commandHistory.reset();
      this.editor.setText("");
      this.isContinuation = false;
      this.updatePromptBorder();
      this.tui.requestRender();
      return;
    }

    this.service.commandHistory.reset();
    this.editor.setText("");
    this.tui.requestRender();
  }

  private async handleSubmit(text: string): Promise<void> {
    if (!this.editor || !this.tui) return;

    try {
      const result = await this.service.submit(text);

      if (result.kind === "await_more_input" && result.reason === "unclosed_quote") {
        this.service.discardBuffer();
        this.isContinuation = false;
        this.updatePromptBorder();
        this.editor.setText(text);
        showStatusHint(t("repl.unclosed_quote_hint"));
        this.tui.requestRender();
        return;
      }

      this.isContinuation = result.kind === "await_more_input";
      this.updatePromptBorder();

      if (result.kind === "await_more_input") {
        outputBridge.write({
          kind: "system",
          timestamp: Date.now(),
          stream: "stderr",
          text: chalk.yellow("... Continue typing or Ctrl+C to cancel."),
        });
      }

      if (result.kind === "settings") {
        this.openSettings();
        return;
      }

      if (result.kind === "executed") {
        const latest = this.service.commandHistory.getEntries(1)[0];
        if (latest) {
          this.editor.addToHistory(latest);
        }
      }

      this.tui.requestRender();
    } catch (error) {
      terminal.error("SUBMIT", toErrorMessage(error));
    }
  }

  private onOutputBatch(_items: OutputItem[]): void {
    if (!this.tui) return;

    try {
      this.historyComponent?.clearSelection(); // stale selection on new content
      this.historyComponent?.resetScroll(); // scroll to bottom on new output
      this.tui.requestRender(); // differential — HistoryComponent.render() reads outputBridge lazily
    } catch (error) {
      terminal.error("RENDER", toErrorMessage(error));
    }
  }

  private onStateChange(state: { isRunning: boolean }): void {
    this.isRunning = state.isRunning;

    if (this.editor) {
      this.editor.disabled = state.isRunning;
    }

    if (state.isRunning) {
      this.tui?.requestRender();
    } else {
      this.tui?.requestRender(true); // reset maxLinesRendered drift after command completes
    }
  }

  private onClear(): void {
    if (!this.tui) return;
    clearCurl();
    // outputBridge.clear() ran before this event → getHistory() = []
    // HistoryComponent.render() returns [] on next pass
    this.historyComponent?.clearSelection();
    this.tui.requestRender(true); // intentional full clear for `clear` command
  }

  private onExit(): void {
    this.stop();
  }

  private onProgress(event: ProgressEvent): void {
    this.progress.onProgress(event);
  }

  private computeHistoryMaxLines(): number {
    if (!this.terminal || !this.editor) return 0;
    const rows = this.terminal.rows;
    const w = this.terminal.columns;

    // Use actual rendered height (includes borders, word-wrap, autocomplete dropdown)
    const editorH = this.editor.render(w).length;
    const curlPanelH = this.curlPanel.render(w).length;
    const statusOrLoaderH = 1;
    return Math.max(0, rows - editorH - curlPanelH - statusOrLoaderH - 1); // -1 breathing room
  }

  private updatePromptBorder(): void {
    if (!this.editor) return;

    this.editor.borderColor = this.isContinuation
      ? (s: string) => chalk.hex(REPL_COLORS.statusLabel)(s) // #888888 — multiline indicator
      : (s: string) => chalk.hex(REPL_COLORS.statusSep)(s); // #555555 — normal
  }

  private openSettings(): void {
    if (!this.tui) return;
    this.isInSettingsMode = true;
    const { container, focusTarget, inputInterceptor } = createSettingsOverlay(
      () => {
        this.closeSettings();
      },
      (applyFn) => {
        this.runSettingsApply(applyFn);
      },
      () => {
        this.tui?.requestRender();
      }
    );
    this.settingsInterceptor = inputInterceptor;
    this.tui.showOverlay(container, {
      anchor: "bottom-left",
      width: "100%",
    });
    this.tui.setFocus(focusTarget);
    this.tui.requestRender(true);
  }

  private runSettingsApply(applyFn: () => Promise<void>): void {
    const commandId = crypto.randomUUID();
    const emit = (phase: ProgressPhase, opts?: { percent?: number; message?: string }) => {
      this.progress.onProgress({ commandId, phase, ...opts, timestamp: Date.now() });
    };
    const ctx: ProgressContext = {
      commandId,
      emit: (phase, opts) => {
        emit(phase, opts);
      },
    };
    runWithProgressContext(ctx, applyFn).catch((error: unknown) => {
      terminal.warn(toErrorMessage(error));
      emit("failed");
    });
  }

  private closeSettings(): void {
    if (!this.tui) return;
    this.tui.hideOverlay();
    this.isInSettingsMode = false;
    this.settingsInterceptor = null;
    this.tui.requestRender(true);
  }
}
