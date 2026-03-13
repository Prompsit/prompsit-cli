/**
 * Centralized progress display factory (Strategy pattern).
 *
 * createProgressSink(label) auto-detects CLI vs REPL via AsyncLocalStorage:
 * - CLI mode:  OraSink  — ora spinner with text-mode progress bar
 * - REPL mode: ReplSink — emits to ProgressContext → pi-tui ProgressBar
 *
 * Callers never touch ora or ProgressContext directly.
 */

import ora, { type Ora } from "ora";
import type { ProgressSink } from "../runtime/progress-sink.ts";
import { getProgressContext, type ProgressContext } from "../runtime/progress-context.ts";

// ---------------------------------------------------------------------------
// Shared utility
// ---------------------------------------------------------------------------

/** Render a text-mode progress bar for CLI spinner display. */
export function renderCliBar(percent: number, width = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `${"\u2588".repeat(filled)}${"\u2591".repeat(empty)} ${String(percent)}%`;
}

// ---------------------------------------------------------------------------
// OraSink — CLI terminal (ora spinner)
// ---------------------------------------------------------------------------

function createOraSink(label: string): ProgressSink {
  const spinner: Ora = ora(label).start();

  return {
    update(pct, msg) {
      spinner.text = `${msg ?? label}  ${renderCliBar(pct)}`;
    },
    succeed(msg) {
      spinner.succeed(msg ?? "Complete");
    },
    warn(msg) {
      spinner.warn(msg);
    },
    fail(msg) {
      spinner.fail(msg);
    },
    stop() {
      if (spinner.isSpinning) spinner.stop();
    },
  };
}

// ---------------------------------------------------------------------------
// ReplSink — REPL pi-tui ProgressBar (via ProgressContext)
// ---------------------------------------------------------------------------

function createReplSink(ctx: ProgressContext): ProgressSink {
  return {
    update(pct, msg) {
      ctx.emit("in_progress", { percent: pct, message: msg });
    },
    succeed() {},
    warn() {},
    fail() {},
    stop() {},
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a progress sink that auto-detects the display mode.
 *
 * - Inside REPL (ProgressContext in AsyncLocalStorage): returns ReplSink
 * - Outside REPL (no context): returns OraSink with the given label
 */
export function createProgressSink(label: string): ProgressSink {
  const ctx = getProgressContext();
  return ctx ? createReplSink(ctx) : createOraSink(label);
}
