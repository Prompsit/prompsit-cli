// Graceful-shutdown coordination for CLI mode.
//
// Provides a process-wide AbortSignal that signal handlers trip on Ctrl+C, plus a registry
// of best-effort cleanup tasks (e.g. server-side job cancel) that the handler drains within
// a bounded window before forcing exit. Without this, process.exit() in the signal handler
// kills in-flight cleanup (job cancel, telemetry) before it can complete.

let abortController: AbortController | null = null;
const pendingTasks = new Set<Promise<unknown>>();

/** Process-wide AbortSignal for in-flight CLI work. Wrap command execution with this. */
export function getShutdownSignal(): AbortSignal {
  abortController ??= new AbortController();
  return abortController.signal;
}

/** Trip the shutdown signal so in-flight work (job tracking, requests) unwinds. */
export function abortShutdownWork(): void {
  abortController?.abort();
}

/** Register a best-effort cleanup promise to be awaited during graceful shutdown. */
export function trackShutdownTask(task: Promise<unknown>): void {
  pendingTasks.add(task);
  void Promise.resolve(task).finally(() => pendingTasks.delete(task));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

/**
 * Await registered cleanup tasks within a bounded window. Never throws.
 *
 * Waits briefly first so aborted work has a chance to register its cleanup task
 * (abort propagates over a few microtasks before trackJob's catch fires the cancel).
 */
export async function drainShutdownTasks(timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  await delay(Math.min(50, timeoutMs));
  while (pendingTasks.size > 0 && performance.now() < deadline) {
    await Promise.race([Promise.allSettled(pendingTasks), delay(deadline - performance.now())]);
  }
}
