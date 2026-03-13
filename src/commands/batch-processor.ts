// Generic multi-file batch processor extracted from translateMultipleFiles().
// Provides ProgressSink + poolMap + error isolation for all file-accepting commands.

import { poolMap } from "../runtime/async-utils.ts";
import { createProgressSink } from "../output/progress-display.ts";
import { CancelledError } from "../errors/contracts.ts";
import { handleCommandError } from "./error-handler.ts";
import { terminal } from "../output/index.ts";
import { getLogger } from "../logging/index.ts";
import { getSettings } from "../config/index.ts";

const log = getLogger(import.meta.url);

export interface BatchOptions<T, R> {
  /** Items to process (file paths or file pairs). */
  items: T[];
  /** Human-readable label per item for error reporting. */
  label: (item: T) => string;
  /**
   * Per-item async work.
   * Call onProgress(0-100) for spinner updates.
   * For sync operations (no trackJob), progress auto-sets to 100 on resolve.
   */
  process: (item: T, index: number, onProgress: (pct: number) => void) => Promise<R>;
  /** Format success message for terminal output. */
  formatSuccess: (result: R) => string;
  /** Command name for error context metadata. */
  command: string;
  /** Abort signal for Ctrl+C cancellation. */
  signal?: AbortSignal;
}

export interface BatchResult<R> {
  /** Number of successfully processed items. */
  successCount: number;
  /** Total items attempted. */
  totalCount: number;
  /** Per-item results (fulfilled only, in order). */
  results: { index: number; value: R }[];
}

/**
 * Process multiple items in parallel with bounded concurrency,
 * aggregate progress display, and per-item error isolation.
 *
 * Progress display auto-detects CLI (ora spinner) vs REPL (TUI ProgressBar)
 * via createProgressSink(). No inline ora or ProgressContext logic.
 */
export async function runBatch<T, R>(opts: BatchOptions<T, R>): Promise<BatchResult<R>> {
  const { items, label, process: processFn, formatSuccess, command, signal } = opts;
  const total = items.length;
  const concurrency = getSettings().cli.file_concurrency;
  const sink = createProgressSink(`0/${total}`);

  const filePercents = Array.from({ length: total }, () => 0);
  const activeLabels = new Map<number, string>();
  let completedCount = 0;

  const updateProgress = (): void => {
    const avg = filePercents.reduce((a, b) => a + b, 0) / total;
    const names = [...activeLabels.values()];
    const suffix = names.length > 0 ? `: ${names.join(", ")}` : "";
    sink.update(Math.round(avg), `${completedCount}/${total}${suffix}`);
  };

  let settled: (PromiseSettledResult<R> | undefined)[];
  let successCount = 0;
  const results: { index: number; value: R }[] = [];

  try {
    settled = await poolMap(
      items,
      concurrency,
      async (item, index) => {
        activeLabels.set(index, label(item));
        updateProgress();
        try {
          const result = await processFn(item, index, (pct) => {
            filePercents[index] = pct;
            updateProgress();
          });
          filePercents[index] = 100;
          activeLabels.delete(index);
          completedCount++;
          updateProgress();
          terminal.success(formatSuccess(result));
          return result;
        } catch (error) {
          if (error instanceof CancelledError) throw error;
          // Failed file is still 100% processed
          filePercents[index] = 100;
          activeLabels.delete(index);
          completedCount++;
          updateProgress();
          handleCommandError(log, error, { command, file: label(item) });
          throw error;
        }
      },
      signal
    );

    // Count successes (results already printed in callback)
    for (const [i, r] of settled.entries()) {
      if (!r) continue;
      if (r.status === "fulfilled") {
        successCount++;
        results.push({ index: i, value: r.value });
      } else if (r.reason instanceof CancelledError) {
        throw r.reason;
      }
    }
  } finally {
    sink.stop();
  }

  if (successCount === total) {
    sink.succeed(`${successCount}/${total} completed`);
  } else {
    sink.warn(`${successCount}/${total} completed`);
  }

  return { successCount, totalCount: total, results };
}
