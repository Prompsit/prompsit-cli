# API Specification: Prompsit Translation API

> **SCOPE:** API endpoints, request/response schemas, authentication, error codes ONLY.
> **API Version:** v1 | **Last Updated:** 2026-03-01

---

## Base Information

| Setting | Value |
|---------|-------|
| Base URL (dev) | `http://localhost:8080` |
| Base URL (test) | `https://edge.prompsit.com` |
| API prefix | `/v1/` |
| Auth method | OAuth2 Bearer Token |
| Config override | `~/.prompsit/config.toml` or `PROMPSIT_API__BASE_URL` env var |

---

## 1. Authentication

### POST /v1/auth/token (Login)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `grant_type` | string | Yes | Must be `password` |
| `username` | string | Yes | Account email |
| `password` | string | Yes | API secret |

Content-Type: `application/x-www-form-urlencoded`

### POST /v1/auth/token (Refresh)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `grant_type` | string | Yes | Must be `refresh_token` |
| `refresh_token` | string | Yes | Valid refresh token from previous auth |

Content-Type: `application/x-www-form-urlencoded`

### TokenResponse (both variants)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `access_token` | string | Yes | OAuth2 bearer token |
| `refresh_token` | string | No | Refresh token for obtaining new access token |
| `token_type` | string | Yes | Always `Bearer` |
| `expires_in` | integer | RECOMMENDED | Access token validity in seconds. Per RFC 6749 S5.1: RECOMMENDED. API always sends it; client treats as optional for resilience. |
| `refresh_expires_in` | integer | No | Refresh token validity in seconds |

**Errors:** 400 (missing fields), 401 (invalid credentials), 500

---

## 2. Translation

### POST /v1/translate

Auth: Yes | Content-Type: `application/json`

**Request (TranslateRequest):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `texts` | string[] | Yes | Text segments to translate |
| `source_lang` | string | Yes | ISO 639-1 source language code |
| `target_lang` | string | Yes | ISO 639-1 target language code |
| `profile_id` | string | No | Translation profile UUID |

**Query params:** `enable_qe` (boolean, default false) -- include quality estimation scores.

**Response (TranslationResponse):**

| Field | Type | Description |
|-------|------|-------------|
| `translations` | TranslationItem[] | Array of translations |
| `source_lang` | string | Source language |
| `target_lang` | string | Target language |
| `engine` | string? | Engine used |
| `total_latency_ms` | integer? | Total latency in ms |

**TranslationItem:**

| Field | Type | Description |
|-------|------|-------------|
| `translated_text` | string | Translated text |
| `latency_ms` | integer? | Per-segment latency in ms |
| `quality_score` | float? | QE score 0-1 (when `enable_qe=true`) |
| `tag_alignment_method` | string? | `neural` or null |

**Errors:** 400, 401, 404 (no engine for pair), 429 (rate limit), 500

---

## 3. Engine Discovery

### GET /v1/engines

Auth: No

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | No | Filter by source language |
| `target` | string | No | Filter by target language |

**Response:** `Engine[]`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable engine name |
| `type` | string | `rule-based`, `neural`, or `statistical` |
| `available` | boolean | Currently available |
| `description` | string? | Engine description |
| `supported_pairs` | LanguagePair[] | `{source, target}` pairs |

**Errors:** 401, 500

---

## 4. Quality Evaluation

### POST /v1/translation/score

Auth: Yes | Content-Type: `application/json`

**Request (EvaluateRequest):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `segments` | object[] | Yes | Each: `{source, hypothesis, reference}` (all strings) |
| `metrics` | string[] | Yes | Metrics to compute: `bleu`, `chrf`, `metricx` |
| `aggregation` | string | No | `corpus`, `segment`, or `both` (default: `both`) |

**Response (EvaluationResponse):**

| Field | Type | Description |
|-------|------|-------------|
| `corpus_scores` | dict[str, float]? | Metric name -> corpus score (when aggregation=corpus or both) |
| `segment_scores` | dict[str, float[]]? | Metric name -> per-segment scores (when aggregation=segment or both) |
| `segment_count` | integer | Number of evaluated segments |

**Metrics:**

| Metric | Range | Description |
|--------|-------|-------------|
| BLEU | 0-1 | N-gram precision-based |
| CHRF | 0-1 | Character n-gram F-score, good for morphologically rich languages |
| MetricX | 0-1 | Neural metric, correlates with human judgment |

