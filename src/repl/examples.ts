/**
 * Bundled example files deployed to ~/.prompsit/examples/<command>/.
 *
 * Each command gets its own subdirectory so that directory-mode examples
 * (e.g. translate @"~/.prompsit/examples/translate/") only pick up
 * files relevant to that command.
 *
 * Re-copies when CLI version OR layout structure changes
 * (version marker in ~/.prompsit/examples/.version).
 */

import { existsSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getConfigDir } from "../config/paths.ts";
import { getVersion } from "../shared/version.ts";

/** Map of command subdirectory → files to deploy. */
const EXAMPLE_LAYOUT: Readonly<Record<string, readonly string[]>> = {
  translate: ["sample.txt", "sample.csv", "sample.xliff"],
  evaluate: ["sample.tmx"],
  score: ["sample.tmx"],
  annotate: ["sample.jsonl"],
};

/** Bump when EXAMPLE_LAYOUT structure changes (subdirs, filenames). */
const LAYOUT_VERSION = "2";

const VERSION_MARKER = ".version";

/** @returns Absolute path to ~/.prompsit/examples/ directory. */
function getExamplesDir(): string {
  return join(getConfigDir(), "examples");
}

/**
 * Copy bundled examples to ~/.prompsit/examples/<command>/.
 *
 * On version mismatch (or first run), overwrites all example files
 * and updates the version marker. Returns the examples directory path.
 */
export function ensureExamples(): string {
  const dest = getExamplesDir();
  const markerPath = join(dest, VERSION_MARKER);
  const stamp = `${getVersion()}\n${LAYOUT_VERSION}`;

  // Fast path: examples already up-to-date (version + layout match)
  if (existsSync(markerPath) && readFileSync(markerPath, "utf8").trim() === stamp.trim()) {
    return dest;
  }

  // Clean old layout (flat files from previous versions) before re-deploying
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  // Resolve bundled examples relative to compiled output
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const srcDir = join(thisDir, "../../examples");

  for (const [subdir, files] of Object.entries(EXAMPLE_LAYOUT)) {
    const destSubdir = join(dest, subdir);
    mkdirSync(destSubdir, { recursive: true });
    for (const name of files) {
      const source = join(srcDir, subdir, name);
      const target = join(destSubdir, name);
      if (existsSync(source)) {
        copyFileSync(source, target);
      }
    }
  }

  writeFileSync(markerPath, stamp, "utf8");
  return dest;
}
