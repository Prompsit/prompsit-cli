// See API-446, API-468, API-476, API-489, API-492, API-493: Zod API Response Models
// Schema-first design: schemas define both runtime validation and TypeScript types.
// Phase 1 (US003): TokenResponse + HealthResponse. Phase 2 (US008): Translation schemas. Phase 3 (US012): Evaluation schemas. Phase 4 (US011): Engine/Format schemas. Phase 5 (US010): Job schemas. Phase 6 (US009): DocJobCreateResponse. Phase 7 (US013): Data Processing schemas.

import { z } from "zod";

/**
 * Token response from /token endpoint.
 *
 * Fields:
 * - access_token: JWT access token (required)
 * - refresh_token: JWT refresh token (nullable)
 * - token_type: Token type (default "Bearer")
 * - expires_in: Access token TTL in seconds (nullable)
 * - refresh_expires_in: Refresh token TTL in seconds (nullable)
 *
 * Pattern: z.object() (lenient) — server may add fields (e.g. "plan").
 */
export const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().nullable(),
  token_type: z.string().default("Bearer"),
  expires_in: z.number().nullable(),
  refresh_expires_in: z.number().nullable().optional(),
  plan: z.string().optional(),
});

/**
 * Health check response from /health endpoint.
 *
 * Fields:
 * - status: Overall health status string (e.g., "healthy" | "unhealthy")
 * - database: Database connection status
 * - redis: Redis connection/fallback status
 * - services: External services status record
 * - version: API version string
 * - timestamp: Response timestamp ISO 8601
 *
 * Matches app/schemas/health.py in prompsit-api.
 */
export const ServiceHealthInfoSchema = z.object({
  status: z.string(),
  version: z.string().nullable().optional(),
  missing_env: z.array(z.string()).nullable().optional(),
});

export const HealthResponseSchema = z.object({
  status: z.string(),
  database: z.string(),
  redis: z.string(),
  services: z.record(z.string(), ServiceHealthInfoSchema),
  version: z.string(),
  timestamp: z.string(),
});

// --- Translation schemas (Phase 2: US008) ---

/**
 * Single translation item from API response.
 *
 * Fields:
 * - translated_text: The translated text (required)
 * - latency_ms: Translation latency in milliseconds (nullable)
 * - quality_score: QE score 0-1 when enable_qe=true (nullable)
 * - tag_alignment_method: Tag alignment method e.g. "neural" (nullable)
 *
 * Pattern: z.object() rejects unknown keys (strict schema contract).
 */
export const TranslationItemSchema = z.object({
  translated_text: z.string(),
  latency_ms: z.number().nullable(),
  quality_score: z.number().nullable(),
  tag_alignment_method: z.string().nullable(),
});

/**
 * Translation response from POST /v1/translation.
 *
 * Fields:
 * - translations: Array of TranslationItem results
 * - source_lang: Confirmed source language code
 * - target_lang: Confirmed target language code
 * - engine: Engine used for translation (nullable)
 * - total_latency_ms: Total request latency in milliseconds (nullable)
 *
 * Pattern: z.object() rejects unknown keys (strict schema contract).
 */
export const TranslationResponseSchema = z.object({
  translations: z.array(TranslationItemSchema),
  source_lang: z.string(),
  target_lang: z.string(),
  engine: z.string().nullable(),
  total_latency_ms: z.number().nullable(),
});

// --- Evaluation schemas (US012) ---

/**
 * A source/hypothesis/reference triplet for quality evaluation.
 *
 * Fields:
 * - source: Original source text (required)
 * - hypothesis: Machine-translated text (required)
 * - reference: Human reference translation (required)
 *
 * Pattern: z.object() rejects unknown keys (strict schema contract).
 */
export const SegmentSchema = z.object({
  source: z.string(),
  hypothesis: z.string(),
  reference: z.string(),
});

