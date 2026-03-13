import { describe, expect, it } from "vitest";
import { isInAtFileContext } from "../../src/repl/input/autocomplete-provider.ts";

describe("isInAtFileContext", () => {
  it("detects unclosed @\" at cursor position", () => {
    expect(isInAtFileContext('translate @"', 12)).toBe(true);
  });

  it("detects unclosed @\" with partial path", () => {
    expect(isInAtFileContext('translate @"docs/', 17)).toBe(true);
  });

  it("detects cursor before closing quote (directory completion)", () => {
    // pi-tui places cursor before closing " after directory completion
    expect(isInAtFileContext('translate @"docs/"', 17)).toBe(true);
  });

  it("returns false when cursor is after closing quote", () => {
    expect(isInAtFileContext('translate @"docs/"', 18)).toBe(false);
  });

  it("returns false for closed file reference with trailing space", () => {
    expect(isInAtFileContext('translate @"file.txt" ', 21)).toBe(false);
  });

  it("returns false when no @\" pattern exists", () => {
    expect(isInAtFileContext("hello", 5)).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isInAtFileContext("", 0)).toBe(false);
  });
});
