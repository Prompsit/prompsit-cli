import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecuteResult } from "../../src/repl/core/progress-types.ts";

const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn<(text: string) => Promise<ExecuteResult>>(),
  clearHint: vi.fn(),
  existsSync: vi.fn<(path: string) => boolean>(),
  mkdirSync: vi.fn(),
  appendFile: vi.fn<() => Promise<void>>(),
}));

vi.mock("../../src/repl/executor.ts", () => ({
  executeCommand: mocks.executeCommand,
}));

vi.mock("../../src/repl/ui/hint-state.ts", () => ({
  clearHint: mocks.clearHint,
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  mkdirSync: mocks.mkdirSync,
  promises: {
    appendFile: mocks.appendFile,
  },
}));

vi.mock("../../src/config/paths.ts", () => ({
  getConfigDir: () => "/tmp/prompsit-test",
}));

vi.mock("../../src/i18n/index.ts", () => ({
  t: (key: string) => (key === "repl.goodbye" ? "Goodbye" : key),
}));

import { outputBridge } from "../../src/repl/core/output-bridge.ts";
import { ReplService } from "../../src/repl/service.ts";

describe("ReplService edge cases", () => {
  beforeEach(() => {
    mocks.executeCommand.mockReset();
    mocks.clearHint.mockReset();
    mocks.existsSync.mockReset();
    mocks.mkdirSync.mockReset();
    mocks.appendFile.mockReset();

    mocks.existsSync.mockReturnValue(true);
    mocks.executeCommand.mockResolvedValue({ outcome: "continue" });
    mocks.appendFile.mockResolvedValue();

    outputBridge.removeAllListeners();
    outputBridge.disable();
    outputBridge.enable();
  });

  afterEach(() => {
    outputBridge.removeAllListeners();
    outputBridge.disable();
  });

  it("does not fail submit when history write throws", async () => {
    mocks.appendFile.mockRejectedValue(new Error("disk failure"));

    const service = new ReplService();
    const result = await service.submit("help");

    expect(result).toEqual({ kind: "executed", shouldContinue: true });
    expect(mocks.executeCommand).toHaveBeenCalledWith("help");

    await service.dispose();
  });

  it("buffers lines with unclosed quotes and executes on completion", async () => {
    const service = new ReplService();

    const first = await service.submit('translate "Hello');
    expect(first).toEqual({ kind: "await_more_input", reason: "unclosed_quote" });
    expect(service.isInContinuation()).toBe(true);
    expect(mocks.executeCommand).not.toHaveBeenCalled();

    const second = await service.submit('world" -s en -t fr');
    expect(second).toEqual({ kind: "executed", shouldContinue: true });
    expect(service.isInContinuation()).toBe(false);
    expect(mocks.executeCommand).toHaveBeenCalledWith('translate "Hello world" -s en -t fr');

    await service.dispose();
  });

  it("buffers lines with trailing backslash continuation", async () => {
    const service = new ReplService();

    const first = await service.submit("translate \\");
    expect(first).toEqual({ kind: "await_more_input", reason: "trailing_backslash" });

    const second = await service.submit('"hello" -s en');
    expect(second).toEqual({ kind: "executed", shouldContinue: true });
    expect(mocks.executeCommand).toHaveBeenCalledWith('translate "hello" -s en');

    await service.dispose();
  });

  it("discardBuffer clears accumulated lines", async () => {
    const service = new ReplService();

    await service.submit('translate "hello');
    expect(service.isInContinuation()).toBe(true);

    expect(service.discardBuffer()).toBe(true);
    expect(service.isInContinuation()).toBe(false);
    expect(service.discardBuffer()).toBe(false);

    await service.dispose();
  });
});
