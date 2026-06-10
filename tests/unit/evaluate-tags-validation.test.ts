import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchTagsMode, type TagsOpts } from "../../src/commands/evaluate.ts";
import { terminal } from "../../src/output/index.ts";

// dispatchTagsMode rejects invalid --tags flag combinations before any network
// call, so these cases are deterministic and require no API access.
describe("eval --tags validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function captureError(): { codes: string[] } {
    const codes: string[] = [];
    vi.spyOn(terminal, "error").mockImplementation((code: string) => {
      codes.push(code);
    });
    return { codes };
  }

  it("rejects -r (tags are reference-free)", async () => {
    const captured = captureError();
    const opts: TagsOpts = {
      source: "Hello <b>x</b>",
      hypothesis: "Hola <b>x</b>",
      reference: "Hola <b>x</b>",
      metrics: "bleu,chrf",
    };
    await dispatchTagsMode([], opts, true);
    expect(captured.codes.length).toBe(1);
  });

  it("rejects @file inputs (no tags file endpoint)", async () => {
    const captured = captureError();
    const opts: TagsOpts = { metrics: "bleu,chrf" };
    await dispatchTagsMode(['@"corpus.tmx"'], opts, true);
    expect(captured.codes.length).toBe(1);
  });

  it("rejects non-tag sub-scores passed via -m", async () => {
    const captured = captureError();
    const opts: TagsOpts = { source: "a", hypothesis: "b", metrics: "bleu" };
    await dispatchTagsMode([], opts, false);
    expect(captured.codes.length).toBe(1);
  });
});
