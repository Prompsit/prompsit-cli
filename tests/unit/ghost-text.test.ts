import { describe, it, expect } from "vitest";
import { computeGhostText } from "../../src/repl/input/ghost-text.ts";
import { completer, getTemplateSuggestion } from "../../src/repl/input/completer.ts";

describe("computeGhostText", () => {
  it("returns remaining chars for command prefix match", () => {
    // "eva" -> top match "eval" -> ghost "l"
    const result = computeGhostText(["eva"], 0, 3);
    expect(result).toBe("l");
  });

  it("returns template hint for exact command match", () => {
    // "score" exact match → show template with leading space
    const result = computeGhostText(["score"], 0, 5);
    expect(result).toBeTypeOf("string");
    expect(result).toBe(' @"file"'); // leading space + @"file" template
  });

  it("returns template hint after command with space", () => {
    const result = computeGhostText(["eval "], 0, 5);
    expect(result).toBeTypeOf("string");
    expect(result).toMatch(/^@"/);
  });

  it("returns remaining template after closed field", () => {
    // 'eval @"hello"' — closing quote typed, even fieldIdx
    // Leading " of next prefix is skipped (already typed as closing quote)
    const input = 'eval @"hello"';
    const result = computeGhostText([input], 0, input.length);
    expect(result).toBeTypeOf("string");
    expect(result).toMatch(/^ -m "/);
  });

  it("returns template hint when inside quotes with content", () => {
    // 'eval @"hel' — cursor at end shows closing quote + rest
    const input = 'eval @"hel';
    const result = computeGhostText([input], 0, input.length);
    expect(result).toBeTypeOf("string");
    expect(result).toMatch(/^" -m "/);
  });

  it("returns null for unquoted args", () => {
    // User typed without quotes — ghost can't track position
    const input = "translate input.xliff -s en -t es";
    expect(computeGhostText([input], 0, input.length)).toBeNull();
  });

  it("returns null for multiline input", () => {
    expect(computeGhostText(["eval", " -s"], 0, 4)).toBeNull();
  });

  it("returns null when cursor is not at end of line", () => {
    expect(computeGhostText(["eval"], 0, 2)).toBeNull();
  });

  it("returns null for unrecognized command", () => {
    expect(computeGhostText(["xyz"], 0, 3)).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(computeGhostText([""], 0, 0)).toBeNull();
  });
});

// ── completer (fuzzyScore ranking) ──────────────────────────────────

describe("completer", () => {
  it("exact match ranks first", () => {
    const [completions] = completer("help");
    expect(completions[0]).toBe("help");
  });

  it("prefix matches sorted alphabetically", () => {
    // "he" prefix-matches "health" and "help"
    const [completions] = completer("he");
    expect(completions).toContain("health");
    expect(completions).toContain("help");
    expect(completions.indexOf("health")).toBeLessThan(completions.indexOf("help"));
  });

  it("contains match requires 2+ chars", () => {
    // "al" is contained in "eval" and "translate"
    const [completions] = completer("al");
    expect(completions).toContain("eval");
  });

  it("subsequence match requires 2+ chars", () => {
    // "tl" → t...l...a...t...e in "translate"
    const [completions] = completer("tl");
    expect(completions).toContain("translate");
  });

  it("single char only does prefix match, no fuzzy", () => {
    // "x" has no prefix match in any command
    const [completions] = completer("x");
    expect(completions).toEqual([]);
  });

  it("empty input returns empty", () => {
    const [completions] = completer("");
    expect(completions).toEqual([]);
  });

  it("input with space returns empty (first-word-only guard)", () => {
    const [completions] = completer("help foo");
    expect(completions).toEqual([]);
  });

  it("ranks exact match before prefix match", () => {
    // "eval" is exact match (score 0) — must always be first
    const [completions] = completer("eval");
    expect(completions[0]).toBe("eval");
  });
});

// ── getTemplateSuggestion ───────────────────────────────────────────

describe("getTemplateSuggestion", () => {
  it("returns null for command without trailing space", () => {
    expect(getTemplateSuggestion("translate")).toBeNull();
  });

  it("returns null for unknown command", () => {
    expect(getTemplateSuggestion("unknown ")).toBeNull();
  });

  it("returns first field hint after command + space", () => {
    const hint = getTemplateSuggestion("eval ");
    expect(hint).toBe('@"file" -m "metrics"');
  });

  it("returns null when all template fields are filled", () => {
    // eval template: ['@"', file], ['" -m "', metrics], ['"', null]
    // 4 quotes → fieldIdx=4, templateIdx=2 (last segment has null field + terminates)
    const hint = getTemplateSuggestion('eval @"sample.tmx" -m "bleu"');
    expect(hint).toBeNull();
  });

  it("shows remaining fields after first field is closed", () => {
    // 2 quotes → fieldIdx=2, templateIdx=1 (second segment)
    // Leading " of prefix is skipped (user already typed closing quote)
    const hint = getTemplateSuggestion('eval @"sample.tmx"');
    expect(hint).toBe(' -m "metrics"');
  });

  it("returns null for empty input", () => {
    expect(getTemplateSuggestion("")).toBeNull();
  });

  it("suppresses hint for unquoted multi-word args", () => {
    // fieldIdx=0 (no quotes) + parts.length > 2 → null
    expect(getTemplateSuggestion("eval foo bar baz")).toBeNull();
  });

  it("swaps 'text' to 'file' when @ prefix is detected", () => {
    const hint = getTemplateSuggestion("translate @");
    expect(hint).toBe('"file" -s "src" -t "tgt"');
  });

  it("shows 'file' placeholder inside @-prefixed quote", () => {
    // translate @" → inside field, no content yet → show "file" placeholder
    const hint = getTemplateSuggestion('translate @"');
    expect(hint).toBe('file" -s "src" -t "tgt"');
  });
});
