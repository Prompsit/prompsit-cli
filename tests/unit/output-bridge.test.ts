import { afterEach, describe, expect, it, vi } from "vitest";

async function loadBridge(options?: {
  requestAnimationFrame?: (cb: (time: number) => void) => number;
  cancelAnimationFrame?: (id: number) => void;
}) {
  vi.resetModules();
  vi.unstubAllGlobals();

  if (options?.requestAnimationFrame) {
    vi.stubGlobal("requestAnimationFrame", options.requestAnimationFrame);
  }
  if (options?.cancelAnimationFrame) {
    vi.stubGlobal("cancelAnimationFrame", options.cancelAnimationFrame);
  }

  const mod = await import("../../src/repl/core/output-bridge.ts");
  return mod.outputBridge;
}

describe("outputBridge batching", () => {
  let bridge: Awaited<ReturnType<typeof loadBridge>> | null = null;

  afterEach(() => {
    if (bridge) {
      bridge.removeAllListeners();
      bridge.disable();
      bridge = null;
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("preserves all items and their order through batching", async () => {
    vi.useFakeTimers();
    bridge = await loadBridge();
    bridge.enable();

    const allItems: { id: number; event: { text?: string } }[] = [];
    bridge.on("outputBatch", (items: { id: number; event: { text?: string } }[]) => {
      allItems.push(...items);
    });

    for (let i = 0; i < 100; i++) {
      bridge.write(`line-${i}`);
    }

    vi.advanceTimersByTime(16);

    expect(allItems).toHaveLength(100);
    expect(allItems[0]?.event.text).toBe("line-0");
    expect(allItems[99]?.event.text).toBe("line-99");
  });

  it("flushNow emits pending output synchronously", async () => {
    vi.useFakeTimers();
    bridge = await loadBridge();
    bridge.enable();

    const batches: { id: number; event: { text?: string } }[][] = [];
    bridge.on("outputBatch", (items: { id: number; event: { text?: string } }[]) => {
      batches.push(items);
    });

    bridge.write("alpha");
    bridge.write("beta");
    expect(batches).toHaveLength(0);

    bridge.flushNow();
    expect(batches).toHaveLength(1);
    expect(batches[0].map((item) => item.event.text)).toEqual(["alpha", "beta"]);
  });

  it("preserves typed command events for history rendering", async () => {
    vi.useFakeTimers();
    bridge = await loadBridge();
    bridge.enable();

    const batches: { id: number; event: { kind: string; text?: string } }[][] = [];
    bridge.on("outputBatch", (items: { id: number; event: { kind: string; text?: string } }[]) => {
      batches.push(items);
    });

    bridge.write({
      kind: "command",
      timestamp: 1,
      stream: "stdout",
      level: "info",
      text: "help",
    });
    bridge.flushNow();

    expect(batches).toHaveLength(1);
    expect(batches[0][0]?.event.kind).toBe("command");
    expect(batches[0][0]?.event.text).toBe("help");
  });

  it("clear drops pending batch and history", async () => {
    vi.useFakeTimers();
    bridge = await loadBridge();
    bridge.enable();

    const batches: { id: number; event: { text?: string } }[][] = [];
    bridge.on("outputBatch", (items: { id: number; event: { text?: string } }[]) => {
      batches.push(items);
    });

    bridge.write("to-be-cleared");
    bridge.clear();
    vi.advanceTimersByTime(16);

    expect(batches).toHaveLength(0);
    expect(bridge.getHistory()).toHaveLength(0);
  });

  it("disable cancels pending scheduled flush", async () => {
    vi.useFakeTimers();
    bridge = await loadBridge();
    bridge.enable();

    const batches: { id: number; event: { text?: string } }[][] = [];
    bridge.on("outputBatch", (items: { id: number; event: { text?: string } }[]) => {
      batches.push(items);
    });

    bridge.write("pending");
    bridge.disable();
    vi.advanceTimersByTime(16);

    expect(batches).toHaveLength(0);
    expect(bridge.getHistory()).toHaveLength(0);
  });

  it("disable cancels scheduled flush on RAF-capable environments", async () => {
    const rafCallbacks = new Map<number, (time: number) => void>();
    let nextId = 1;

    bridge = await loadBridge({
      requestAnimationFrame: vi.fn((cb: (time: number) => void) => {
        const id = nextId++;
        rafCallbacks.set(id, cb);
        return id;
      }),
      cancelAnimationFrame: vi.fn((id: number) => {
        rafCallbacks.delete(id);
      }),
    });
    bridge.enable();

    const items: { id: number; event: { text?: string } }[] = [];
    bridge.on("outputBatch", (batch: { id: number; event: { text?: string } }[]) => {
      items.push(...batch);
    });

    bridge.write("should-not-arrive");
    bridge.disable();
    // Trigger any pending RAF callbacks that weren't cancelled
    for (const cb of rafCallbacks.values()) cb(0);

    expect(items).toHaveLength(0);
  });

});
