// Pure utility functions for ANSI-aware text selection in terminal output.
// Extracted from history-component.ts for testability.

export interface SelectionPos {
  row: number;
  col: number;
}

const CSI_PREFIX = "\u001B[";
export const SEL_ON = "\u001B[7m";
export const SEL_OFF = "\u001B[27m";

/**
 * Normalize selection so start is always before end.
 * Handles backward selections (drag up / drag left).
 */
export function normalizeSelection(sel: { start: SelectionPos; end: SelectionPos }): {
  start: SelectionPos;
  end: SelectionPos;
} {
  const { start, end } = sel;
  if (start.row < end.row || (start.row === end.row && start.col <= end.col)) {
    return { start, end };
  }
  return { start: end, end: start };
}

/**
 * Read a CSI SGR escape code starting at `index` in `input`.
 * Returns the full escape sequence (e.g. "\x1b[31m") or null if not a valid CSI SGR.
 */
export function readAnsiCodeAt(input: string, index: number): string | null {
  if (!input.startsWith(CSI_PREFIX, index)) return null;
  let i = index + CSI_PREFIX.length;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "m") {
      return input.slice(index, i + 1);
    }
    if (!((ch >= "0" && ch <= "9") || ch === ";")) {
      return null;
    }
    i++;
  }
  return null;
}

/**
 * Inject SGR reverse-video highlight into an ANSI string at visible character positions.
 * ANSI escape codes are preserved and skipped during position counting.
 */
export function applyHighlight(line: string, colStart: number, colEnd: number): string {
  let result = "";
  let visiblePos = 0;
  let i = 0;
  let inHighlight = false;

  while (i < line.length) {
    const ansi = readAnsiCodeAt(line, i);
    if (ansi) {
      result += ansi;
      i += ansi.length;
      continue;
    }

    if (visiblePos === colStart) {
      result += SEL_ON;
      inHighlight = true;
    }

    if (visiblePos === colEnd && inHighlight) {
      result += SEL_OFF;
      inHighlight = false;
    }

    result += line[i];
    visiblePos += 1;
    i += 1;
  }

  if (inHighlight) {
    result += SEL_OFF;
  }

  return result;
}
