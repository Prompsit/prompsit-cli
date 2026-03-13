# Error Handling Patterns (RFC 9457 Problem Details)

<!-- SCOPE: Pattern documentation for HTTP API error handling ONLY.
     Contains: principle (RFC 9457), error hierarchy, error codes, Do/Don't/When patterns, sources.
     DO NOT add here: Transport retry logic -> Guide 04, Validation schemas -> Guide 01, Architecture decisions -> ADR -->

## Principle

Standardize API error responses using RFC 9457 Problem Details (`application/problem+json`) with typed error hierarchies and trackable error codes. Every error must be machine-readable (code + type), human-readable (title + detail), and actionable (hint for resolution). RFC 9457 obsoletes RFC 7807 with improvements for multiple problems and type registries (IETF, July 2023).

## Our Implementation

Error handling spans three layers: (1) `api/errors.ts` — typed exception hierarchy with `APIError` base class carrying `code`, `statusCode`, `message`, and optional `ProblemDetail`; (2) `errors/catalog.ts` — pattern-matching catalog that maps exceptions to user-friendly labels and actionable hints via i18n keys; (3) transport layer — classifies HTTP responses into typed exceptions and parses RFC 9457 bodies. ProblemDetail is validated via Zod schema matching RFC 9457 fields (`type`, `title`, `status`, `detail`, `instance`).

## Error Code Convention

| Prefix | HTTP Range | Example | Meaning |
|--------|-----------|---------|---------|
| E0xxx | Network | E0001 | Connection/DNS/timeout errors |
| E4xxx | 4xx Client | E4001, E4031, E4221, E4291 | Auth, forbidden, validation, rate limit |
| E5xxx | 5xx Server | E5001 | Server unavailable |

## RFC 9457 ProblemDetail Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | URI string | No (default `about:blank`) | Problem type identifier |
| `title` | string | No | Short human-readable summary |
| `status` | integer | No | HTTP status code |
| `detail` | string | No | Human-readable explanation |
| `instance` | URI string | No | URI identifying specific occurrence |
| Extensions | any | No | Problem-specific additional members |

## Patterns

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Include error code (E4001) in every exception | Throw generic Error with message only | All API error responses |
| Parse `application/problem+json` via Zod schema | Manually extract JSON fields without validation | Receiving RFC 9457 responses from API |
| Use `instanceof` for error classification | Compare error message strings | Catch blocks, error catalog matching |
| Map each HTTP status to a specific error subclass | Use single APIError for all statuses | Transport response handler |
| Provide actionable hint per error code | Show raw API error text to user | Error catalog output formatting |
| Extend ProblemDetail with custom fields (trace_id, code) | Modify standard RFC 9457 fields | API-specific error context |

## Sources

- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) (IETF, July 2023 — obsoletes RFC 7807)
- [Problem Details (RFC 9457): Doing API Errors Well](https://swagger.io/blog/problem-details-rfc9457-doing-api-errors-well/) (Swagger/SmartBear, 2025)
- [Node.js Error Codes](https://nodejs.org/api/errors.html#errorcode) (Node.js v25 docs)
- Internal: [Architecture.md](../project/architecture.md)

## Related

**ADRs:** None
**Guides:** [01 - Input Validation with Zod](01-input-validation-zod-schemas.md), [04 - HTTP Retry & Rate Limiting](04-http-retry-rate-limiting.md)

---
**Last Updated:** 2026-02-13
