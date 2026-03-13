// Adapter wrapping our completer.ts into pi-tui's AutocompleteProvider interface.
// Provides:
//  1. Fuzzy command completion dropdown for command names.
//  2. @"file" completion — delegates to pi-tui's CombinedAutocompleteProvider
//     which uses readdirSync (no fd dependency), handles ~/, symlinks, and quotes.
//
// Template-based completion is handled by GhostTextEditor (inline ghost text).

import {
  CombinedAutocompleteProvider,
  type AutocompleteProvider,
  type AutocompleteItem,
} from "@mariozechner/pi-tui";
import { completer } from "./completer.ts";
import { getDropdownCommands } from "../registry.ts";
import { getAllowedExtensions } from "../../runtime/format-extensions.ts";

// pi-tui file provider (no fd — third arg null → uses readdirSync internally)
let _fileProvider: CombinedAutocompleteProvider | null = null;
function getFileProvider(): CombinedAutocompleteProvider {
  _fileProvider ??= new CombinedAutocompleteProvider([], process.cwd(), null);
  return _fileProvider;
}

/** Detects unclosed @"... pattern at end of text (pi-tui's native convention). */
export const AT_FILE_RE = /@"[^"]*$/u;

/** Check if cursor is inside an unclosed @"... file reference. */
export function isInAtFileContext(line: string, cursorCol: number): boolean {
  return AT_FILE_RE.test(line.slice(0, cursorCol));
}

export class ReplAutocompleteProvider implements AutocompleteProvider {
  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number
  ): { items: AutocompleteItem[]; prefix: string } | null {
    const currentLine = lines[cursorLine] ?? "";

    // --- @"file" completion: delegate to pi-tui, then filter by command formats ---
    if (isInAtFileContext(currentLine, cursorCol)) {
      const result = getFileProvider().getForceFileSuggestions(lines, cursorLine, cursorCol);
      if (!result) return null;

      const command = parseCommandName(lines[0] ?? "");
      const allowed = getAllowedExtensions(command);
      if (!allowed) return result; // cache not ready → show all

      const filtered = result.items.filter(
        (item) => item.label.endsWith("/") || matchesExtensions(item.label, allowed)
      );
      return filtered.length > 0 ? { items: filtered, prefix: result.prefix } : result;
    }

    // --- Command name completion ---
    const textBeforeCursor = currentLine.slice(0, cursorCol);
    const [completions, prefix] = completer(textBeforeCursor);

    if (completions.length > 0) {
      // Single exact match: typed text already IS the command — no completion to offer.
      // Returning null lets Enter reach onSubmit instead of being consumed by the dropdown.
      if (completions.length === 1 && completions[0] === prefix) {
        return null;
      }

      const descriptions = getDropdownCommands();
      const items: AutocompleteItem[] = completions.map((name) => ({
        value: name,
        label: name,
        description: descriptions.get(name),
      }));
      return { items, prefix };
    }

    return null;
  }

  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: AutocompleteItem,
    prefix: string
  ): { lines: string[]; cursorLine: number; cursorCol: number } {
    // @"file" completion: delegate to pi-tui (handles quotes, cursor, directories)
    if (prefix.startsWith("@")) {
      return getFileProvider().applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    }

    // Command name completion
    const currentLine = lines[cursorLine] ?? "";
    const beforePrefix = currentLine.slice(0, cursorCol - prefix.length);
    const afterCursor = currentLine.slice(cursorCol);

    const newLine = beforePrefix + item.value + afterCursor;
    const newLines = lines.with(cursorLine, newLine);

    return {
      lines: newLines,
      cursorLine,
      cursorCol: beforePrefix.length + item.value.length,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers for format-aware file filtering
// ---------------------------------------------------------------------------

/** Implicit-translate regex: line starts with @" or " (no command prefix). */
const IMPLICIT_TRANSLATE_RE = /^@?"/;

/** Extract the REPL command name from the first line of input. */
function parseCommandName(line: string): string {
  const trimmed = line.trimStart();
  if (IMPLICIT_TRANSLATE_RE.test(trimmed)) return "translate";
  const spaceIdx = trimmed.indexOf(" ");
  return spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
}

/** Check if a filename matches any of the allowed extensions (handles compound like .jsonl.gz). */
function matchesExtensions(filename: string, allowed: ReadonlySet<string>): boolean {
  const lower = filename.toLowerCase();
  for (const ext of allowed) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}
