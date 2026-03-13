// See API-436: Atomic file write utility (temp + rename pattern)
// Prevents partial writes on crash or concurrent access

import * as fs from "node:fs";
import * as path from "node:path";
import { FILE_MODE_OWNER_RW } from "../shared/constants.ts";
import { getConfigFile } from "./paths.ts";

/**
 * Atomic file write using temp-file + rename pattern
 *
 * Pattern: write to .tmp file in same directory, then rename over target
 * Atomic on most filesystems for same-volume operations (POSIX + Windows)
 *
 * @param filePath - Target file path
 * @param content - Content to write (string or Buffer)
 */
export function atomicWriteFile(filePath: string, content: string | Buffer): void {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  const tmpPath = path.join(dir, `.${basename}.tmp`);

  try {
    // Step 1: Write to temp file
    fs.writeFileSync(tmpPath, content, { encoding: "utf8", mode: FILE_MODE_OWNER_RW, flush: true });

    // Step 2: Atomic rename (replaces target if exists)
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    // Cleanup temp file if rename failed
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
    throw error;
  }
}

/** Delete config.toml if it exists. */
export function deleteConfigFile(): void {
  fs.rmSync(getConfigFile(), { force: true });
}
