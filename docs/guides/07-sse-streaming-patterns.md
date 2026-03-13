# SSE (Server-Sent Events) Streaming Patterns

<!-- SCOPE: Pattern documentation for SSE client streaming ONLY.
     Contains: principle (HTML Living Standard SSE spec), reconnection, Last-Event-ID, heartbeat, Do/Don't/When patterns, sources.
     DO NOT add here: HTTP transport -> Guide 04, Error handling -> Guide 03, Job tracking business logic -> task docs -->

## Principle

Server-Sent Events (SSE) is a W3C/WHATWG standard (HTML Living Standard, Section 9.2) for server-to-client streaming over HTTP. The protocol defines `text/event-stream` media type with automatic reconnection, `Last-Event-ID` resume, and `retry` field for server-controlled reconnect delay.

## Our Implementation

SSE client lives in `api/sse-client.ts` as pure transport layer, consuming `text/event-stream` responses via Node.js native HTTP streaming. Typed event models in `api/sse-models.ts` use Zod discriminated unions (event type field). Job tracking in `commands/job-tracking.ts` uses Strategy pattern (SSETracker/PollingTracker) with automatic fallback. Bearer token auth injected via got hooks; 401 triggers token refresh mid-stream.

## Patterns

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Send `Last-Event-ID` header on reconnect | Restart stream from beginning after disconnect | Any SSE reconnection attempt |
| Use exponential backoff (1s, 2s, 4s) with max 3 retries | Retry immediately or indefinitely | SSE connection drops unexpectedly |
| Detect heartbeat timeout (2x server interval = 30s) | Assume connection alive without heartbeat | Long-lived SSE connections with server keepalive |
| Parse `retry` field from server to adjust reconnect delay | Hardcode reconnect interval | Server sends `retry:` directive |
| Use `extra: "ignore"` on Zod event schemas for forward compat | Fail on unknown fields from server | Parsing SSE event JSON data |
| Decouple transport (SSE client) from display (progress bar) | Mix ora/chalk calls inside SSE parser | All SSE consumer implementations |
| Clean up connections on all exit paths (try/finally) | Leave connections open on exception/signal | SSE streaming with signal handlers |
| Validate percentage fields with `z.number().min(0).max(100)` | Accept arbitrary numeric values from server | Progress event percentage parsing |

## Sources

- HTML Living Standard, Section 9.2 "Server-Sent Events" (WHATWG, 2025)
- OpenAPI Specification 3.2.0 "Special Considerations for Server-Sent Events" (OAI, 2025)

## Related

**ADRs:** None
**Guides:** [04-http-retry-rate-limiting](04-http-retry-rate-limiting.md), [03-error-handling-rfc9457](03-error-handling-rfc9457.md), [06-cli-patterns-signal-handling](06-cli-patterns-signal-handling.md)

---

## Maintenance

**Update Triggers:**
- When SSE client interface changes
- When reconnection strategy is modified
- When new SSE event types are added

**Last Updated:** 2026-02-15
