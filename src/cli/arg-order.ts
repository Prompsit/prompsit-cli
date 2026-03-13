// Pure argument validation utility.
// Extracted from repl/executor.ts — used by both REPL and CLI commands.

/**
 * Reject positional args appearing after options (POSIX Guideline 10 violation).
 * Scans left-to-right: once an option flag is seen, subsequent non-flag tokens
 * must be option values, not new positional args.
 *
 * @param args - Tokenized command-line arguments to validate.
 * @param boolFlags - Option flags that take no value (e.g. `--verbose`).
 * @returns The offending positional arg, or null if order is valid.
 */
export function validateArgOptionOrder(
  args: string[],
  boolFlags: ReadonlySet<string>
): string | null {
  let seenOption = false;
  let skipNext = false;
  for (const arg of args) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (arg === "--") break;
    if (arg.startsWith("-")) {
      seenOption = true;
      if (!boolFlags.has(arg)) skipNext = true;
    } else if (seenOption) {
      return arg;
    }
  }
  return null;
}
