// Wrapper around pi-tui Editor that adds inline ghost text (dim suggestions).
// Implements Component + Focusable to serve as a drop-in replacement for Editor
// in the TUI component tree.

import {
  Editor,
  Key,
  matchesKey,
  visibleWidth,
  type AutocompleteProvider,
  type Component,
  type EditorOptions,
  type EditorTheme,
  type Focusable,
  type TUI,
} from "@mariozechner/pi-tui";
import { computeGhostText } from "../../input/ghost-text.ts";

// ANSI: dim + bright black (gray). Raw codes avoid chalk overhead in render loop.
const DIM_START = "\u001B[2;90m";
const DIM_END = "\u001B[0m";

// SGR reverse video -- used by pi-tui to render the cursor block.
const CURSOR_SGR = "\u001B[7m";

/**
 * Extract the first logical segment from ghost text for piecewise acceptance.
 *
 * When ghost starts with `"` (closing quote of current field), include the
 * full field transition up to the SECOND `"` (e.g. `" -s "` from `" -s "src" ...`).
 * This matches the existing handleTab() piecewise behavior.
 *
 * Otherwise, returns text up to and including the first `"`, or the full string
 * if no quote is present.
 */
function extractFirstSegment(ghost: string): string {
  if (ghost.startsWith('"')) {
    // Skip closing quote, find the next one (opening quote of next field)
    const secondQuoteIdx = ghost.indexOf('"', 1);
    if (secondQuoteIdx >= 1) {
      return ghost.slice(0, secondQuoteIdx + 1);
    }
  }
  const quoteIdx = ghost.indexOf('"');
  if (quoteIdx !== -1) {
    return ghost.slice(0, quoteIdx + 1);
  }
  return ghost;
}

export class GhostTextEditor implements Component, Focusable {
  /** Inner pi-tui Editor -- public for controller's internal access. */
  readonly editor: Editor;

  private ghostText: string | null = null;
  private _disabled = false;
  private _normalBorderColor: ((s: string) => string) | undefined;

  constructor(tui: TUI, theme: EditorTheme, options?: EditorOptions) {
    this.editor = new Editor(tui, theme, options);
  }

  /** When disabled, all input is blocked (except Esc for abort) and border dims. */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(v: boolean) {
    if (this._disabled === v) return;
    this._disabled = v;
    this.editor.disableSubmit = v;
    if (v) {
      this.ghostText = null;
      this._normalBorderColor = this.editor.borderColor;
      this.editor.borderColor = (s: string) => `\u001B[90m${s}\u001B[0m`; // dim gray
    } else if (this._normalBorderColor) {
      this.editor.borderColor = this._normalBorderColor;
      this._normalBorderColor = undefined;
    }
  }

  // --- Focusable ---
  get focused(): boolean {
    return this.editor.focused;
  }
  set focused(v: boolean) {
    this.editor.focused = v;
  }

  // --- Component ---
  invalidate(): void {
    this.editor.invalidate();
  }

  render(width: number): string[] {
    const lines = this.editor.render(width);

    if (!this.ghostText || this.editor.isShowingAutocomplete()) {
      return lines;
    }

    return this.injectGhostText(lines);
  }

  handleInput(data: string): void {
    // When disabled (command executing), only allow Esc for abort
    if (this._disabled) {
      if (matchesKey(data, Key.escape)) {
        this.editor.handleInput(data);
      }
      return;
    }

    // --- @ auto-pair: insert opening quote for file prefix ---
    if (data === "@") {
      const cursor = this.editor.getCursor();
      const currentLine = this.editor.getLines()[cursor.line] ?? "";
      const charBefore = currentLine[cursor.col - 1];
      if (cursor.col === 0 || charBefore === " " || charBefore === "\t") {
        this.editor.insertTextAtCursor('@"');
        this.triggerAutocomplete();
        this.recomputeGhostText();
        return;
      }
    }

    // --- Tab priority ---
    if (matchesKey(data, Key.tab)) {
      if (this.editor.isShowingAutocomplete()) {
        // 1. Dropdown open -> let Editor handle (select item)
        this.editor.handleInput(data);
        this.recomputeGhostText();
        return;
      }
      if (this.ghostText) {
        // 2. Ghost text available -> accept segment
        this.acceptGhostText();
        return;
      }
      // 3. No ghost, no dropdown -> default Editor Tab
      this.editor.handleInput(data);
      this.recomputeGhostText();
      return;
    }

    // --- Right Arrow priority ---
    if (matchesKey(data, Key.right) && this.ghostText) {
      const cursor = this.editor.getCursor();
      const editorLines = this.editor.getLines();
      const currentLine = editorLines[cursor.line] ?? "";
      if (editorLines.length === 1 && cursor.col === currentLine.length) {
        this.acceptGhostText();
        return;
      }
    }

    // --- All other keys -> delegate, then recompute ---
    this.editor.handleInput(data);
    this.recomputeGhostText();
  }

