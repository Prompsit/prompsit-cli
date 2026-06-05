import { stripAnsi } from "./ansi-utils.ts";

function sanitizeTsvCell(value: string): string {
  return stripAnsi(value).replaceAll(/[\t\r\n]/g, " ");
}

export function renderTsvRows(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(sanitizeTsvCell).join("\t")).join("\n");
}
