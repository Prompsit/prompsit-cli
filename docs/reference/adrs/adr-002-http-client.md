# ADR-002: got transport

**Status:** Accepted

## Context

The client needs timeouts, bounded retry behavior, request hooks, cancellation, streaming downloads, and a shared error boundary.

## Decision

Use `got` behind `src/api/transport.ts`. API resources depend on the transport abstraction and validate responses with Zod. Authentication is layered through `AuthSession`; commands do not construct HTTP requests directly.

## Consequences

- Retryable statuses, timeout mapping, request IDs, and error normalization have one owner.
- API resources contain route-specific request construction but not presentation logic.
- Downloads stage into unique temporary files before replacing destinations.
- Raw server failures do not leak directly into user output.

Changing the HTTP library requires preserving these contracts rather than matching internal implementation details.
