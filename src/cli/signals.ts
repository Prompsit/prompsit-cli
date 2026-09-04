// Registers process-level SIGINT/SIGTERM handlers.
// Cleanup: abort in-flight work, drain best-effort cleanup (server job cancel + telemetry)
// within a bounded window, then exit with signal-specific code.

import { resetApiClient } from "../api/client.ts";
import { flushTelemetry } from "../logging/setup.ts";
import { SIGINT_EXIT, SIGTERM_EXIT } from "./exit-codes.ts";
import { abortShutdownWork, drainShutdownTasks } from "./shutdown.ts";

/** Bounded window to drain in-flight cleanup (server job cancel + telemetry) before exit. */
const SHUTDOWN_GRACE_MS = 1500;

/**
 * Abort in-flight work, drain best-effort cleanup within a bounded window, then force exit.
 *
 * Aborting first lets trackJob's catch issue a server-side job cancel (registered as a
 * shutdown task); draining then awaits that cancel and any in-flight Loki telemetry so they
 * are not lost to the forced process.exit().
 */
async function gracefulShutdown(exitCode: number): Promise<void> {
  abortShutdownWork();
  await Promise.allSettled([
    drainShutdownTasks(SHUTDOWN_GRACE_MS),
    flushTelemetry(SHUTDOWN_GRACE_MS),
  ]);
  resetApiClient();
  process.exit(exitCode);
}

/**
 * Register process-level signal handlers for graceful shutdown.
 *
 * SIGINT (Ctrl+C): cleanup + exit 130
 * SIGTERM (supervisor/OS kill): cleanup + exit 143
 *
 * Must be called before program.parseAsync() in index.ts.
 */
export function setupSignalHandlers(): void {
  process.on("SIGINT", () => void gracefulShutdown(SIGINT_EXIT));
  process.on("SIGTERM", () => void gracefulShutdown(SIGTERM_EXIT));
}
