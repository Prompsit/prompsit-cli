// Unit tests for src/runtime/browser.ts — cross-platform openBrowser utility.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks — available before module load
const cpMocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

const platformMock = vi.hoisted(() => ({
  getRuntimePlatform: vi.fn<() => string>(() => "win32"),
}));

vi.mock("node:child_process", () => ({
  execFileSync: cpMocks.execFileSync,
  spawn: cpMocks.spawn,
}));

vi.mock("../../src/runtime/platform.ts", () => ({
  getRuntimePlatform: platformMock.getRuntimePlatform,
}));

import { openBrowser } from "../../src/runtime/browser.ts";

/** Helper: make spawn return a fake child with controllable events. */
function fakeChild() {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    unref: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    /** Fire a registered event (e.g. "error"). */
    emit(event: string, ...args: unknown[]) {
      handlers[event]?.(...args);
    },
  };
}

describe("openBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("spawns cmd on win32", async () => {
    platformMock.getRuntimePlatform.mockReturnValue("win32");
    const child = fakeChild();
    cpMocks.spawn.mockReturnValue(child);

    const promise = openBrowser("https://example.com");
    vi.advanceTimersByTime(3000);
    const result = await promise;

    expect(result).toBe(true);
    expect(cpMocks.spawn).toHaveBeenCalledWith(
      "cmd",
      ["/c", "start", "", "https://example.com"],
      expect.objectContaining({ detached: true }),
    );
    expect(child.unref).toHaveBeenCalled();
  });

  it("spawns open on darwin", async () => {
    platformMock.getRuntimePlatform.mockReturnValue("darwin");
    const child = fakeChild();
    cpMocks.spawn.mockReturnValue(child);

    const promise = openBrowser("https://example.com");
    vi.advanceTimersByTime(3000);
    const result = await promise;

    expect(result).toBe(true);
    expect(cpMocks.spawn).toHaveBeenCalledWith(
      "open",
      ["https://example.com"],
      expect.objectContaining({ detached: true }),
    );
  });

  it("tries xdg-open first on linux", async () => {
    platformMock.getRuntimePlatform.mockReturnValue("linux");
    cpMocks.execFileSync.mockImplementation(() => Buffer.from(""));
    const child = fakeChild();
    cpMocks.spawn.mockReturnValue(child);

    const promise = openBrowser("https://example.com");
    vi.advanceTimersByTime(3000);
    const result = await promise;

    expect(result).toBe(true);
    expect(cpMocks.spawn).toHaveBeenCalledWith(
      "xdg-open",
      ["https://example.com"],
      expect.objectContaining({ detached: true }),
    );
  });

  it("falls back to wslview when xdg-open is missing", async () => {
    platformMock.getRuntimePlatform.mockReturnValue("linux");
    cpMocks.execFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === "xdg-open") throw new Error("not found");
      return Buffer.from("");
    });
    const child = fakeChild();
    cpMocks.spawn.mockReturnValue(child);

    const promise = openBrowser("https://example.com");
    vi.advanceTimersByTime(3000);
    const result = await promise;

    expect(result).toBe(true);
    expect(cpMocks.spawn).toHaveBeenCalledWith(
      "wslview",
      ["https://example.com"],
      expect.objectContaining({ detached: true }),
    );
  });

  it("returns false when no browser command found on linux", async () => {
    platformMock.getRuntimePlatform.mockReturnValue("linux");
    cpMocks.execFileSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const result = await openBrowser("https://example.com");

    expect(result).toBe(false);
    expect(cpMocks.spawn).not.toHaveBeenCalled();
  });

  it("returns false when spawn fires error event", async () => {
    platformMock.getRuntimePlatform.mockReturnValue("win32");
    const child = fakeChild();
    cpMocks.spawn.mockReturnValue(child);

    const promise = openBrowser("https://example.com");
    child.emit("error", new Error("ENOENT"));
    const result = await promise;

    expect(result).toBe(false);
  });

  it("returns false when spawn throws", async () => {
    platformMock.getRuntimePlatform.mockReturnValue("win32");
    cpMocks.spawn.mockImplementation(() => {
      throw new Error("spawn failed");
    });

    const result = await openBrowser("https://example.com");

    expect(result).toBe(false);
  });
});
