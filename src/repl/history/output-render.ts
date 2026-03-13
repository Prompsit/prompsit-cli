// Pure formatting: ReplOutputEvent → chalk-styled terminal strings.

import chalk from "chalk";
import { renderTable } from "../../output/tables/index.ts";
import { REPL_COLORS } from "../ui/data.ts";
import type { ReplOutputEvent } from "../core/output-bridge.ts";

/** Format timestamp as HH:MM:SS. */
function formatClock(timestamp: number): string {
  return new Date(timestamp).toTimeString().slice(0, 8);
}

/** Normalize CRLF to LF and split into lines. @internal Exported for unit tests only. */
export function normalizeHistoryCommand(text: string): string[] {
  const normalized = text.replaceAll(/\r\n?/g, "\n");
  return normalized.split("\n");
}

/**
 * Format a ReplOutputEvent into a chalk-styled string for terminal output.
 * Replaces the JSX rendering logic from HistoryRow.tsx.
 */
export function formatOutputEvent(event: ReplOutputEvent, columns: number): string {
  if (event.kind === "command") {
    const lines = normalizeHistoryCommand(event.text);
    const header =
      chalk.gray(`[${formatClock(event.timestamp)}]`) +
      " " +
      chalk.hex(REPL_COLORS.promptArrow)("$") +
      " " +
      (lines[0] ?? "");
    const continuation = lines.slice(1).map((line) => chalk.gray(" ".repeat(11) + line));
    return [header, ...continuation].join("\n");
  }

  if (event.kind === "table") {
    return renderTable(event.table, { columns, mode: "auto" });
  }

  if (event.kind === "system") {
    return event.text;
  }

  if (event.stream === "stderr") {
    return chalk.red(event.text);
  }

  return event.text;
}