/**
 * Evaluation response from POST /v1/quality/score.
 *
 * Fields:
 * - corpus_scores: Aggregated scores per metric e.g. {"bleu": 0.42} (nullable)
 * - segment_scores: Per-segment scores per metric e.g. {"bleu": [0.4, 0.5]} (nullable)
 * - segment_count: Number of evaluated segments (default 0)
 *
 * Pattern: z.object() rejects unknown keys (strict schema contract).
 */
export const EvaluationResponseSchema = z.object({
  corpus_scores: z.record(z.string(), z.number()).nullable(),
  segment_scores: z.record(z.string(), z.array(z.number())).nullable(),
  segment_count: z.number().default(0),
});

// --- Engine & Format schemas (US011) ---

/** Per-engine metadata (APT package info). */
export const EngineDetailSchema = z.object({
  package: z.string().nullish(),
  package_version: z.string().nullish(),
});

/**
 * Language pair detail from GET /v1/translation/languages.
 *
 * Fields:
 * - source/target: BCP 47 language codes
 * - source_name/target_name: Human-readable names
 * - engines: Dict keyed by engine name → EngineDetail metadata
 */
export const LanguagePairDetailSchema = z.object({
  source: z.string(),
  source_name: z.string(),
  target: z.string(),
  target_name: z.string(),
  engines: z.record(z.string(), EngineDetailSchema),
});

/** Unified format info for all discovery endpoints. */
export const FormatInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  extensions: z.array(z.string()),
  output_formats: z.array(z.string()),
});

/** Unified response wrapper for all format discovery endpoints. */
export const FormatsResponseSchema = z.object({
  formats: z.array(FormatInfoSchema),
  total: z.number(),
});

// --- Job schemas (US010) ---

/**
 * Job status response from GET /v1/jobs/{job_id}.
 *
 * Fields:
 * - job_id: Unique job identifier (required)
 * - status: Job lifecycle status e.g. "pending", "completed" (required)
 * - progress_percentage: Completion percentage 0-100 (default 0)
 * - current_step: Current processing step e.g. "deformat", "translate" (nullable)
 * - error_message: Error description when status=failed (nullable)
 * - output_format: Output format e.g. "docx" for PDF input (nullable)
 * - warnings: Array of warning messages (nullable)
 * - chars_translated: Number of characters translated (nullable)
 * - translation_requests_count: Number of translation API calls made (nullable)
 * - created_at: Job creation timestamp ISO 8601 (nullable)
 * - started_at: Job start timestamp ISO 8601 (nullable)
 * - completed_at: Job completion timestamp ISO 8601 (nullable)
 *
 * Pattern: z.object() rejects unknown keys (strict schema contract).
 */
export const JobStatusResponseSchema = z.object({
  job_id: z.string(),
  status: z.string(),
  progress_percentage: z.number().default(0),
  current_step: z.string().nullable(),
  error_message: z.string().nullable(),
  output_format: z.string().nullable(),
  warnings: z.array(z.string()).nullable(),
  chars_translated: z.number().nullable(),
  translation_requests_count: z.number().nullable(),
  created_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  result_url: z.string().nullable().default(null),
});

// --- Document Translation Job schema (US009) ---

/**
 * Job creation response from POST /v1/translation/document.
 *
 * Fields:
 * - job_id: Unique job identifier (required)
 * - status: Initial job status (default "pending")
 * - job_type: Type of job e.g. "translation" (default "translation")
 *
 * Pattern: z.object() rejects unknown keys (strict schema contract).
 */
export const DocJobCreateResponseSchema = z.object({
  job_id: z.string(),
  status: z.string().default("pending"),
  job_type: z.string().default("translation"),
});

/** Single language entry from GET /v1/data/score/languages. */
export const ScoreLanguageSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/** Response from GET /v1/data/score/languages. */
export const DataScoreLanguagesResponseSchema = z.object({
  languages: z.array(ScoreLanguageSchema),
  total: z.number(),
  default: z.string(),
});

export type DataScoreLanguagesResponse = z.infer<typeof DataScoreLanguagesResponseSchema>;

// --- Data Processing schemas (US013) ---

