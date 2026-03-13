// Shared ANSI escape sequence utilities.
// Handles all CSI sequences (final bytes 0x40-0x7E), not just SGR (*m).

/**
 * Remove ANSI CSI escape sequences from string.
 *
 * Parses CSI sequences per ECMA-48: ESC [ <params> <final byte>.
 * Final byte range: 0x40-0x7E (@, A-Z, a-z, [, \, ], ^, _, `, {, |, }, ~).
 * This correctly handles cursor movement, SGR, and all other CSI commands.
 */
export function stripAnsi(text: string): string {
  let result = "";
  let i = 0;

  while (i < text.length) {
    if (text[i] === "\u001B" && text[i + 1] === "[") {
      i += 2;
      while (i < text.length) {
        const code = text.codePointAt(i) ?? 0;
        const isFinalByte = code >= 0x40 && code <= 0x7e;
        i++;
        if (isFinalByte) break;
      }
      continue;
    }

    result += text[i];
    i++;
  }

  return result;
}

/**
 * Visible (terminal) width: Unicode code-point count after ANSI stripping.
 */
export function visibleWidth(text: string): number {
  // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional Unicode code-point counting
  return [...stripAnsi(text)].length;
}
