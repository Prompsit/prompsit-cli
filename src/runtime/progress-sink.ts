/**
 * Unified progress display contract (Strategy pattern).
 *
 * Two implementations: OraSink (CLI terminal) and ReplSink (pi-tui ProgressBar).
 * Factory `createProgressSink()` auto-detects mode via AsyncLocalStorage context.
 * See src/output/progress-display.ts for implementations.
 */

export interface ProgressSink {
  /** Update progress percentage and optional step/message text. */
  update(percent: number, message?: string): void;
  /** Mark as successfully completed. CLI: shows checkmark line. REPL: no-op. */
  succeed(message?: string): void;
  /** Mark as completed with warning. CLI: shows warning line. REPL: no-op. */
  warn(message?: string): void;
  /** Mark as failed. CLI: shows error line. REPL: no-op. */
  fail(message?: string): void;
  /** Silent cleanup without visual feedback (for errors/cancellation). */
  stop(): void;
}

/** No-op sink for silent/background operations. */
export const NULL_SINK: ProgressSink = {
  update() {},
  succeed() {},
  warn() {},
  fail() {},
  stop() {},
};
