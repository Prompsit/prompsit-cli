// See API-456: Signal handling for graceful shutdown
// Registers process-level SIGINT/SIGTERM handlers.
// Cleanup: close HTTP connections via resetApiClient(), then exit with signal-specific code.

import { resetApiClient } from "../api/client.ts";
import { SIGINT_EXIT, SIGTERM_EXIT } from "./exit-codes.ts";

/**
 * Register process-level signal handlers for graceful shutdown.
 *
 * SIGINT (Ctrl+C): cleanup + exit 130
 * SIGTERM (supervisor/OS kill): cleanup + exit 143
 *
 * Must be called before program.parseAsync() in index.ts.
 */
export function setupSignalHandlers(): void {
  process.on("SIGINT", () => {
    resetApiClient();
    process.exit(SIGINT_EXIT);
  });

  process.on("SIGTERM", () => {
    resetApiClient();
    process.exit(SIGTERM_EXIT);
  });
}
