// Settings-overlay sub-controller.
//
// Owns the REPL settings overlay lifecycle (open/close) and the progress-wrapped apply flow,
// so ReplController doesn't carry that responsibility. Input routing queries `isActive` /
// `inputInterceptor` to decide whether keystrokes belong to the overlay.

import { TUI } from "@earendil-works/pi-tui";
import { createSettingsOverlay, type SettingsInputInterceptor } from "../../tui/settings-screen.ts";
import { ProgressController } from "./progress-controller.ts";
import type { ProgressPhase } from "../core/progress-types.ts";
import { runWithProgressContext, type ProgressContext } from "../../runtime/progress-context.ts";
import { terminal } from "../../output/terminal.ts";
import { toErrorMessage } from "../../errors/contracts.ts";

export class SettingsOverlayController {
  private tui: TUI | null = null;
  private progress: ProgressController | null = null;
  private active = false;
  private interceptor: SettingsInputInterceptor | null = null;

  /** Bind to the live TUI + progress controller (call from ReplController.start). */
  attach(tui: TUI, progress: ProgressController): void {
    this.tui = tui;
    this.progress = progress;
  }

  /** Release references on shutdown. */
  detach(): void {
    this.tui = null;
    this.progress = null;
    this.active = false;
    this.interceptor = null;
  }

  /** True while the settings overlay is open (input routing reads this). */
  get isActive(): boolean {
    return this.active;
  }

  /** Active input interceptor while the overlay is open, else null. */
  get inputInterceptor(): SettingsInputInterceptor | null {
    return this.interceptor;
  }

  open(): void {
    if (!this.tui) return;
    this.active = true;
    const { container, focusTarget, inputInterceptor } = createSettingsOverlay(
      () => {
        this.close();
      },
      (applyFn) => {
        this.runApply(applyFn);
      },
      () => {
        this.tui?.requestRender();
      }
    );
    this.interceptor = inputInterceptor;
    this.tui.showOverlay(container, { anchor: "bottom-left", width: "100%" });
    this.tui.setFocus(focusTarget);
    this.tui.requestRender(true);
  }

  close(): void {
    if (!this.tui) return;
    this.tui.hideOverlay();
    this.active = false;
    this.interceptor = null;
    this.tui.requestRender(true);
  }

  private runApply(applyFn: () => Promise<void>): void {
    if (!this.progress) return;
    const progress = this.progress;
    const commandId = crypto.randomUUID();
    const emit = (phase: ProgressPhase, opts?: { percent?: number; message?: string }) => {
      progress.onProgress({ commandId, phase, ...opts, timestamp: Date.now() });
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
}
