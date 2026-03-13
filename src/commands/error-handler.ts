// Shared command error handler: logs + shows user error + sets exit code.
// Eliminates duplicated catch blocks across all 11 command files.
// See docs/reference/guides/logging-policy.md §2 (Exception → Log Level Tree).

import { ZodError } from "zod";
import { APIError, CancelledError, JobError } from "../errors/contracts.ts";
import { classifyError } from "../errors/catalog.ts";
import { terminal } from "../output/index.ts";
import { APP_ERROR } from "../cli/exit-codes.ts";
import { setExitCode } from "../cli/exit.ts";
import { t } from "../i18n/index.ts";
import { ErrorCode } from "../errors/codes.ts";
import type { ModuleLogger } from "../logging/index.ts";
import { presentError } from "./error-presenter.ts";

/**
 * Unified command failure path.
 *
 * Always prints a user-facing error and sets app-level exit code.
 */
export function failCommand(code: string, message: string, hint?: string): void {
  terminal.error(code, message, hint);
  setExitCode(APP_ERROR);
}

/**
 * Handle command-level errors: log diagnostics + show user-facing error + set exit code.
 *
 * CancelledError is re-thrown (REPL executor handles Ctrl+C abort).
 *
 * @param log - Module logger from getLogger(import.meta.url)
 * @param error - Caught error (unknown type)
 * @param meta - Additional metadata for structured logging (command name, duration, etc.)
 */
export function handleCommandError(
  log: ModuleLogger,
  error: unknown,
  meta?: Record<string, string>
): void {
  // Ctrl+C abort — propagate to REPL executor for clean handling
  if (error instanceof CancelledError) {
    throw error;
  }

  if (error instanceof JobError) {
    log.error("Job failed", error, { error_code: error.code, ...meta });
    failCommand(error.code, error.message);
  } else if (error instanceof APIError) {
    log.error("Command failed", error, { error_code: error.code, ...meta });
    const { message, hint, code } = presentError(classifyError(error), t);
    failCommand(code, message, hint ?? undefined);
  } else if (error instanceof ZodError) {
    log.error("Unexpected API response", undefined, meta);
    failCommand(ErrorCode.ZOD_VALIDATION, t("error.zod.label"), t("error.zod.hint"));
  } else {
    log.error("Unexpected error", error instanceof Error ? error : undefined, meta);
    failCommand(ErrorCode.UNKNOWN, error instanceof Error ? error.message : String(error));
  }
}
