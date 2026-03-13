import type { Component } from "@mariozechner/pi-tui";
import { truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import { formatOutputEvent } from "../../history/output-render.ts";
import { outputBridge } from "../../core/output-bridge.ts";
import { stripAnsi } from "../../../output/ansi-utils.ts";
import { normalizeSelection, applyHighlight, type SelectionPos } from "../selection-utils.ts";

export class HistoryComponent implements Component {
  private readonly getMaxLines: () => number;
  private readonly bannerRenderer: ((width: number) => string[]) | null;
  private scrollOffset = 0;

  private selection: { start: SelectionPos; end: SelectionPos } | null = null;
  private isDragging = false;
  private lastRenderedLines: string[] = [];

  constructor(getMaxLines: () => number, bannerRenderer?: (width: number) => string[]) {
    this.getMaxLines = getMaxLines;
    this.bannerRenderer = bannerRenderer ?? null;
  }

  invalidate(): void {
    return;
  }

  scroll(delta: number): void {
    this.scrollOffset = Math.max(0, this.scrollOffset + delta);
  }

  resetScroll(): void {
    this.scrollOffset = 0;
  }

  startSelection(row: number, col: number): void {
    this.selection = { start: { row, col }, end: { row, col } };
    this.isDragging = true;
  }

  extendSelection(row: number, col: number): void {
    if (!this.selection || !this.isDragging) return;
    this.selection = { ...this.selection, end: { row, col } };
  }

  endSelection(row: number, col: number): void {
    if (!this.selection) return;
    this.selection = { ...this.selection, end: { row, col } };
    this.isDragging = false;
  }

  clearSelection(): void {
    this.selection = null;
    this.isDragging = false;
  }

  getSelectedText(): string {
    if (!this.selection) return "";
    const { start, end } = normalizeSelection(this.selection);
    const lines = this.lastRenderedLines;

    if (start.row === end.row) {
      return stripAnsi(lines[start.row] ?? "").slice(start.col, end.col);
    }

    const parts = [stripAnsi(lines[start.row] ?? "").slice(start.col)];
    for (let i = start.row + 1; i < end.row; i++) {
      parts.push(stripAnsi(lines[i] ?? ""));
    }
    parts.push(stripAnsi(lines[end.row] ?? "").slice(0, end.col));
    return parts.join("\n");
  }

  render(width: number): string[] {
    const maxLines = this.getMaxLines();
    if (maxLines <= 0) return [];

    const bannerLines = this.bannerRenderer ? this.bannerRenderer(width) : [];
    const historyLines: string[] = [];

    for (const item of outputBridge.getHistory()) {
      if (item.event.kind === "command" && historyLines.length > 0) {
        historyLines.push("");
      }
      historyLines.push(...formatOutputEvent(item.event, width).split("\n"));
    }

    const allLines = [...bannerLines, ...historyLines].flatMap((line) =>
      wrapTextWithAnsi(line, width)
    );
    const total = allLines.length;
    this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, total - maxLines));

    const end = total - this.scrollOffset;
    const renderedLines = allLines.slice(Math.max(0, end - maxLines), end);

    // Pad to maxLines: empty lines at top, content at bottom (terminal convention).
    // Ensures editor + status bar are always at terminal bottom.
    while (renderedLines.length < maxLines) {
      renderedLines.unshift("");
    }

    this.lastRenderedLines = [...renderedLines];

    if (this.selection) {
      const { start, end: selEnd } = normalizeSelection(this.selection);
      for (let i = 0; i < renderedLines.length; i++) {
        if (i < start.row || i > selEnd.row) continue;
        const colStart = i === start.row ? start.col : 0;
        const colEnd = i === selEnd.row ? selEnd.col : stripAnsi(renderedLines[i]).length;
        renderedLines[i] = applyHighlight(renderedLines[i], colStart, colEnd);
      }
    }

    return renderedLines.map((line) => truncateToWidth(line, width));
  }
}
