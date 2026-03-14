// See API-436: TOML config file I/O with smol-toml
// TOML 1.0 compliant read/write for CLI settings.

import * as fs from "node:fs";
import * as smolToml from "smol-toml";
import { SettingsSchema, type Settings } from "./schemas.ts";
import { getConfigFile } from "./paths.ts";
import { atomicWriteFile } from "./file-utils.ts";

/**
 * Read config.toml as raw TOML data (no Zod validation).
 * Used by `config show` to display actual file values without defaults.
 */
export function readRawToml(): Record<string, unknown> | null {
  const configPath = getConfigFile();
  if (!fs.existsSync(configPath)) return null;
  try {
    return smolToml.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Read config.toml and return typed Settings with defaults
 *
 * Pattern: Graceful degradation - missing/corrupt file returns Zod defaults
 *
 * @returns Settings with all fields (Zod fills missing with defaults)
 */
export function readConfigToml(): Settings {
  const configPath = getConfigFile();

  // Missing file → return defaults (creates ~/.prompsit/ dir as side effect)
  if (!fs.existsSync(configPath)) {
    return SettingsSchema.parse({});
  }

  try {
    // Parse TOML + validate through Zod
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = smolToml.parse(raw);
    return SettingsSchema.parse(parsed);
  } catch {
    // Corrupt TOML → log warning and return defaults (no crash)
    return SettingsSchema.parse({});
  }
}

/**
 * Strip null/undefined values before TOML serialization.
 * TOML 1.0 has no null type — absent keys round-trip as Zod defaults.
 */
function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    result[key] =
      typeof value === "object" && !Array.isArray(value)
        ? stripNulls(value as Record<string, unknown>)
        : value;
  }
  return result;
}

/**
 * Write Settings to config.toml atomically
 *
 * Pattern: Atomic write (temp-file + rename) prevents partial writes
 * Output is TOML v1.0.0 compatible.
 *
 * @param settings - Settings object to serialize
 */
export function writeConfigToml(settings: Settings): void {
  const configPath = getConfigFile();

  // Serialize to TOML (preserves section order: api, cli, telemetry)
  // stripNulls: nullable fields (e.g. skill_sync=null) become absent TOML keys
  const tomlContent = smolToml.stringify(
    stripNulls({ api: settings.api, cli: settings.cli, telemetry: settings.telemetry })
  );

  // Atomic write via temp-file + rename
  atomicWriteFile(configPath, tomlContent);
}