**Errors:** 400 (invalid metrics/missing fields), 401, 500

---

## 5. Health Check

### GET /health

Auth: No

**Response (HealthResponse):**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `healthy`, `degraded`, or `unhealthy` |
| `database` | string? | Database status |
| `services` | dict[str, str]? | Per-service status |
| `quality_estimation` | dict[str, str]? | QE service status |
| `version` | string? | API version |
| `timestamp` | string? | ISO 8601 timestamp |

**Errors:** 503 (unhealthy)

---

## 6. Document Translation

### POST /v1/documents/translate

Auth: Yes | Content-Type: `multipart/form-data`

Uploads a document for async translation. Returns a job ID for tracking via Job Management endpoints.

**Request fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Document to translate |
| `source_lang` | string | Yes | Source language code |
| `target_lang` | string | Yes | Target language code |
| `profile_id` | string | No | Translation profile UUID |
| `preserve_tags` | string | No | Preserve inline tags (`true`/`false`, default: `true`) |
| `callback_url` | string | No | Webhook URL for completion notification |
| `output_format` | string | No | Target format conversion (e.g. `po`, `arb`) |

**Response (JobCreateResponse):**

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | string | Unique job identifier |
| `status` | string | Initial status: `pending` |
| `job_type` | string | `translation` |

**Errors:** 400 (unsupported format/missing fields), 401, 413 (file too large), 500

---

## 7. Job Management

All job endpoints require authentication. Jobs are created by document translation and data processing endpoints.

### Endpoint Summary

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| GET | `/v1/jobs/{job_id}` | JobStatus | Get job status and progress |
| GET | `/v1/jobs/{job_id}/result` | Binary file | Download completed job result |
| GET | `/v1/jobs` | JobListResponse | List jobs with pagination |
| DELETE | `/v1/jobs/{job_id}` | JobCancelResponse | Cancel pending/running job |

### GET /v1/jobs/{job_id}

**Response (JobStatus):**

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | string | Job identifier |
| `status` | string | `pending`, `running`, `completed`, `failed`, `cancelled` |
| `progress_percentage` | integer | 0-100 |
| `current_step` | string? | `deformat`, `translate`, `reformat` |
| `error_message` | string? | Error details (when status=failed) |
| `output_format` | string? | Output format, e.g. `docx` for PDF input |
| `warnings` | string[]? | Non-fatal warnings |
| `chars_translated` | integer? | Characters translated |
| `translation_requests_count` | integer? | API requests made |
| `created_at` | datetime? | Job creation time |
| `started_at` | datetime? | Processing start time |
| `completed_at` | datetime? | Completion time |
| `result_url` | string? | HATEOAS download URL (present only when `status=completed`) |

### GET /v1/jobs/{job_id}/result

Returns binary file content. Client discovers this URL via `result_url` field in JobStatus response (HATEOAS). Use `Content-Disposition` header to detect format conversions (e.g. PDF input produces DOCX output -- filename extension in header differs from input).

### GET /v1/jobs

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | -- | Filter: `pending`, `running`, `completed`, `failed`, `cancelled` |
| `limit` | integer | 50 | Max results (max 100) |
| `offset` | integer | 0 | Pagination offset |

**Response (JobListResponse):**

| Field | Type | Description |
|-------|------|-------------|
| `jobs` | JobSummary[] | Array of job summaries |
| `total` | integer | Total matching jobs |
| `limit` | integer | Applied limit |
| `offset` | integer | Applied offset |

**JobSummary:**

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | string | Job identifier |
| `status` | string | Current status |
| `input_filename` | string | Original file name |
| `source_lang` | string | Source language |
| `target_lang` | string | Target language |
| `engine` | string | Engine used |
| `progress_percentage` | integer | 0-100 |
| `created_at` | datetime? | Creation time |

### DELETE /v1/jobs/{job_id}

**Response (JobCancelResponse):**

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | string | Job identifier |
| `cancelled` | boolean | Always `true` on success |

**Errors (all job endpoints):** 401, 404 (job not found), 409 (cancel of completed job), 500

---

## 8. SSE Events

### POST /v1/jobs/{job_id}/events/token

Auth: Yes

Obtains a short-lived token for SSE streaming of job progress. Designed for browser `EventSource` clients that cannot set HTTP headers -- the token is passed as a query parameter.

