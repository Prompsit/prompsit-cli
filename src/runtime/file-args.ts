// Shared file/directory argument resolution and output path computation.
// Used by all file-accepting commands (translate, evaluate, annotate/score).

import { accessSync, mkdirSync, readdirSync, statSync, constants as fsConstants } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

/**
 * Custom error for file argument validation failures.
 * Commands catch this and route through failCommand().
 */
export class FileArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileArgError";
  }
}

/**
 * Expand a list of file/directory paths into a flat list of resolved file paths.
 *
 * Directories are expanded non-recursively. Hidden files (starting with '.')
 * and subdirectories are skipped. Each file is validated for read access.
 * Results are sorted alphabetically for deterministic order.
 *
 * @throws FileArgError on inaccessible file or empty directory
 */
export function expandFileArgs(paths: string[]): string[] {
  // Tolerate @ prefix for consistency (score "@corpus.tmx" works like score "corpus.tmx")
  const cleaned = paths.map((p) => (p.startsWith("@") && p.length > 1 ? p.slice(1) : p));
  const result: string[] = [];

  for (const p of cleaned) {
    const resolved = resolve(p);
    let stat;
    try {
      stat = statSync(resolved);
    } catch {
      throw new FileArgError(`File not found: ${resolved}`);
    }

    if (stat.isDirectory()) {
      const entries = readdirSync(resolved, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && !e.name.startsWith("."))
        .map((e) => join(resolved, e.name))
        .toSorted();

      if (files.length === 0) {
        throw new FileArgError(`Directory contains no files: ${resolved}`);
      }

      for (const f of files) {
        accessSync(f, fsConstants.R_OK);
      }
      result.push(...files);
    } else {
      accessSync(resolved, fsConstants.R_OK);
      result.push(resolved);
    }
  }

  return result;
}

/** Result of tryExpandFileArgs — discriminated union to preserve error message. */
export type ExpandResult = { ok: true; files: string[] } | { ok: false; message: string };

/** Safe wrapper: returns error message instead of throwing FileArgError. */
export function tryExpandFileArgs(paths: string[]): ExpandResult {
  try {
    return { ok: true, files: expandFileArgs(paths) };
  } catch (error) {
    if (error instanceof FileArgError) return { ok: false, message: error.message };
    throw error;
  }
}

/** Safe wrapper for matchDirectoryPairs — returns error message instead of throwing. */
export function tryMatchDirectoryPairs(
  sourceDir: string,
  targetDir: string
): { ok: true; pairs: [string, string][] } | { ok: false; message: string } {
  try {
    return { ok: true, pairs: matchDirectoryPairs(sourceDir, targetDir) };
  } catch (error) {
    if (error instanceof FileArgError) return { ok: false, message: error.message };
    throw error;
  }
}

/**
 * Match files from source and target directories by filename.
 * Both directories must contain files with the same names.
 *
 * @returns Array of [sourcePath, targetPath] pairs, sorted by filename.
 * @throws FileArgError if source files have no matching target
 */
export function matchDirectoryPairs(
  sourceDir: string,
  targetDir: string
): [source: string, target: string][] {
  const sourceFiles = expandFileArgs([sourceDir]);
  const targetFiles = expandFileArgs([targetDir]);

  const targetMap = new Map(targetFiles.map((f) => [basename(f), f]));
  const pairs: [string, string][] = [];
  const missing: string[] = [];

  for (const src of sourceFiles) {
    const name = basename(src);
    const tgt = targetMap.get(name);
    if (tgt) {
      pairs.push([src, tgt]);
      targetMap.delete(name);
    } else {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new FileArgError(`No matching target file(s) for: ${missing.join(", ")}`);
  }

  // Extra targets are not an error — log at caller level if needed
  return pairs.toSorted((a, b) => basename(a[0]).localeCompare(basename(b[0])));
}

/** Compound extensions that extname() cannot parse correctly. */
const COMPOUND_EXTS = [".jsonl.zst", ".jsonl.gz", ".tar.gz", ".tar.zst"];

/**
 * Split filename into base and extension, handling compound extensions.
 * Node's extname(".jsonl.zst") returns ".zst" — this handles the full ".jsonl.zst".
 */
function splitExtension(filename: string): [base: string, ext: string] {
  for (const ce of COMPOUND_EXTS) {
    if (filename.endsWith(ce)) return [filename.slice(0, -ce.length), ce];
  }
  const ext = extname(filename);
  return [basename(filename, ext), ext];
}

/**
 * Compute output paths for a list of input files.
 *
 * Client owns all naming — no server-side filename dependency.
 * Handles compound extensions (.jsonl.zst) and collision disambiguation.
 *
 * @param files - Resolved input file paths
 * @param suffix - Output suffix (e.g. "_eng-spa", "_scored", "_annotated")
 * @param outputDir - Output directory from -o flag (default: beside input file)
 * @param extOverride - Override output extension (e.g. "jsonl.zst", "docx")
 */
export function resolveOutputPaths(
  files: string[],
  suffix: string,
  outputDir?: string,
  extOverride?: string
): string[] {
  if (outputDir) {
    mkdirSync(resolve(outputDir), { recursive: true });
  }

  const paths: string[] = [];
  const seen = new Map<string, number>();

  for (const filePath of files) {
    const [inputBase, inputExt] = splitExtension(basename(filePath));
    const dir = outputDir ? resolve(outputDir) : dirname(filePath);
    const outExt = extOverride ? `.${extOverride}` : inputExt;

    let targetPath = join(dir, `${inputBase}${suffix}${outExt}`);

    // Disambiguate collisions
    const count = seen.get(targetPath) ?? 0;
    if (count > 0) {
      const [tBase, tExt] = splitExtension(basename(targetPath));
      targetPath = join(dirname(targetPath), `${tBase}_${count + 1}${tExt}`);
    }
    seen.set(targetPath, count + 1);
    paths.push(targetPath);
  }

  return paths;
}
