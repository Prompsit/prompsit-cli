import { z } from "zod";
import { API_URL_PRESETS, DEFAULT_API_URL_PRESET } from "./constants.ts";

const LOOPBACK_HOSTS = new Set(["localhost", "[::1]"]);

function isAllowedApiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    if (LOOPBACK_HOSTS.has(url.hostname)) return true;
    return /^127(?:\.[0-9]{1,3}){3}$/u.test(url.hostname);
  } catch {
    return false;
  }
}

export const ApiBaseUrlSchema = z.string().refine(isAllowedApiUrl, {
  message: "API URL must use HTTPS; HTTP is allowed only for loopback hosts",
});

/**
 * API configuration section schema
 */
export const ApiConfigSchema = z.object({
  base_url: ApiBaseUrlSchema.default(API_URL_PRESETS[DEFAULT_API_URL_PRESET]),
  timeout: z.number().int().min(0).default(0),
  connect_timeout: z.number().min(0).default(5),
  write_timeout: z.number().min(0).default(0),
  retry_attempts: z.number().int().min(0).default(3),
  retry_max: z.number().min(0).default(10),
  rate_limit_max_wait: z.number().int().min(0).default(300),
  warmup_timeout: z.number().int().min(0).default(120),
});

/**
 * CLI behavior configuration section schema
 */
export const CliConfigSchema = z.object({
  contact_url: z.string().default("https://prompsit.com/en/contact"),
  feedback_url: z.string().default("https://github.com/Prompsit/prompsit-cli/issues"),
  batch_size: z.number().int().min(1).default(50),
  progress_threshold: z.number().int().min(0).default(10),
  language: z.string().default("en"),
  log_level: z
    .string()
    .default("warn")
    .transform((v): "debug" | "info" | "warn" | "error" => {
      const map: Record<string, "debug" | "info" | "warn" | "error"> = {
        debug: "debug",
        info: "info",
        warn: "warn",
        error: "error",
      };
      return map[v.toLowerCase()] ?? "warn";
    }),
  show_curl: z.boolean().default(false),
  job_tracking_strategy: z.enum(["auto", "sse", "polling"]).default("auto"),
  file_concurrency: z.number().int().min(1).max(10).default(3),
  job_timeout: z.number().int().min(0).default(600),
  skill_sync: z.boolean().nullable().default(null),
});

/**
 * Remote error telemetry configuration schema
 *
 * Loki URL is resolved automatically from the active API preset
 * (test -> edge.prompsit.com/loki, local -> localhost:3100).
 * Custom API URLs disable telemetry (no Loki URL to resolve).
 */
export const TelemetryConfigSchema = z.object({
  enabled: z.boolean().default(false),
  loki_key: z.string().default(""),
  loki_timeout: z.number().min(0).default(3),
});

/**
 * Composite settings schema with all config sections
 */
export const SettingsSchema = z.object({
  api: ApiConfigSchema.default(() => ApiConfigSchema.parse({})),
  cli: CliConfigSchema.default(() => CliConfigSchema.parse({})),
  telemetry: TelemetryConfigSchema.default(() => TelemetryConfigSchema.parse({})),
});

/**
 * Inferred TypeScript types from Zod schemas
 */
export type Settings = z.infer<typeof SettingsSchema>;