  // --- Delegated Editor API (used by controller.ts) ---

  get onSubmit(): ((text: string) => void) | undefined {
    return this.editor.onSubmit;
  }
  set onSubmit(fn: ((text: string) => void) | undefined) {
    this.editor.onSubmit = fn;
  }

  get onChange(): ((text: string) => void) | undefined {
    return this.editor.onChange;
  }
  set onChange(fn: ((text: string) => void) | undefined) {
    this.editor.onChange = fn;
  }

  get borderColor(): (s: string) => string {
    return this._normalBorderColor ?? this.editor.borderColor;
  }
  set borderColor(fn: (s: string) => string) {
    this._normalBorderColor = fn;
    if (!this._disabled) {
      this.editor.borderColor = fn;
    }
  }

  setAutocompleteProvider(provider: AutocompleteProvider): void {
    this.editor.setAutocompleteProvider(provider);
  }

  addToHistory(text: string): void {
    this.editor.addToHistory(text);
  }

  getText(): string {
    return this.editor.getText();
  }

  getExpandedText(): string {
    return this.editor.getExpandedText();
  }

  getLines(): string[] {
    return this.editor.getLines();
  }

  getCursor(): { line: number; col: number } {
    return this.editor.getCursor();
  }

  setText(text: string): void {
    this.editor.setText(text);
    this.recomputeGhostText();
  }

  insertTextAtCursor(text: string): void {
    this.editor.insertTextAtCursor(text);
    this.recomputeGhostText();
  }

  isShowingAutocomplete(): boolean {
    return this.editor.isShowingAutocomplete();
  }

  /** Trigger autocomplete dropdown programmatically (pi-tui private API). */
  triggerAutocomplete(): void {
    (this.editor as unknown as { tryTriggerAutocomplete: () => void }).tryTriggerAutocomplete();
  }

  // --- Ghost text logic ---

  recomputeGhostText(): void {
    const lines = this.editor.getLines();
    const cursor = this.editor.getCursor();
    this.ghostText = computeGhostText(lines, cursor.line, cursor.col);
  }

  private acceptGhostText(): void {
    if (!this.ghostText) return;

    const segment = extractFirstSegment(this.ghostText);
    this.editor.insertTextAtCursor(segment);
    this.ghostText = null;
    this.recomputeGhostText();
  }

  /**
   * Inject dim ghost text into rendered lines after the cursor.
   *
   * Strategy: find the line containing SGR reverse video (\x1b[7m) which
   * pi-tui uses for cursor rendering. Insert dim text after the cursor block.
   * Graceful degradation: if cursor marker not found, return unmodified lines.
   */
  private injectGhostText(renderedLines: string[]): string[] {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- caller checks ghostText is set
    const ghost = this.ghostText!;
    const result = [...renderedLines];

    // Search for cursor line (skip border lines: first and last are borders)
    for (let i = 1; i < result.length - 1; i++) {
      const line = result[i];
      const cursorIdx = line.indexOf(CURSOR_SGR);
      if (cursorIdx === -1) continue;

      // Find the SGR reset after cursor: \x1b[0m
      const resetIdx = line.indexOf("\u001B[0m", cursorIdx + CURSOR_SGR.length);
      if (resetIdx === -1) continue;

      const afterCursorPos = resetIdx + 4; // length of \x1b[0m
      const before = line.slice(0, afterCursorPos);
      const after = line.slice(afterCursorPos);

      // Calculate available padding width
      const afterVW = visibleWidth(after);
      const ghostVW = visibleWidth(ghost);

      if (ghostVW <= afterVW) {
        // Ghost fits in existing padding -- replace padding chars
        const remainPad = " ".repeat(Math.max(0, afterVW - ghostVW));
        result[i] = before + DIM_START + ghost + DIM_END + remainPad;
      } else if (afterVW > 0) {
        // Truncate ghost to available space
        const truncated = truncateGhostToWidth(ghost, afterVW);
        result[i] = before + DIM_START + truncated + DIM_END;
      }
      // else: no padding available, skip ghost text

      break;
    }

    return result;
  }
}

/**
 * Truncate ghost text to fit within maxWidth visible columns.
 * Simple char-by-char approach since ghost text is ASCII.
 */
function truncateGhostToWidth(text: string, maxWidth: number): string {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const charWidth = visibleWidth(text[i]);
    if (width + charWidth > maxWidth) {
      return text.slice(0, i);
    }
    width += charWidth;
  }
  return text;
}
