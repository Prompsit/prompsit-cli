import { SIGINT_EXIT, USAGE_ERROR } from "./exit-codes.ts";

/** Prefer over direct `process.exitCode =` to keep exit logic centralized. */
export function setExitCode(code: number): void {
  process.exitCode = code;
}

/** POSIX convention: code 2 signals incorrect CLI invocation (wrong args, missing required options). */
export function setUsageErrorExit(): void {
  setExitCode(USAGE_ERROR);
}

/** POSIX convention: code 130 (128 + SIGINT) signals user-initiated abort. */
export function setSigintExit(): void {
  setExitCode(SIGINT_EXIT);
}

/** Reset exit code between REPL commands so one failure does not poison subsequent runs. */
export function clearExitCode(): void {
  process.exitCode = undefined;
}
