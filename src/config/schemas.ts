// See API-434: Zod Config Schemas & Defaults

import { z } from "zod";
import { API_URL_PRESETS, DEFAULT_API_URL_PRESET } from "./constants.ts";

/**
 * API configuration section schema
 */
export const ApiConfigSchema = z.object({
  base_url: z.string().default(API_URL_PRESETS[DEFAULT_API_URL_PRESET]),
  timeout: z.number().int().default(0),
  connect_timeout: z.number().default(5),
  write_timeout: z.number().default(0),
  retry_attempts: z.number().int().default(3),
  retry_max: z.number().default(10),
  rate_limit_max_wait: z.number().int().default(300),
  warmup_timeout: z.number().int().min(0).default(120),
});

/**
 * CLI behavior configuration section schema
 */
export const CliConfigSchema = z.object({
  contact_url: z.string().default("https://prompsit.com/en/contact"),
  batch_size: z.number().int().default(50),
  progress_threshold: z.number().int().default(10),
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
  loki_timeout: z.number().default(3),
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
