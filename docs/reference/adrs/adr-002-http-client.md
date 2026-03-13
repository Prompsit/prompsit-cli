# ADR-002: HTTP Client (got)

**Date:** 2026-02-15 | **Status:** Accepted | **Category:** http_client | **Decision Makers:** Engineering Team

<!-- SCOPE: Architecture Decision Record for HTTP client library selection ONLY. Contains context, decision, rationale, consequences, alternatives. -->
<!-- DO NOT add here: Transport implementation -> api/transport.ts, Auth flow -> api/auth-session.ts, API endpoints -> api_spec.md -->

---

## Context

The CLI communicates with Prompsit Translation API across 15+ endpoints (auth, translation, evaluation, document upload, jobs, SSE streaming). Requirements: granular timeout control (connect/read/write separately), retry with exponential backoff for 5xx/429 errors, request/response hooks for verbose logging, OAuth2 token lifecycle, and `form` body encoding for token endpoint.

---

## Decision

Use **got 14+** as the HTTP client library.

---

## Rationale

1. **Built-in retry with backoff** -- `retry: { limit: 3, methods: ["GET","POST"], statusCodes: [429, 500, 502, 503] }` with exponential backoff. No external retry library needed. Respects `Retry-After` header.
2. **Granular timeout phases** -- `timeout: { lookup: 1000, connect: 5000, response: 30000 }` per phase (DNS lookup, TCP connect, first byte). Document uploads get longer response timeout while connect stays fast.
3. **Hook system** -- `beforeRequest`, `afterResponse`, `beforeRetry` hooks enable transparent curl logging (`api/curl.ts`) and auth token injection (`api/auth-session.ts`) without modifying endpoint methods.

---

## Consequences

**Positive:**
- Retry + backoff built-in, replacing custom retry logic
- `form` option for `application/x-www-form-urlencoded` (OAuth2 token endpoint)
- Hooks decouple cross-cutting concerns (logging, auth) from business logic
- ESM-native, TypeScript types included

**Negative:**
- ESM-only since v12 -- requires `"type": "module"` in package.json
- No HTTP/2 by default (available via `http2: true` option) -- not needed for REST API
- Streaming SSE requires separate implementation (`api/sse-client.ts`) -- got's stream API is pull-based, SSE needs push-based EventSource

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|--------------|
| **axios** | Largest ecosystem, interceptors, familiar API | CJS/ESM dual package issues, no built-in retry, no granular timeouts (single `timeout` value), larger bundle | Single timeout value insufficient for mixed workloads (fast health checks vs slow uploads) |
| **node-fetch** | Minimal, Web Fetch API compatible | No retry, no hooks, no timeout phases, minimal error handling, bare-bones API | Too low-level; would require building retry, hooks, timeout from scratch |
| **undici** | Node.js built-in (>=18), fastest HTTP client | Low-level API (no hooks, no retry, manual response parsing), less ergonomic | Requires significant wrapper code for retry, hooks, and response parsing |

---

## Related Decisions

- ADR-001: CLI Framework (Commander.js) -- commands call got through resource classes
- ADR-003: Configuration (Zod + smol-toml) -- timeout/retry settings from `[api]` section

---

**Last Updated:** 2026-02-15
