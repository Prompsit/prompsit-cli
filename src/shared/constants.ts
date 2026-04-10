// Centralized constants for the Prompsit CLI (TypeScript port).
// Single source of truth for magic strings, numbers, and enum-like objects.

// --- Job lifecycle statuses ---

export const JobStatus = {
  PENDING: "pending",
  RUNNING: "running",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  DLQ: "dlq",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

// --- Health check statuses ---

export const HealthStatus = {
  OK: "ok",
  HEALTHY: "healthy",
  ERROR: "error",
  UNREACHABLE: "unreachable",
  DEGRADED: "degraded",
} as const;
export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

// --- SSE event type discriminators ---

export const SSEEventType = {
  CONNECTED: "connected",
  PROGRESS: "progress",
  COMPLETE: "complete",
  ERROR: "error",
  CANCELLED: "cancelled",
  PING: "ping",
} as const;
export type SSEEventType = (typeof SSEEventType)[keyof typeof SSEEventType];

// --- OAuth2 grant types ---

export const GrantType = {
  PASSWORD: "password",
  REFRESH_TOKEN: "refresh_token",
  DEVICE_CODE: "urn:ietf:params:oauth:grant-type:device_code",
} as const;
export type GrantType = (typeof GrantType)[keyof typeof GrantType];

// --- HTTP status codes used in error classification ---

export const HttpStatus = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;
export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];

/** HTTP status codes that trigger automatic retry in got. */
export const RETRYABLE_STATUS_CODES = [
  HttpStatus.RATE_LIMITED,
  HttpStatus.INTERNAL_ERROR,
  HttpStatus.BAD_GATEWAY,
  HttpStatus.SERVICE_UNAVAILABLE,
  HttpStatus.GATEWAY_TIMEOUT,
] as const;

// --- API endpoint paths ---

export const Endpoint = {
  AUTH_TOKEN: "/v1/auth/token",
  AUTH_DEVICE: "/v1/auth/device",
  AUTH_DEVICE_TOKEN: "/v1/auth/device/token",
  HEALTH: "/health",
  LANGUAGES: "/v1/translation/languages",
  TRANSLATE: "/v1/translation",
  EVALUATE: "/v1/quality/score",
  DOCUMENT_TRANSLATE: "/v1/translation/document",
  JOB: "/v1/jobs/{job_id}",
  JOB_SSE_EVENTS: "/v1/jobs/{job_id}/events",
  DOCUMENT_FORMATS: "/v1/translation/document/formats",
  QE_FORMATS: "/v1/quality/score/formats",
  EVALUATE_FILE: "/v1/quality/score/file",
  DATA_SCORE_FORMATS: "/v1/data/score/formats",
  DATA_SCORE_LANGUAGES: "/v1/data/score/languages",
  DATA_ANNOTATE_FORMATS: "/v1/data/annotate/formats",
  DATA_ANNOTATE: "/v1/data/annotate",
  DATA_SCORE: "/v1/data/score",
  USER_USAGE: "/v1/user/usage",
} as const;
export type Endpoint = (typeof Endpoint)[keyof typeof Endpoint];

// --- Auth / HTTP headers ---

export const HEADER_AUTHORIZATION = "Authorization";
export const BEARER_PREFIX = "Bearer";
export const HEADER_ACCEPT = "Accept";
export const CONTENT_TYPE_SSE = "text/event-stream";
// --- Numeric constants ---
// GIT_INSTALL_URL intentionally excluded — contains embedded deploy token (OWASP)

export const SSE_RETRY_ATTEMPTS = 3;
export const DEFAULT_POLL_INTERVAL = 5; // seconds
export const MAX_POLL_INTERVAL = 30; // seconds

// --- Device Flow (RFC 8628) ---

export const DEVICE_FLOW_DEFAULT_INTERVAL = 5; // seconds (RFC 8628 §3.2 default)
export const DEVICE_FLOW_TIMEOUT = 600; // seconds (device_code TTL)
export const SSE_HEARTBEAT_TIMEOUT = 30; // seconds (2x server heartbeat interval)

// --- Data processing validation ---

/** Valid annotation pipeline stages (POST /v1/data/annotate). */
export const VALID_PIPELINE_STAGES = new Set([
  "lid",
  "pii",
  "monofixer",
  "docscorer",
  "adult_filter",
  "dedup",
]);

/** Valid LID model identifiers. */
export const VALID_LID_MODELS = new Set(["openlid-v2", "nllb", "openlid-v3"]);

/** Default LID model when --lid-model is not specified. */
export const DEFAULT_LID_MODEL = "openlid-v3";

/** Valid source languages for Bicleaner scoring (POST /v1/data/score). */
export const VALID_SCORING_LANGUAGES = new Set(["en", "de", "es"]);

// --- Quality score thresholds ---

export const QE_THRESHOLD_GOOD = 0.8;
export const QE_THRESHOLD_FAIR = 0.5;
export const BLEU_THRESHOLD_EXCELLENT = 40;
export const BLEU_THRESHOLD_GOOD = 25;
export const METRICX_THRESHOLD_EXCELLENT = 5; // lower = better
export const METRICX_THRESHOLD_GOOD = 10;
export const CHRF_THRESHOLD_EXCELLENT = 60;
export const CHRF_THRESHOLD_GOOD = 40;

// --- File permissions ---

/** Owner read/write only (0o600). Used for credentials, config, logs. */
export const FILE_MODE_OWNER_RW = 0o600;

// --- SSE backoff ---

export const SSE_BACKOFF_MAX_MS = 4000;
export const SSE_BACKOFF_JITTER_MS = 500;

// --- Defaults ---
