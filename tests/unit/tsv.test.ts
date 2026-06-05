import { describe, expect, it } from "vitest";
import { renderTsvRows } from "../../src/output/tsv.ts";

describe("renderTsvRows", () => {
  it("sanitizes tabs, newlines, carriage returns, and ANSI escape sequences", () => {
    const output = renderTsvRows([
      ["a\tb", "c\nd", "e\rf", "\u001B[31mred\u001B[39m"],
      ["plain", "value", "", "last"],
    ]);

    expect(output).toBe("a b\tc d\te f\tred\nplain\tvalue\t\tlast");
  });
});
