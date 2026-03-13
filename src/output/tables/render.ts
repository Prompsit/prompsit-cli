import Table from "cli-table3";
import type { ResolvedColumn, TableModel, TableRenderContext } from "./types.ts";

import { stripAnsi, visibleWidth } from "../ansi-utils.ts";

const DEFAULT_TERM_WIDTH = 80;
const AUTO_COMPACT_THRESHOLD = 80;

function getTermWidth(): number {
  return process.stdout.columns || DEFAULT_TERM_WIDTH;
}

function truncateLine(input: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (visibleWidth(input) <= maxWidth) return input;

  const plain = stripAnsi(input);
  if (maxWidth <= 3) return ".".repeat(maxWidth);
  return `${plain.slice(0, maxWidth - 3)}...`;
}

function renderCompact(model: TableModel, maxColumns: number): string {
  if (model.rows.length === 0) {
    return model.emptyMessage ?? "";
  }

  const columnsByKey = new Map(model.columns.map((col) => [col.key, col]));
  const order = (
    model.compactOrder?.length ? model.compactOrder : model.columns.map((col) => col.key)
  ).filter((key, index, arr) => arr.indexOf(key) === index && columnsByKey.has(key));

  return model.rows
    .map((row, index) => {
      const lines: string[] = [];
      const firstKey = order[0];

      if (firstKey) {
        const firstCol = columnsByKey.get(firstKey);
        if (firstCol) {
          lines.push(`${index + 1}. ${firstCol.header}: ${row[firstKey] ?? ""}`);
        } else {
          lines.push(`${index + 1}.`);
        }
      } else {
        lines.push(`${index + 1}.`);
      }

      for (let i = 1; i < order.length; i++) {
        const key = order[i];
        const col = columnsByKey.get(key);
        if (!col) continue;
        const value = row[key] ?? "";
        if (value.length === 0) continue;
        lines.push(`   ${col.header}: ${value}`);
      }

      return lines.map((line) => truncateLine(line, maxColumns)).join("\n");
    })
    .join("\n\n");
}

function resolveTabularLayout(
  model: TableModel,
  terminalColumns: number
): { columns: ResolvedColumn[]; widths: number[] } | null {
  if (model.columns.length === 0) return null;

  let current = model.columns.map<ResolvedColumn>((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
    minWidth: Math.max(4, col.minWidth ?? 12),
    priority: col.priority ?? 100,
    required: col.required ?? false,
  }));

  const minTotalFor = (cols: ResolvedColumn[]): number => {
    const overhead = cols.length * 3 + 1;
    const content = cols.reduce((sum, col) => sum + (col.width ?? col.minWidth), 0);
    return overhead + content;
  };

  while (current.length > 0 && minTotalFor(current) > terminalColumns) {
    let dropIndex = -1;
    let dropPriority = -1;
    for (const [i, col] of current.entries()) {
      if (col.required) continue;
      if (col.priority > dropPriority) {
        dropPriority = col.priority;
        dropIndex = i;
      }
    }
    if (dropIndex === -1) return null;
    current = current.filter((_, i) => i !== dropIndex);
  }

  if (current.length === 0) return null;

  const overhead = current.length * 3 + 1;
  const available = Math.max(0, terminalColumns - overhead - 2);
  const fixedTotal = current.reduce((sum, col) => sum + (col.width ?? 0), 0);
  const flexCols = current.filter((col) => col.width === undefined);
  const flexMinTotal = flexCols.reduce((sum, col) => sum + col.minWidth, 0);

  if (fixedTotal + flexMinTotal > available) return null;

  const extra = available - fixedTotal - flexMinTotal;
  const extraEach = flexCols.length > 0 ? Math.floor(extra / flexCols.length) : 0;
  let remainder = flexCols.length > 0 ? extra % flexCols.length : 0;

  const widths = current.map((col) => {
    if (col.width !== undefined) return col.width;
    const bonus = extraEach + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    return col.minWidth + bonus;
  });

  return { columns: current, widths };
}

export function renderTable(model: TableModel, context: TableRenderContext = {}): string {
  const columns = Math.max(20, context.columns ?? getTermWidth());
  const requestedMode = context.mode ?? "auto";
  const forceCompact = requestedMode === "compact";

  if (forceCompact || (requestedMode === "auto" && columns < AUTO_COMPACT_THRESHOLD)) {
    return renderCompact(model, columns);
  }

  const resolved = resolveTabularLayout(model, columns);
  if (!resolved) {
    return renderCompact(model, columns);
  }

  const table = new Table({
    head: resolved.columns.map((col) => col.header),
    style: { head: [], compact: true },
    colWidths: resolved.widths,
    wordWrap: true,
  });

  for (const row of model.rows) {
    table.push(resolved.columns.map((col) => row[col.key] ?? ""));
  }

  return table.toString();
}
