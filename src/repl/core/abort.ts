// REPL-scoped AbortController for cancelling running commands.
// Module-level singleton: reset() before each command, abort() on Ctrl+C.

let controller = new AbortController();

/** Get current signal (pass to got/fetch). */
export function getSignal(): AbortSignal {
  return controller.signal;
}

/** Abort the current command. */
export function abort(): void {
  controller.abort();
}

/** Create fresh controller for next command. */
export function reset(): void {
  controller = new AbortController();
}
