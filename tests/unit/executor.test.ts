import { describe, expect, it, vi } from "vitest";
import { expandTilde, parseInput } from "../../src/repl/executor.ts";
import { validateArgOptionOrder } from "../../src/cli/arg-order.ts";

vi.mock("node:os", () => ({ homedir: () => "/home/test" }));

describe("expandTilde", () => {
  it.each([
    { input: "~", expected: "/home/test" },
    { input: "~/file.txt", expected: expect.stringContaining("file.txt") },
    { input: String.raw`~\file.txt`, expected: expect.stringContaining("file.txt") },
    { input: "~other/file", expected: "~other/file" },
    { input: "abc~def", expected: "abc~def" },
    { input: "-s", expected: "-s" },
    { input: "@~/file.txt", expected: expect.stringMatching(/^@.*file\.txt$/) },
    { input: "@~", expected: "@/home/test" },
  ])('expandTilde("$input")', ({ input, expected }) => {
    expect(expandTilde(input)).toEqual(expected);
  });
});

describe("parseInput", () => {
  it("preserves quoted tokens", () => {
    expect(parseInput('eval -s "Hello world" -h "Bonjour"')).toEqual([
      "eval",
      "-s",
      '"Hello world"',
      "-h",
      '"Bonjour"',
    ]);
  });

  it("preserves tilde tokens", () => {
    expect(parseInput("translate ~/.prompsit/examples/translate/sample.txt -s en")).toEqual([
      "translate",
      "~/.prompsit/examples/translate/sample.txt",
      "-s",
      "en",
    ]);
  });

  it("preserves backslashes in unquoted Windows paths", () => {
    expect(parseInput(String.raw`translate C:\Users\file.txt -s en`)).toEqual([
      "translate",
      String.raw`C:\Users\file.txt`,
      "-s",
      "en",
    ]);
  });

  it("preserves backslashes in quoted Windows paths", () => {
    expect(parseInput(String.raw`translate "C:\Users\file.txt" -s en`)).toEqual([
      "translate",
      String.raw`"C:\Users\file.txt"`,
      "-s",
      "en",
    ]);
  });

  it("handles escaped quotes inside quoted strings", () => {
    expect(parseInput(String.raw`translate "say \"hello\"" -s en`)).toEqual([
      "translate",
      String.raw`"say "hello""`,
      "-s",
      "en",
    ]);
  });

  it("tokenizes @-prefixed quoted paths as single tokens", () => {
    expect(parseInput('translate @"sample.txt" -s "en" -t "fr"')).toEqual([
      "translate",
      '@"sample.txt"',
      "-s",
      '"en"',
      "-t",
      '"fr"',
    ]);
  });

  it("preserves @ in option values as distinct tokens", () => {
    expect(parseInput('eval -s "@alice" -h "Hola" -r "Hola"')).toEqual([
      "eval",
      "-s",
      '"@alice"',
      "-h",
      '"Hola"',
      "-r",
      '"Hola"',
    ]);
  });
});

describe("validateArgOptionOrder", () => {
  const boolFlags = new Set(["--qe"]);

  it.each([
    { args: ["Hello", "World", "-s", "en", "-t", "es"], expected: null },
    { args: ["Hello", "--qe", "-s", "en", "-t", "es"], expected: null },
    { args: ["-s", "en", "-t", "es", "--", "Hello"], expected: null },
    { args: ["-s", "en", "Hello", "-t", "ca"], expected: "Hello" },
    { args: ["Hello", "-s", "en", "World", "-t", "es"], expected: "World" },
  ])("validateArgOptionOrder($args) -> $expected", ({ args, expected }) => {
    expect(validateArgOptionOrder(args, boolFlags)).toBe(expected);
  });
});
