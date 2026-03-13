import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InputContext } from "../../src/repl/input/input-handler.ts";

// ── Mocks ───────────────────────────────────────────────────────────

// pi-tui: matchesKey must return false for keyboard checks so SGR mouse path is reached
vi.mock("@mariozechner/pi-tui", () => ({
  matchesKey: () => false,
  Key: { ctrl: () => "", f8: "", escape: "" },
}));

vi.mock("../../src/repl/ui/hint-state.ts", () => ({
  showStatusHint: vi.fn(),
}));

vi.mock("../../src/api/curl.ts", () => ({
  isCurlEnabled: () => false,
}));

vi.mock("../../src/repl/ui/curl-store.ts", () => ({
  getRawCurl: () => null,
}));

vi.mock("../../src/i18n/index.ts", () => ({
  t: (key: string) => key,
}));

const { createInputListener } = await import("../../src/repl/input/input-handler.ts");

// ── Helpers ─────────────────────────────────────────────────────────

function buildCtx(overrides?: Partial<InputContext>): InputContext {
  return {
    isInSettingsMode: false,
    editor: null,
    historyComponent: {
      scroll: vi.fn(),
      clearSelection: vi.fn(),
      startSelection: vi.fn(),
      extendSelection: vi.fn(),
      endSelection: vi.fn(),
      getSelectedText: vi.fn(() => ""),
    },
    settingsInterceptor: null,
    computeHistoryMaxLines: () => 10,
    requestRender: vi.fn(),
    writeToClipboard: vi.fn(() => Promise.resolve(true)),
    pasteFromClipboard: vi.fn(),
    closeSettings: vi.fn(),
    onCtrlC: vi.fn(),
    onEsc: vi.fn(),
    ...overrides,
  };
}

/** Build SGR mouse escape sequence. M=press, m=release. */
function sgr(btn: number, x: number, y: number, press: boolean): string {
  // SGR is 1-indexed
  return `\u001B[<${btn};${x + 1};${y + 1}${press ? "M" : "m"}`;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("SGR mouse: scroll", () => {
  let ctx: InputContext;
  let listener: ReturnType<typeof createInputListener>;

  beforeEach(() => {
    ctx = buildCtx();
    listener = createInputListener(ctx);
  });

  it("wheel up (btn=64) scrolls history up by 3", () => {
    listener(sgr(64, 0, 0, true));
    expect(ctx.historyComponent?.scroll).toHaveBeenCalledWith(3);
  });

  it("wheel down (btn=65) scrolls history down by -3", () => {
    listener(sgr(65, 0, 0, true));
    expect(ctx.historyComponent?.scroll).toHaveBeenCalledWith(-3);
  });
});

describe("SGR mouse: selection", () => {
  let ctx: InputContext;
  let listener: ReturnType<typeof createInputListener>;

  beforeEach(() => {
    ctx = buildCtx({ computeHistoryMaxLines: () => 10 });
    listener = createInputListener(ctx);
  });

  it("left press in history starts selection (1-indexed to 0-indexed conversion)", () => {
    // Click at terminal position (10, 3) → code converts to (9, 2)
    listener(sgr(0, 9, 2, true));
    expect(ctx.historyComponent?.clearSelection).toHaveBeenCalled();
    expect(ctx.historyComponent?.startSelection).toHaveBeenCalledWith(2, 9);
  });

  it("drag (btn=32) in history extends selection", () => {
    listener(sgr(32, 14, 2, true));
    expect(ctx.historyComponent?.extendSelection).toHaveBeenCalledWith(2, 14);
  });

  it("left release ends selection", () => {
    listener(sgr(0, 9, 2, false));
    expect(ctx.historyComponent?.endSelection).toHaveBeenCalledWith(2, 9);
  });

  it("left press outside history area clears selection", () => {
    // y=15, maxLines=10 → outside history
    listener(sgr(0, 5, 15, true));
    expect(ctx.historyComponent?.clearSelection).toHaveBeenCalled();
    expect(ctx.historyComponent?.startSelection).not.toHaveBeenCalled();
  });
});

describe("SGR mouse: right click", () => {
  it("right click with selected text copies to clipboard", () => {
    const ctx = buildCtx();
    (ctx.historyComponent?.getSelectedText as ReturnType<typeof vi.fn>).mockReturnValue("selected text");
    const listener = createInputListener(ctx);

    listener(sgr(2, 5, 2, true));

    expect(ctx.writeToClipboard).toHaveBeenCalledWith("selected text");
    expect(ctx.historyComponent?.clearSelection).toHaveBeenCalled();
  });

  it("right click copy triggers requestRender after async clipboard resolves", async () => {
    const ctx = buildCtx();
    (ctx.historyComponent?.getSelectedText as ReturnType<typeof vi.fn>).mockReturnValue("async text");
    const listener = createInputListener(ctx);

    listener(sgr(2, 5, 2, true));
    // Let microtask queue flush (the .then() callback)
    await vi.waitFor(() => {
      // requestRender called at least twice: once synchronously for mouse, once in .then()
      expect(ctx.requestRender).toHaveBeenCalledTimes(2);
    });
  });

  it("right click without selection pastes from clipboard", () => {
    const ctx = buildCtx();
    const listener = createInputListener(ctx);

    listener(sgr(2, 5, 2, true));

    expect(ctx.pasteFromClipboard).toHaveBeenCalled();
  });
});

describe("SGR mouse: always calls requestRender", () => {
  it("requestRender is called after any mouse event", () => {
    const ctx = buildCtx();
    const listener = createInputListener(ctx);

    listener(sgr(64, 0, 0, true)); // scroll
    expect(ctx.requestRender).toHaveBeenCalled();
  });

  it("consumes all SGR mouse events", () => {
    const ctx = buildCtx();
    const listener = createInputListener(ctx);

    const result = listener(sgr(0, 5, 5, true));
    expect(result).toEqual({ consume: true });
  });

  it("handles malformed SGR gracefully (no crash, no side effects)", () => {
    const ctx = buildCtx();
    const listener = createInputListener(ctx);

    // Malformed: regex in handleSgrMouse won't match, early return
    expect(() => listener("\u001B[<invalid")).not.toThrow();
    // No scroll/selection calls made on malformed input
    expect(ctx.historyComponent?.scroll).not.toHaveBeenCalled();
    expect(ctx.historyComponent?.startSelection).not.toHaveBeenCalled();
  });
});
