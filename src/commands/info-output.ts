import { terminal } from "../output/index.ts";
import { renderTsvRows } from "../output/tsv.ts";

export type InfoOutputFormat = "table" | "tsv";

export interface InfoOutputOptions {
  output?: InfoOutputFormat;
}

export function infoOutputFromFlag(tsv: boolean | undefined): InfoOutputOptions {
  return { output: tsv ? "tsv" : "table" };
}

export function isTsvOutput(options?: InfoOutputOptions): boolean {
  return options?.output === "tsv";
}

export function writeTsvRows(rows: readonly (readonly string[])[]): void {
  const output = renderTsvRows(rows);
  if (output.length > 0) {
    terminal.line(output);
  }
}
