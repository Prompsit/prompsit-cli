import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn<(p: string) => boolean>(),
  readFileSync: vi.fn<(p: string, enc: string) => string>(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  mkdirSync: mocks.mkdirSync,
  readFileSync: mocks.readFileSync,
}));

// Must import after mocks
const { CommandHistory } = await import("../../src/repl/history/command-history.ts");

describe("CommandHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no history file
    mocks.existsSync.mockReturnValue(false);
  });

  it("navigates up/down through entries and preserves draft", () => {
    mocks.existsSync.mockReturnValue(false);
    const h = new CommandHistory();

    // Add entries
    h.add("help");
    h.add("translate hello");
    h.add("status");

    // UP from "typing..." draft
    expect(h.navigateUp("typing...")).toBe("status");
    expect(h.navigateUp("typing...")).toBe("translate hello");
    expect(h.navigateUp("typing...")).toBe("help");
    // At boundary
    expect(h.navigateUp("typing...")).toBeNull();

    // DOWN back through
    expect(h.navigateDown()).toBe("translate hello");
    expect(h.navigateDown()).toBe("status");
    // Past end: returns saved draft
    expect(h.navigateDown()).toBe("typing...");
    // Already reset
    expect(h.navigateDown()).toBeNull();

    // Empty history UP
    const h2 = new CommandHistory();
    expect(h2.navigateUp("x")).toBeNull();

    // Consecutive dedup: adding "status" twice does nothing (already last)
    h.add("status");
    h.add("status");
    expect(h.navigateUp("")).toBe("status");
    expect(h.navigateUp("")).toBe("translate hello");
    expect(h.navigateUp("")).toBe("help");
  });

  it("loads from file, filtering comments and consecutive dupes", () => {
    mocks.existsSync.mockReturnValue(true);
    mocks.readFileSync.mockReturnValue(
      [
        "# 2026-02-16 session start",
        "help",
        "help",       // consecutive dupe — filtered
        "translate hi",
        "",            // empty line — filtered
        "# comment",   // comment — filtered
        "translate hi", // consecutive dupe — filtered
        "status",
      ].join("\n")
    );

    const h = new CommandHistory();

    // Should have: help, translate hi, status (3 entries after dedup + filtering)
    expect(h.navigateUp("")).toBe("status");
    expect(h.navigateUp("")).toBe("translate hi");
    expect(h.navigateUp("")).toBe("help");
    expect(h.navigateUp("")).toBeNull();
  });
});
