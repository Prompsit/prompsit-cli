// Execution mode flag: CLI vs REPL.
// Follows ui-invalidate.ts pattern — module-level singleton state.
// enterReplMode() called once at REPL startup; fmtCmd() transforms
// bare command names for user-facing hints in the current mode.

let _repl = false;

export function enterReplMode(): void {
  _repl = true;
}

/** @public Used in test cleanup */
export function exitReplMode(): void {
  _repl = false;
}

/** Prefix bare command with "prompsit " in CLI mode, pass through in REPL. */
export function fmtCmd(bareCmd: string): string {
  return _repl ? bareCmd : `prompsit ${bareCmd}`;
}
