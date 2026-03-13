// Pure input analysis for REPL.
// Zero internal dependencies — leaf module.

export type CompletenessResult =
  | { complete: true }
  | { complete: false; reason: "unclosed_quote" | "trailing_backslash" };

/**
 * Count unescaped double quotes in text.
 * Canonical implementation — used by completer, keybindings, and completeness check.
 */
export function countQuotes(text: string): number {
  let count = 0;
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      count++;
    }
  }
  return count;
}

/**
 * Check whether accumulated input text is complete (ready to execute).
 *
 * Incomplete conditions:
 * 1. Trailing backslash (explicit line continuation)
 * 2. Odd number of unescaped quotes (unclosed string)
 */
export function checkCompleteness(text: string): CompletenessResult {
  const trimmed = text.trimEnd();
  if (trimmed.endsWith("\\")) {
    return { complete: false, reason: "trailing_backslash" };
  }
  if (countQuotes(text) % 2 !== 0) {
    return { complete: false, reason: "unclosed_quote" };
  }
  return { complete: true };
}
