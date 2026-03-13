// Pure ghost text computation for REPL inline suggestions.
// Returns dim hint text to display after cursor, or null.
// Two sources: command prefix completion + template suggestions.

import { completer, getTemplateSuggestion } from "./completer.ts";

/**
 * Compute ghost text to display after cursor.
 *
 * @returns Hint string (displayed in dim), or null if no suggestion.
 */
export function computeGhostText(
  lines: string[],
  _cursorLine: number,
  cursorCol: number
): string | null {
  // Only single-line input, cursor at end of first line
  if (lines.length > 1) return null;
  const line = lines[0] ?? "";
  if (cursorCol !== line.length) return null;

  const trimmed = line.trimStart();
  if (!trimmed) return null;

  // Case 1: Command name completion (first word, no spaces/quotes)
  if (!trimmed.includes(" ") && !trimmed.includes('"')) {
    const [completions] = completer(trimmed);
    if (completions.length > 0) {
      const top = completions[0];
      if (top !== trimmed && top.startsWith(trimmed)) {
        return top.slice(trimmed.length);
      }
      // Exact match — show template hint with leading space
      if (top === trimmed) {
        const hint = getTemplateSuggestion(trimmed + " ");
        if (hint) return " " + hint;
      }
    }
    return null;
  }

  // Case 2: Template suggestion (after command + space)
  // Implicit translate: starts with " or @" — prepend virtual command for template lookup
  if (/^@?"/.test(trimmed)) {
    return getTemplateSuggestion("translate " + trimmed);
  }
  return getTemplateSuggestion(line);
}
