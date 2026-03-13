// Progress event types for REPL command lifecycle tracking.
// Used by ReplService to emit progress updates consumed by the REPL controller.

import type { ProgressPhase } from "../../runtime/progress-context.ts";

/** Progress event emitted during REPL command execution. */
export interface ProgressEvent {
  commandId: string;
  phase: ProgressPhase;
  /** Completion percentage (0-100), only meaningful for in_progress phase. */
  percent?: number;
  /** Step description from SSE/polling (e.g. "xliff", "translating"). */
  message?: string;
  timestamp: number;
}

/**
 * Discriminated union for executeCommand() return type.
 * Replaces boolean to distinguish continue/exit/cancelled outcomes.
 */
export type ExecuteResult =
  | { outcome: "continue" }
  | { outcome: "cleared" }
  | { outcome: "exit" }
  | { outcome: "cancelled" }
  | { outcome: "settings" };

/**
 * Discriminated union for submit() return type.
 * Distinguishes between executed commands and incomplete input awaiting more lines.
 */
export type SubmitResult =
  | { kind: "executed"; shouldContinue: boolean }
  | { kind: "await_more_input"; reason: "unclosed_quote" | "trailing_backslash" }
  | { kind: "settings" };

export { type ProgressPhase } from "../../runtime/progress-context.ts";
