// See API-434: Zod Config Schemas & Defaults

/**
 * Preset API base URLs
 */
export const API_URL_PRESETS = {
  test: "https://edge.prompsit.com",
  local: "http://localhost:8080",
} as const;

/**
 * Preset Loki telemetry URLs (resolved from API preset)
 */
export const LOKI_URL_PRESETS = {
  test: "https://edge.prompsit.com/loki",
  local: "http://localhost:3100",
} as const;

/**
 * Push-only key for Loki telemetry (write access to /loki/api/v1/push only).
 * Resolved from PROMPSIT_TELEMETRY__LOKI_KEY env var; empty string disables push.
 */
export const LOKI_KEY_PRESETS = {
  test: process.env.PROMPSIT_TELEMETRY__LOKI_KEY ?? "",
} as const;

/**
 * Default API URL preset name
 */
export const DEFAULT_API_URL_PRESET = "test" as const;

/**
 * Token expiry buffer in seconds (proactive refresh)
 */
export const TOKEN_EXPIRY_BUFFER = 60;
