import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchTagsMode, type TagsOpts } from "../../src/commands/evaluate.ts";
import { terminal } from "../../src/output/index.ts";
import { ErrorCode } from "../../src/errors/codes.ts";
import { t } from "../../src/i18n/index.ts";

// dispatchTagsMode rejects invalid --tags flag combinations before any network
// call, so these cases are deterministic and require no API access. Each case must
// reject for the *specific* documented reason — asserting only the error count would
// let a wrong-but-single error code pass.
describe("eval --tags validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function captureError(): { codes: string[]; messages: string[] } {
    const codes: string[] = [];
    const messages: string[] = [];
    vi.spyOn(terminal, "error").mockImplementation((code: string, message?: string) => {
      codes.push(code);
      messages.push(message ?? "");
    });
    return { codes, messages };
  }

  it("rejects -r with the reference-free error (tags are reference-free)", async () => {
    const captured = captureError();
    const opts: TagsOpts = {
      source: "Hello <b>x</b>",
      hypothesis: "Hola <b>x</b>",
      reference: "Hola <b>x</b>",
      metrics: "bleu,chrf",
    };
    await dispatchTagsMode([], opts, true);
    expect(captured.codes).toEqual([ErrorCode.VALIDATION]);
    expect(captured.messages[0]).toBe(t("validate.evaluate.tags_no_reference"));
  });

  it("rejects @file inputs with the no-file error (no tags file endpoint)", async () => {
    const captured = captureError();
    const opts: TagsOpts = { metrics: "bleu,chrf" };
    await dispatchTagsMode(['@"corpus.tmx"'], opts, true);
    expect(captured.codes).toEqual([ErrorCode.VALIDATION]);
    expect(captured.messages[0]).toBe(t("validate.evaluate.tags_no_file"));
  });

  it("rejects non-tag sub-scores passed via -m with the invalid-subscores error", async () => {
    const captured = captureError();
    const opts: TagsOpts = { source: "a", hypothesis: "b", metrics: "bleu" };
    await dispatchTagsMode([], opts, false);
    expect(captured.codes).toEqual([ErrorCode.CANCELLED]);
    expect(captured.messages[0]).toContain(t("evaluate.invalid_subscores"));
  });
});
