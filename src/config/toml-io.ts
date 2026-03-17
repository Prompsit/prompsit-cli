// See API-436: TOML config file I/O with smol-toml
// TOML 1.0 compliant read/write for CLI settings.
// Diff-based write: only user-customized values are persisted.
// Absent keys round-trip as Zod defaults, so schema default changes
// propagate automatically without config migration.

import * as fs from "node:fs";
import * as smolToml from "smol-toml";
import { SettingsSchema, type Settings } from "./schemas.ts";
import { getConfigFile } from "./paths.ts";
import { atomicWriteFile } from "./file-utils.ts";

// Config format version. Bump when write format changes.
// v1 = full dump (all fields), v2 = overrides-only (diff vs defaults).
const CONFIG_VERSION = 2;

// v1 defaults that differ from v2. During migration, values matching
// these are treated as auto-generated (not user-set) and removed.
// Without this, old defaults (e.g. write_timeout=10) would persist
// as "overrides" since they differ from the new defaults (0).
const V1_STALE_DEFAULTS: Record<string, Record<string, unknown>> = {
  api: { timeout: 30, write_timeout: 10 },
  cli: { skill_sync: false },
};

/**
 * Read config.toml as raw TOML data (no Zod validation).
 * Used by `config show` to display actual file values without defaults.
 * Strips internal `_version` key from output.
 */
export function readRawToml(): Record<string, unknown> | null {
  const configPath = getConfigFile();
  if (!fs.existsSync(configPath)) return null;
  try {
    const parsed = smolToml.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
    delete parsed._version;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Read config.toml and return typed Settings with defaults.
 *
 * Pattern: Graceful degradation - missing/corrupt file returns Zod defaults.
 * Auto-migrates v1 (full-dump) configs to v2 (overrides-only) on first read.
 */
export function readConfigToml(): Settings {
  const configPath = getConfigFile();

  if (!fs.existsSync(configPath)) {
    return SettingsSchema.parse({});
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = smolToml.parse(raw);
    const settings = SettingsSchema.parse(parsed);

    // One-time migration: v1 full-dump -> v2 overrides-only.
    // Strips stale v1 defaults before writing, so schema changes propagate.
    if ((parsed._version as number | undefined) !== CONFIG_VERSION) {
      const migrated = stripStaleDefaults(settings);
      writeConfigToml(migrated);
    }

    return settings;
  } catch {
    return SettingsSchema.parse({});
  }
}

/**
 * Reset stale v1 auto-generated defaults back to current schema defaults.
 * Only runs during v1->v2 migration. If a value matches a known old default
 * that changed in v2, it is replaced with the current default.
 */
function stripStaleDefaults(settings: Settings): Settings {
  const defaults = SettingsSchema.parse({});
  const copy = structuredClone(settings);

  for (const [section, staleFields] of Object.entries(V1_STALE_DEFAULTS)) {
    const s = section as keyof Settings;
    for (const [key, staleValue] of Object.entries(staleFields)) {
      if ((copy[s] as Record<string, unknown>)[key] === staleValue) {
        (copy[s] as Record<string, unknown>)[key] = (defaults[s] as Record<string, unknown>)[key];
      }
    }
  }

  return copy;
}

/**
 * Compute overrides: values in settings that differ from schema defaults.
 * Only non-default, non-null values are returned (TOML has no null type).
 */
function computeOverrides(settings: Settings): Record<string, Record<string, unknown>> {
  const defaults = SettingsSchema.parse({});
  const result: Record<string, Record<string, unknown>> = {};

  for (const section of ["api", "cli", "telemetry"] as const) {
    const sectionOverrides: Record<string, unknown> = {};
    const sectionSettings = settings[section] as Record<string, unknown>;
    const sectionDefaults = defaults[section] as Record<string, unknown>;

    for (const [key, value] of Object.entries(sectionSettings)) {
      if (value === null || value === undefined) continue;
      if (value !== sectionDefaults[key]) {
        sectionOverrides[key] = value;
      }
    }

    if (Object.keys(sectionOverrides).length > 0) {
      result[section] = sectionOverrides;
    }
  }

  return result;
}

/**
 * Write Settings to config.toml atomically (overrides-only).
 *
 * Only values that differ from schema defaults are persisted.
 * Absent keys round-trip as Zod defaults, so changing a default
 * in schemas.ts propagates automatically to all users.
 */
export function writeConfigToml(settings: Settings): void {
  const configPath = getConfigFile();
  const overrides = computeOverrides(settings);

  const payload: Record<string, unknown> = { _version: CONFIG_VERSION, ...overrides };
  const tomlContent = smolToml.stringify(payload);
  atomicWriteFile(configPath, tomlContent);
}
