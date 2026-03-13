// See API-436: Config directory and file path utilities
// Resolves config paths with mkdir -p behavior.
// E2E and automation can override the base directory via PROMPSIT_DATA_DIR.

import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Get config directory path.
 *
 * Resolution order:
 * 1) PROMPSIT_DATA_DIR (for tests/automation isolation)
 * 2) ~/.prompsit (default)
 *
 * Creates directory if missing (mkdir -p behavior)
 */
export function getConfigDir(): string {
  const configuredDir = process.env.PROMPSIT_DATA_DIR?.trim();
  const configDir =
    configuredDir && configuredDir.length > 0
      ? path.resolve(configuredDir)
      : path.join(os.homedir(), ".prompsit");

  // Create directory if missing (recursive: true creates parent dirs)
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  return configDir;
}

/**
 * Get config file path (~/.prompsit/config.toml)
 */
export function getConfigFile(): string {
  return path.join(getConfigDir(), "config.toml");
}

/**
 * Get credentials file path (~/.prompsit/credentials.json)
 * Used by T004 (Credential Store)
 */
export function getCredsFile(): string {
  return path.join(getConfigDir(), "credentials.json");
}
