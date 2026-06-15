import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTsvFile, parseTagsTsvFile } from "../../src/commands/evaluate.ts";
import { terminal } from "../../src/output/index.ts";

// Inbound corpus parsing for eval file mode: 3-col (source, hypothesis, reference) and
// 2-col tags (source, hypothesis). Ragged rows and empty input must fail (return null)
// rather than silently mis-aligning columns.
describe("TSV corpus parsing", () => {
  let dir: string;
  let counter = 0;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "prompsit-tsv-"));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function write(content: string): string {
    const path = join(dir, `c${counter++}.tsv`);
    writeFileSync(path, content, "utf8");
    return path;
  }

  function silenceError(): void {
    vi.spyOn(terminal, "error").mockImplementation(() => {});
  }

  it("parses a valid 3-column TSV into segments", async () => {
    const path = write("hola\thello\thi there\nadios\tbye\tgoodbye\n");
    const rows = await parseTsvFile(path);
    expect(rows).toEqual([
      { source: "hola", hypothesis: "hello", reference: "hi there" },
      { source: "adios", hypothesis: "bye", reference: "goodbye" },
    ]);
  });

  it("skips blank lines", async () => {
    const path = write("hola\thello\thi\n\n   \nadios\tbye\tgoodbye\n");
    const rows = await parseTsvFile(path);
    expect(rows).toHaveLength(2);
  });

  it("returns null on a ragged row (wrong column count)", async () => {
    silenceError();
    const path = write("hola\thello\thi\nadios\tbye\n"); // 2nd row has 2 cols, expected 3
    expect(await parseTsvFile(path)).toBeNull();
  });

  it("returns null on an empty file", async () => {
    silenceError();
    const path = write("\n   \n");
    expect(await parseTsvFile(path)).toBeNull();
  });

  it("parses a valid 2-column tags TSV (reference-free)", async () => {
    const path = write("hola <b>x</b>\thello <b>x</b>\n");
    const rows = await parseTagsTsvFile(path);
    expect(rows).toEqual([{ source: "hola <b>x</b>", hypothesis: "hello <b>x</b>" }]);
  });

  it("returns null when a tags row has 3 columns (expected 2)", async () => {
    silenceError();
    const path = write("hola\thello\textra\n");
    expect(await parseTagsTsvFile(path)).toBeNull();
  });
});
