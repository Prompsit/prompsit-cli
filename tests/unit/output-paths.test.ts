import { describe, expect, it } from "vitest";
import { basename } from "node:path";
import { resolveOutputPaths } from "../../src/runtime/file-args.ts";

// resolveOutputPaths owns all client-side output filename derivation (no server dependency):
// suffix application, format override, compound extensions, and collision disambiguation.
// Pure when no output dir is given (writes nothing) — exercised here without touching the API.
describe("resolveOutputPaths", () => {
  it("applies the suffix and preserves the input extension", () => {
    const [out] = resolveOutputPaths(["/data/sample.txt"], "_en-fr");
    expect(basename(out)).toBe("sample_en-fr.txt");
  });

  it("overrides the extension when extOverride is given", () => {
    const [out] = resolveOutputPaths(["/data/sample.txt"], "_scored", undefined, "csv");
    expect(basename(out)).toBe("sample_scored.csv");
  });

  it("handles compound extensions (.jsonl.zst)", () => {
    const [out] = resolveOutputPaths(["/data/corpus.jsonl.zst"], "_annotated");
    expect(basename(out)).toBe("corpus_annotated.jsonl.zst");
  });

  it("disambiguates colliding output names with a numeric suffix", () => {
    const outs = resolveOutputPaths(["/a/x.tmx", "/a/x.txt", "/a/x.jsonl"], "_s", undefined, "csv");
    expect(outs.map((p) => basename(p))).toEqual(["x_s.csv", "x_s_2.csv", "x_s_3.csv"]);
    expect(new Set(outs).size).toBe(outs.length);
  });

  it("places output beside each input by default (no output dir)", () => {
    const [out] = resolveOutputPaths(["/data/nested/sample.tmx"], "_evaluated", undefined, "csv");
    expect(out).toContain("nested");
    expect(basename(out)).toBe("sample_evaluated.csv");
  });
});
