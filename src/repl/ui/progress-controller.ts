// Progress bar lifecycle — show/hide/update the progress bar in TUI.
// Extracted from controller.ts to isolate timer + addChild/removeChild logic.

import type { TUI, Component } from "@mariozechner/pi-tui";
import { ProgressBar } from "./components/progress-bar.ts";
import type { ProgressEvent } from "../core/progress-types.ts";

const PROGRESS_DELAY_MS = 200;

export class ProgressController {
  private tui: TUI | null = null;
  private progressBar: ProgressBar | null = null;
  private progressTimer: ReturnType<typeof setTimeout> | null = null;
  private statusBar: Component | null = null;

  /** Bind to TUI instance and the status bar component it replaces during progress. */
  attach(tui: TUI, statusBar: Component): void {
    this.tui = tui;
    this.statusBar = statusBar;
  }

  /** Handle a progress event from ReplService. */
  onProgress(event: ProgressEvent): void {
    if (!this.tui) return;

    if (event.phase === "start") {
      if (!this.progressBar && !this.progressTimer) {
        this.progressTimer = setTimeout(() => {
          this.progressTimer = null;
          this.show();
        }, PROGRESS_DELAY_MS);
      }
      return;
    }

    if (event.phase === "in_progress") {
      this.progressBar?.update(event.percent ?? 0, event.message ?? null);
      return;
    }

    this.hide();
  }

  /** Clean up timer and bar (called from controller.stop). */
  dispose(): void {
    if (this.progressTimer) {
      clearTimeout(this.progressTimer);
      this.progressTimer = null;
    }
    if (this.progressBar && this.tui) {
      this.tui.removeChild(this.progressBar);
      this.progressBar = null;
    }
  }

  private show(): void {
    if (!this.tui || this.progressBar) return;

    if (this.statusBar) this.tui.removeChild(this.statusBar);
    this.progressBar = new ProgressBar(this.tui);
    this.tui.addChild(this.progressBar);
    this.tui.requestRender();
  }

  private hide(): void {
    if (!this.tui) return;

    if (this.progressTimer) {
      clearTimeout(this.progressTimer);
      this.progressTimer = null;
    }

    if (this.progressBar) {
      this.tui.removeChild(this.progressBar);
      this.progressBar = null;
      if (this.statusBar) this.tui.addChild(this.statusBar);
    }

    this.tui.requestRender();
  }
}
