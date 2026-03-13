// See API-501: Fuzzy command completion for REPL.
//
// Provides Tab completion and inline suggestions for readline.
// Uses simple prefix + fuzzy matching (no external dependency needed).
import type { CompleterResult } from "node:readline";
import { getDropdownCommands, getTemplates, type TemplateSegment } from "../registry.ts";
import { countQuotes } from "./analyzer.ts";

// Lazy-cached dropdown commands and templates
let _dropdownCache: Map<string, string> | null = null;
let _templateCache: Map<string, readonly TemplateSegment[]> | null = null;

function getDropdown(): Map<string, string> {
  _dropdownCache ??= getDropdownCommands();
  return _dropdownCache;
}

function getTemplateCache(): Map<string, readonly TemplateSegment[]> {
  _templateCache ??= getTemplates();
  return _templateCache;
}

/**
 * Fuzzy match score: lower is better. Returns -1 if no match.
 * Ranking: exact match (0) > prefix (1) > contains (2) > fuzzy subsequence (3).
 */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q === t) return 0;
  if (t.startsWith(q)) return 1;

  // Require 2+ chars for fuzzy matching (contains/subsequence)
  if (q.length < 2) return -1;

  if (t.includes(q)) return 2;

  // Subsequence match
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 3 : -1;
}

/**
 * readline-compatible completer function.
 * Returns [completions, line] where completions are matching command names.
 */
export function completer(line: string): CompleterResult {
  const trimmed = line.trimStart();

  // Only complete first word (command name)
  if (trimmed.includes(" ") || trimmed.includes('"')) {
    return [[], line];
  }

  if (!trimmed) {
    return [[], trimmed];
  }

  const dropdown = getDropdown();
  const scored: [string, number][] = [];

  for (const name of dropdown.keys()) {
    const score = fuzzyScore(trimmed, name);
    if (score >= 0) {
      scored.push([name, score]);
    }
  }

  // Sort by score (best first), then alphabetically
  scored.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));

  const completions = scored.map(([name]) => name);
  return [completions, trimmed];
}

/**
 * Get template-based inline suggestion for the current input.
 * Returns the hint text to show after cursor, or null.
 */
export function getTemplateSuggestion(text: string): string | null {
  const trimmed = text.trimStart();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  // Only suggest after command is typed + space
  if (parts.length === 1 && !trimmed.endsWith(" ")) return null;

  const templates = getTemplateCache();
  const template = templates.get(cmd);
  if (!template) return null;

  // Suppress template when user types non-template flags (before any quoted value).
  // Template prefixes include flags like -s, -h, -t — only suppress for flag-only input.
  const hasQuote = trimmed.includes('"');
  if (!hasQuote && parts.length > 1 && parts.some((p, i) => i > 0 && p.startsWith("-"))) {
    return null;
  }

  const fieldIdx = countQuotes(trimmed);

  // Suppress when user types unquoted values (can't track position without quotes)
  if (fieldIdx === 0 && parts.length > 2) return null;

  const templateIdx = Math.floor(fieldIdx / 2);
  const inField = fieldIdx % 2 === 1;

  if (templateIdx >= template.length) return null;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- template guaranteed non-empty by earlier check
  const [, lastField] = template.at(-1)!;
  if (lastField === null && templateIdx >= template.length - 1 && !inField) {
    return null;
  }

  // Check if field has content already
  let hasFieldContent = false;
  if (inField) {
    const lastQuotePos = trimmed.lastIndexOf('"');
    if (lastQuotePos !== -1 && lastQuotePos < trimmed.length - 1) {
      hasFieldContent = true;
    }
  }

  // @ file prefix: swap first field placeholder from "text" → "file"
  const lastPart = parts.at(-1) ?? "";
  const atFilePrefix = templateIdx === 0 && lastPart.startsWith("@");

  const hintParts: string[] = [];
  for (let i = templateIdx; i < template.length; i++) {
    const [prefix, fname] = template[i];
    const effectiveName = i === 0 && atFilePrefix && fname === "text" ? "file" : fname;
    if (i === templateIdx && !inField && templateIdx > 0) {
      // User already typed closing quote — skip leading " from prefix
      const adjusted = prefix.startsWith('"') ? prefix.slice(1) : prefix;
      if (adjusted) hintParts.push(adjusted);
      if (effectiveName) hintParts.push(effectiveName);
    } else if (i === templateIdx && inField) {
      if (!hasFieldContent && effectiveName) {
        hintParts.push(effectiveName);
      }
    } else {
      hintParts.push(prefix);
      if (effectiveName) hintParts.push(effectiveName);
    }
  }

  const hint = hintParts.join("");
  return hint || null;
}