/**
 * Job creation response from multipart upload endpoints.
 * Returned by POST /v1/data/annotate and POST /v1/data/score.
 *
 * Fields:
 * - job_id: Unique job identifier for async tracking (required)
 * - retry_after: Suggested polling interval in seconds (nullable, default null)
 *
 * Pattern: z.object() rejects unknown keys (strict schema contract).
 */
export const DataJobCreateResponseSchema = z.object({
  job_id: z.string(),
  retry_after: z.number().nullable().default(null),
});

// --- User Usage schemas ---

/** Tier configuration from GET /v1/user/usage. */
export const TierInfoSchema = z.object({
  name: z.string(),
  chars_daily_limit: z.number(),
  corpus_bytes_daily_limit: z.number(),
  rpm_limit: z.number(),
  segment_limit: z.number().nullable(),
});

/** Daily character usage (translation + QE pool) from GET /v1/user/usage. */
export const DailyUsageSchema = z.object({
  chars_used: z.number(),
  chars_limit: z.number(),
  percentage: z.number(),
  reset_at: z.string(),
});

/** Daily corpus byte usage (annotation pool) from GET /v1/user/usage. */
export const CorpusUsageSchema = z.object({
  bytes_used: z.number(),
  bytes_limit: z.number(),
  percentage: z.number(),
  reset_at: z.string(),
});

/** Subscription info from GET /v1/user/usage. */
export const SubscriptionInfoSchema = z.object({
  active: z.boolean(),
  start_date: z.string(),
  end_date: z.string().nullable(),
});

/**
 * User usage response from GET /v1/user/usage.
 *
 * Two usage pools:
 * - daily_usage: character usage (translation + QE)
 * - corpus_usage: byte usage (annotation)
 *
 * Matches app/schemas/user.py in prompsit-api.
 */
export const UserUsageResponseSchema = z.object({
  tier: TierInfoSchema,
  daily_usage: DailyUsageSchema,
  corpus_usage: CorpusUsageSchema,
  subscription: SubscriptionInfoSchema,
});

// --- Input DTOs for resource methods (camelCase, separate from wire-format Zod schemas) ---

/** Input for TranslationResource.translate() */
export interface TranslateParams {
  texts: string[];
  sourceLang: string;
  targetLang: string;
  enableQe?: boolean;
}

/** Input for TranslationResource.uploadDocument() */
export interface UploadDocumentParams {
  filePath: string;
  sourceLang: string;
  targetLang: string;
  outputFormat?: string;
}

/** Input for EvaluationResource.evaluate() */
export interface EvaluateParams {
  segments: Segment[];
  metrics: string[];
  aggregation?: string;
}

/** Input for EvaluationResource.evaluateFile() */
export interface EvaluateFileParams {
  filePath: string;
  metrics?: string[];
  aggregation?: string;
  outputFormat?: string;
}

/** Result from EvaluationResource.evaluateFile() — binary scored file + metadata */
export interface EvaluateFileResult {
  data: Buffer;
  filename: string;
  corpusScores: Record<string, number>;
}

/** Input for DataResource.score() */
export interface ScoreParams {
  sourceFile: string;
  targetFile?: string;
  outputFormat?: string;
  sourceLang?: string;
}

/** Input for DataResource.annotate() */
export interface AnnotateParams {
  filePath: string;
  lang: string;
  pipeline?: string[];
  minLen?: number;
  minAvgWords?: number;
  lidModel: string;
}

/**
 * Inferred TypeScript types from Zod schemas.
 * Single source of truth: types automatically match schema definitions.
 */
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type TranslationResponse = z.infer<typeof TranslationResponseSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;
export type LanguagePairDetail = z.infer<typeof LanguagePairDetailSchema>;
export type FormatInfo = z.infer<typeof FormatInfoSchema>;
export type FormatsResponse = z.infer<typeof FormatsResponseSchema>;
export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;
export type DocJobCreateResponse = z.infer<typeof DocJobCreateResponseSchema>;
export type DataJobCreateResponse = z.infer<typeof DataJobCreateResponseSchema>;
export type UserUsageResponse = z.infer<typeof UserUsageResponseSchema>;
