// CommandHistory — in-memory history with cursor-based UP/DOWN navigation.
// Loads persisted history from ~/.prompsit/history on construction.

import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir } from "../../config/paths.ts";

const MAX_ENTRIES = 1000;

export class CommandHistory {
  private entries: string[] = [];
  private cursor = -1;
  private draft = "";

  constructor() {
    this.loadFromFile();
  }

  /**
   * Add a command to in-memory history (consecutive dedup).
   * Resets navigation cursor. No file I/O.
   */
  add(cmd: string): void {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // Consecutive dedup: skip if same as last entry
    if (this.entries.length > 0 && this.entries.at(-1) === trimmed) {
      this.reset();
      return;
    }

    this.entries.push(trimmed);

    // Cap at MAX_ENTRIES
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }

    this.reset();
  }

  /**
   * Navigate UP (older entries).
   * First call saves currentInput as draft and returns last entry.
   * Returns null at boundary (already at oldest).
   */
  navigateUp(currentInput: string): string | null {
    if (this.entries.length === 0) return null;

    if (this.cursor === -1) {
      // First UP: save current input as draft, jump to end
      this.draft = currentInput;
      this.cursor = this.entries.length - 1;
      return this.entries[this.cursor];
    }

    if (this.cursor > 0) {
      this.cursor--;
      return this.entries[this.cursor];
    }

    // Already at oldest entry
    return null;
  }

  /**
   * Navigate DOWN (newer entries).
   * Past the end: returns saved draft.
   * Returns null at boundary (already past end / not navigating).
   */
  navigateDown(): string | null {
    if (this.cursor === -1) return null;

    if (this.cursor < this.entries.length - 1) {
      this.cursor++;
      return this.entries[this.cursor];
    }

    // Past end: return draft and reset cursor
    const draft = this.draft;
    this.reset();
    return draft;
  }

  /** Get history entries (newest last) for preloading into Editor. */
  getEntries(limit?: number): string[] {
    if (limit === undefined) return [...this.entries];
    return this.entries.slice(-limit);
  }

  /** Reset cursor to idle state. */
  reset(): void {
    this.cursor = -1;
    this.draft = "";
  }

  /** Append a command line to the persistent history file (async, fire-and-forget). */
  appendLine(line: string): void {
    const historyFile = path.join(getConfigDir(), "history");
    const dir = path.dirname(historyFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.promises
      .appendFile(historyFile, line + "\n", { encoding: "utf8", flush: true })
      .catch(() => {});
  }

  /** Clear all in-memory entries and truncate the persistent history file. */
  clear(): void {
    this.entries = [];
    this.reset();
    try {
      const historyFile = path.join(getConfigDir(), "history");
      if (fs.existsSync(historyFile)) {
        fs.writeFileSync(historyFile, "", { encoding: "utf8", flush: true });
      }
    } catch {
      // Non-critical: ignore file errors
    }
  }

  /** Load history from ~/.prompsit/history, filtering comments and consecutive dupes. */
  private loadFromFile(): void {
    try {
      const historyFile = path.join(getConfigDir(), "history");
      if (!fs.existsSync(historyFile)) return;

      const content = fs.readFileSync(historyFile, "utf8");
      const lines = content.split("\n");

      const filtered: string[] = [];
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        // Consecutive dedup
        if (filtered.length > 0 && filtered.at(-1) === line) continue;
        filtered.push(line);
      }

      // Keep last MAX_ENTRIES
      this.entries = filtered.length > MAX_ENTRIES ? filtered.slice(-MAX_ENTRIES) : filtered;
    } catch {
      // Non-critical: start with empty history
      this.entries = [];
    }
  }
}
