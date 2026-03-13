import { describe, expect, it } from "vitest";
import { checkCompleteness, countQuotes } from "../../src/repl/input/analyzer.ts";

describe("countQuotes", () => {
  it("returns 0 for text without quotes", () => {
    expect(countQuotes("hello world")).toBe(0);
  });

  it("counts unescaped quotes correctly", () => {
    expect(countQuotes('"hello" "world"')).toBe(4);
  });

  it("skips escaped quotes", () => {
    expect(countQuotes(String.raw`he said \"hello\"`)).toBe(0);
  });

  it("handles mixed escaped and unescaped", () => {
    expect(countQuotes(String.raw`"hello \"world\""`)).toBe(2);
  });

  it("handles trailing backslash without quote", () => {
    expect(countQuotes('"hello\\')).toBe(1);
  });
});

describe("checkCompleteness", () => {
  it("complete for balanced quotes", () => {
    expect(checkCompleteness('translate "hello world" -s en')).toEqual({
      complete: true,
    });
  });

  it("incomplete for unclosed quote", () => {
    expect(checkCompleteness('translate "hello')).toEqual({
      complete: false,
      reason: "unclosed_quote",
    });
  });

  it("incomplete for trailing backslash", () => {
    expect(checkCompleteness("translate \\")).toEqual({
      complete: false,
      reason: "trailing_backslash",
    });
  });

  it("trailing backslash takes priority over unclosed quotes", () => {
    // Backslash checked first
    expect(checkCompleteness('"hello \\')).toEqual({
      complete: false,
      reason: "trailing_backslash",
    });
  });

  it("complete for escaped quotes only", () => {
    expect(checkCompleteness(String.raw`say \"hello\"`)).toEqual({ complete: true });
  });

  it("trailing backslash with whitespace after it still detected", () => {
    expect(checkCompleteness(String.raw`hello \   `)).toEqual({
      complete: false,
      reason: "trailing_backslash",
    });
  });
});