> **CLI note:** The CLI uses Bearer access_token in the `Authorization` header directly (see `api/sse.py`), so this endpoint is not used by the CLI.

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `token` | string | Short-lived SSE auth token |
| `expires_in` | integer | Token validity in seconds (default: 60) |

**Errors:** 401, 404 (job not found), 500

---

## 9. Formats

### GET /v1/formats

Auth: No

**Response (FormatsResponse):**

| Field | Type | Description |
|-------|------|-------------|
| `formats` | FormatInfo[] | Supported document formats |
| `total` | integer | Total format count |

**FormatInfo:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Format identifier (e.g. `docx`, `pdf`, `tmx`) |
| `name` | string | Human-readable name |
| `description` | string | Format description |
| `extensions` | string[] | File extensions (e.g. `[".docx"]`) |
| `mime_types` | string[] | MIME types |
| `conversions_to` | string[] | Format IDs this can convert to during translation (e.g. PDF -> `["docx"]`) |

**Errors:** 401, 500

---

## 10. Data Processing

Async job endpoints for corpus annotation and quality scoring. Results retrieved via Job Management (section 7).

### POST /v1/data/annotate

Auth: Yes | Content-Type: `multipart/form-data`

Upload corpus file for annotation via Monotextor.

**Request fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Corpus file (JSONL/JSONL.gz/JSONL.zst/text) |
| `lang` | string | Yes | Language code in BCP 47 (e.g. `en`, `es`, `zh-Hans`). ISO 639-3+15924 also accepted |

**Response:** JobCreateResponse (see section 6)

### POST /v1/data/score

Auth: Yes | Content-Type: `multipart/form-data`

Upload file(s) for quality scoring via Bicleaner.

**Request fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_file` | file | Yes | Bitext file (TMX/Moses/TSV) or source file for parallel mode |
| `target_file` | file | No | Target file for parallel mode |
| `output_format` | string | No | Output format: `tsv` or `tmx` |

**Response:** JobCreateResponse (see section 6)

**Errors (both endpoints):** 400 (invalid file/missing fields), 401, 413 (file too large), 500

---

## Error Handling

All errors follow a consistent format with `error.code`, `error.message`, and optional `error.details`.

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request or missing required fields |
| 401 | `INVALID_CREDENTIALS` | Invalid account_id or api_secret |
| 401 | `INVALID_TOKEN` | Missing or expired access token |
| 404 | `ENGINE_NOT_FOUND` | No engine for language pair |
| 404 | `RESOURCE_NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Invalid state transition (e.g. cancel completed job) |
| 413 | `PAYLOAD_TOO_LARGE` | File exceeds size limit |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | API temporarily down |

---

## Rate Limiting

| Plan | Requests/Min | Requests/Day |
|------|-------------|--------------|
| Free | 10 | 1,000 |
| Basic | 60 | 10,000 |
| Pro | 300 | 50,000 |
| Enterprise | Custom | Custom |

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Unix timestamp).

Recommended retry: exponential backoff with jitter (configured via `retry_attempts`, `retry_initial`, `retry_max` in settings).

---

## Authentication Lifecycle

| Step | Description |
|------|-------------|
| 1. Obtain | POST /v1/auth/token with credentials |
| 2. Validity | 3600s (1 hour) default |
| 3. Storage | `~/.prompsit/credentials.json` |
| 4. Refresh | POST /v1/auth/token with grant_type=refresh_token |
| 5. Expiry | Client detects expiry, auto-refreshes before request |

---

## Data Models

### Language Codes

ISO 639-1 (two-letter) for translation endpoints. BCP 47 (e.g. `en`, `zh-Hans`) for data processing endpoints. ISO 639-3+15924 also accepted.

### Engine Types

| Type | Description |
|------|-------------|
| `rule-based` | Rule-based MT (e.g. Apertium). Fast, predictable. |
| `statistical` | Statistical MT. Data-driven, requires parallel corpora. |
| `neural` | Neural MT. State-of-the-art fluency. |

### Job Status Values

| Status | Description |
|--------|-------------|
| `pending` | Queued, not yet started |
| `running` | Processing in progress |
| `completed` | Done, result available for download |
| `failed` | Error occurred, see `error_message` |
| `cancelled` | Cancelled by user |

---

## Maintenance

**Last Updated:** 2026-03-01

**Verification:**
- [x] All 15 endpoints documented
- [x] Request/response schemas complete (including HATEOAS `result_url`)
- [x] Error codes comprehensive
- [x] No code blocks in document
