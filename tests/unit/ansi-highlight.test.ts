import { describe, expect, it } from "vitest";
import {
  applyHighlight,
  readAnsiCodeAt,
  normalizeSelection,
  SEL_ON,
  SEL_OFF,
} from "../../src/repl/ui/selection-utils.ts";

// ── readAnsiCodeAt ──────────────────────────────────────────────────

describe("readAnsiCodeAt", () => {
  it("parses valid CSI SGR code at position 0", () => {
    expect(readAnsiCodeAt("\u001B[31m", 0)).toBe("\u001B[31m");
  });

  it("parses reverse video code", () => {
    expect(readAnsiCodeAt("\u001B[7m", 0)).toBe("\u001B[7m");
  });

  it("parses multi-param SGR (e.g. bold+color)", () => {
    expect(readAnsiCodeAt("\u001B[1;31m", 0)).toBe("\u001B[1;31m");
  });

  it("returns null for plain text", () => {
    expect(readAnsiCodeAt("hello", 0)).toBeNull();
  });

  it("parses at non-zero index", () => {
    expect(readAnsiCodeAt("x\u001B[31m", 1)).toBe("\u001B[31m");
  });

  it("returns null for non-SGR CSI (e.g. cursor move)", () => {
    // \x1b[2J is erase display — ends with 'J', not 'm'
    expect(readAnsiCodeAt("\u001B[2J", 0)).toBeNull();
  });

  it("returns null for truncated sequence (no terminator)", () => {
    expect(readAnsiCodeAt("\u001B[31", 0)).toBeNull();
  });
});

// ── applyHighlight ──────────────────────────────────────────────────

describe("applyHighlight", () => {
  it("highlights a range in plain text", () => {
    // "hello" with cols 1-3 → h[SEL]el[/SEL]lo
    const result = applyHighlight("hello", 1, 3);
    expect(result).toBe(`h${SEL_ON}el${SEL_OFF}lo`);
  });

  it("highlights entire line", () => {
    const result = applyHighlight("hello", 0, 5);
    expect(result).toBe(`${SEL_ON}hello${SEL_OFF}`);
  });

  it("auto-closes highlight when colEnd exceeds line length", () => {
    const result = applyHighlight("ab", 0, 10);
    expect(result).toBe(`${SEL_ON}ab${SEL_OFF}`);
  });

  it("skips ANSI codes in position counting", () => {
    // "\x1b[31mred\x1b[0m" — 3 visible chars: r(0) e(1) d(2)
    const input = "\u001B[31mred\u001B[0m";
    const result = applyHighlight(input, 0, 3);
    // SEL_ON at visible pos 0, then "red", then \x1b[0m (reset) is an ANSI code
    // so it passes through before SEL_OFF auto-closes at end
    expect(result).toBe(`\u001B[31m${SEL_ON}red\u001B[0m${SEL_OFF}`);
  });

  it("highlights mid-range within ANSI-colored text", () => {
    // "\x1b[31mabcd\x1b[0m" — highlight visible cols 1-3 (b,c)
    const input = "\u001B[31mabcd\u001B[0m";
    const result = applyHighlight(input, 1, 3);
    expect(result).toBe(`\u001B[31ma${SEL_ON}bc${SEL_OFF}d\u001B[0m`);
  });

  it("produces no highlight when colStart equals colEnd", () => {
    // Empty range: SEL_ON immediately followed by SEL_OFF at same position
    const result = applyHighlight("test", 2, 2);
    expect(result).toBe(`te${SEL_ON}${SEL_OFF}st`);
  });
});

// ── normalizeSelection ──────────────────────────────────────────────

describe("normalizeSelection", () => {
  it("keeps forward selection unchanged", () => {
    const sel = { start: { row: 0, col: 0 }, end: { row: 2, col: 5 } };
    expect(normalizeSelection(sel)).toEqual(sel);
  });

  it("swaps backward multi-row selection", () => {
    const sel = { start: { row: 2, col: 5 }, end: { row: 0, col: 0 } };
    const result = normalizeSelection(sel);
    expect(result.start).toEqual({ row: 0, col: 0 });
    expect(result.end).toEqual({ row: 2, col: 5 });
  });

  it("swaps backward same-row selection", () => {
    const sel = { start: { row: 1, col: 10 }, end: { row: 1, col: 2 } };
    const result = normalizeSelection(sel);
    expect(result.start).toEqual({ row: 1, col: 2 });
    expect(result.end).toEqual({ row: 1, col: 10 });
  });

  it("keeps zero-width (point) selection unchanged", () => {
    const sel = { start: { row: 1, col: 5 }, end: { row: 1, col: 5 } };
    expect(normalizeSelection(sel)).toEqual(sel);
  });
});
