# HTTP Retry & Rate Limiting Patterns

<!-- SCOPE: Pattern documentation for HTTP retry strategies and rate limit handling ONLY.
     Contains: principle (exponential backoff, Retry-After), got library retry config, Do/Don't/When patterns, sources.
     DO NOT add here: Error classification -> Guide 03, Transport implementation -> task docs, Auth flow -> separate guide -->

## Principle

Handle transient HTTP failures with exponential backoff + jitter, and respect server rate limits via `Retry-After` header (RFC 6585 Section 4, RFC 7231 Section 7.1.3). Retry only idempotent-safe status codes (429, 500, 502, 503, 504) and explicitly include non-idempotent methods (POST) when the API contract guarantees idempotency. Cap total retry wait time to prevent indefinite blocking.

## Our Implementation

The `got` HTTP client (v14) provides built-in retry with backoff, jitter (`noise`), and `maxRetryAfter`. Transport configures retry via `got.extend()` with settings from the config system (API-428): `limit` (max attempts), `backoffLimit` (max delay), `maxRetryAfter` (max 429 wait). `calculateDelay` hook prioritizes `retryAfter` from server response over computed backoff.

## Got Retry Configuration Map

| Got Option | Source | Purpose |
|------------|--------|---------|
| `retry.limit` | `settings.api.retry_attempts` | Max retry count |
| `retry.methods` | `["GET","POST","PUT","DELETE"]` | Methods to retry (POST added explicitly) |
| `retry.statusCodes` | `[429,500,502,503,504]` | Retryable HTTP statuses |
| `retry.backoffLimit` | `settings.api.retry_max * 1000` | Max backoff delay (ms) |
| `retry.noise` | `100` | Jitter range (ms) for backoff randomization |
| `retry.maxRetryAfter` | `settings.api.rate_limit_max_wait * 1000` | Max wait from Retry-After header |
| `retry.calculateDelay` | Custom function | Prefer retryAfter over computed delay |

## Patterns

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Use `got` built-in retry with `maxRetryAfter` | Write custom retry/backoff logic | All HTTP transport retry needs |
| Include POST in `retry.methods` explicitly | Rely on got defaults (GET-only retry) | When API POST endpoints are idempotent |
| Set `backoffLimit` from config, not hardcoded | Hardcode retry delays in transport | Retry configuration |
| Respect `Retry-After` header via `calculateDelay` | Ignore server-specified wait time | 429 Too Many Requests handling |
| Cap total wait with `maxRetryAfter` | Allow unlimited retry accumulation | Rate limit protection |
| Add jitter via `noise` parameter | Use exact exponential delays | Preventing thundering herd |

## Sources

- [RFC 6585 Section 4: 429 Too Many Requests](https://www.rfc-editor.org/rfc/rfc6585#section-4) (IETF)
- [RFC 7231 Section 7.1.3: Retry-After](https://www.rfc-editor.org/rfc/rfc7231#section-7.1.3) (IETF)
- [Got Documentation — Retry](https://github.com/sindresorhus/got/blob/main/documentation/7-retry.md) (sindresorhus/got v14)
- [GitHub Rate Limits — Exceeding the Rate Limit](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#exceeding-the-rate-limit) (GitHub Docs, 2025)
- Internal: [Architecture.md](../project/architecture.md)

## Related

**ADRs:** None
**Guides:** [03 - Error Handling (RFC 9457)](03-error-handling-rfc9457.md), [01 - Input Validation with Zod](01-input-validation-zod-schemas.md)

---
**Last Updated:** 2026-02-13
