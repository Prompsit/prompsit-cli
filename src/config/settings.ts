// See API-438: Settings singleton with env override, CLI key map, and Loki resolver

import {
  ApiConfigSchema,
  CliConfigSchema,
  SettingsSchema,
  TelemetryConfigSchema,
  type Settings,
} from "./schemas.ts";
import { readConfigToml } from "./toml-io.ts";
import { parseEnvOverrides } from "./env-parser.ts";
import { API_URL_PRESETS, LOKI_URL_PRESETS, LOKI_KEY_PRESETS } from "./constants.ts";

// Module-level singleton cache
let cached: Settings | null = null;
let diagnostics: string[] = [];

export function getSettingsDiagnostics(): string[] {
  return [...diagnostics];
}

/**
 * Get raw environment override snapshot (PROMPSIT_*).
 * Exposed so command layer can consume env-source metadata without parsing env directly.
 */
export function getEnvOverridesSnapshot(): Record<string, unknown> {
  return parseEnvOverrides("PROMPSIT_", "__");
}

/**
 * Get settings singleton with config precedence: env > TOML > defaults
 *
 * Pattern: Singleton with explicit invalidation
 *
 * @returns Settings instance (cached after first call)
 */
export function getSettings(): Settings {
  if (cached) return cached;
  diagnostics = [];

  // Step 1: Read TOML config
  const tomlConfig = readConfigToml();

  // Step 2: Parse env overrides
  const envOverrides = getEnvOverridesSnapshot();

  // Step 3: Deep merge (env wins over TOML)
  const merged = deepMerge(tomlConfig, envOverrides);

  // Step 4: Validate with Zod (safeParse for graceful degradation)
  const result = SettingsSchema.safeParse(merged);

  if (result.success) {
    cached = result.data;
  } else {
    diagnostics = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    });
    cached = SettingsSchema.parse(tomlConfig);
  }

  return cached;
}

/**
 * Reload settings (clears cache, re-reads TOML + env)
 *
 * Pattern: Explicit cache invalidation
 *
 * @returns Fresh Settings instance
 */
export function reloadSettings(): Settings {
  cached = null;
  diagnostics = [];
  return getSettings();
}

/**
 * Deep merge two objects (second overrides first)
 *
 * Pattern: Recursive merge for nested config sections
 */
// Type guard for plain objects (non-array, non-null)
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = structuredClone(target);

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    // eslint-disable-next-line unicorn/prefer-ternary -- ternary hurts readability here
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      // Recursive merge for nested objects — both narrowed to Record<string, unknown> by isPlainObject
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Partial<Record<string, unknown>>
      ) as T[Extract<keyof T, string>];
    } else {
      // Direct override for primitives and arrays
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

// ===== CLI Key Map =====

type CliKeyMap = Record<string, [string, string]>; // "api-base-url" -> ["api", "base_url"]

let cliKeyMapCache: CliKeyMap | null = null;

/**
 * Build CLI key map from Zod schema field names
 *
 * Pattern: Auto-generate kebab-case CLI keys from snake_case fields
 * Maps: "api-base-url" -> ["api", "base_url"]
 */
export function buildCliKeyMap(): CliKeyMap {
  if (cliKeyMapCache) return cliKeyMapCache;

  const map: CliKeyMap = {};

  // Auto-derive field lists from Zod schema shapes (prevents schema-vs-keymap drift)
  const sections: { schema: { shape: Record<string, unknown> }; prefix: string }[] = [
    { schema: ApiConfigSchema, prefix: "api-" },
    { schema: CliConfigSchema, prefix: "" },
    { schema: TelemetryConfigSchema, prefix: "telemetry-" },
  ];

  for (const { schema, prefix } of sections) {
    const sectionKey = prefix ? prefix.slice(0, -1) : "cli"; // "api-" -> "api", "" -> "cli"
    for (const field of Object.keys(schema.shape)) {
      const cliKey = field.replaceAll("_", "-"); // snake_case -> kebab-case
      map[`${prefix}${cliKey}`] = [sectionKey, field];
    }
  }

  cliKeyMapCache = map;
  return map;
}

/**
 * Get config value by CLI key
 *
 * @param cliKey - CLI key (e.g., "api-base-url", "show-curl")
 * @returns Config value or undefined if key not found
 */
export function getConfigValue(cliKey: string): unknown {
  const settings = getSettings();
  const map = buildCliKeyMap();
  const path = map[cliKey] as [string, string] | undefined;

  if (!path) return undefined;
  const [section, field] = path;
  const sectionObj = settings[section as keyof Settings] as Record<string, unknown>;
  return sectionObj[field];
}

/**
 * Set config value by CLI key (with type coercion)
 *
 * @param cliKey - CLI key (e.g., "show-curl")
 * @param value - String value to coerce
 */
export function setConfigValue(cliKey: string, value: string): void {
  const settings = getSettings();
  const map = buildCliKeyMap();
  const path = map[cliKey] as [string, string] | undefined;

  if (!path) {
    throw new Error(`Unknown CLI key: ${cliKey}`);
  }
  const [section, field] = path;
  const sectionObj = settings[section as keyof Settings] as Record<string, unknown>;
  const currentValue = sectionObj[field];
  // Type coercion based on current value type
  let coercedValue: string | number | boolean = value;
  if (typeof currentValue === "boolean") {
    coercedValue = value === "true";
  } else if (typeof currentValue === "number") {
    const numValue = Number(value);
    if (Number.isNaN(numValue)) {
      throw new TypeError(`Invalid number value for ${cliKey}: ${value}`);
    }
    coercedValue = numValue;
  }

  sectionObj[field] = coercedValue;
}

/**
 * Get all valid CLI keys
 */
export function getValidConfigKeys(): string[] {
  return Object.keys(buildCliKeyMap());
}

// ===== Loki Preset Resolver (inline helper) =====

/**
 * Resolve Loki URL and key from API preset
 *
 * Pattern: Simple map lookup, inline helper (~10 lines)
 *
 * @param settings - Settings instance
 * @returns { url, key } or null for custom API URLs
 */
// Type guard for preset keys shared across API/Loki maps
function isPresetKey(key: string): key is keyof typeof LOKI_URL_PRESETS {
  return key in LOKI_URL_PRESETS;
}

export function resolveLokiPreset(settings: Settings): { url: string; key: string } | null {
  const apiUrl = settings.api.base_url;

  // Match API URL to preset
  for (const [preset, presetUrl] of Object.entries(API_URL_PRESETS)) {
    if (apiUrl === presetUrl && isPresetKey(preset)) {
      const lokiUrl = LOKI_URL_PRESETS[preset];
      const lokiKey =
        preset in LOKI_KEY_PRESETS ? LOKI_KEY_PRESETS[preset as keyof typeof LOKI_KEY_PRESETS] : "";
      return { url: lokiUrl, key: lokiKey };
    }
  }

  // Custom API URL → no Loki preset
  return null;
}
