# OAuth2 ROPC Flow for CLI Authentication

<!-- SCOPE: Pattern documentation for OAuth2 Resource Owner Password Credentials (ROPC) flow in CLI context ONLY.
     Contains: principle (RFC 6749 Section 4.3), implementation approach, Do/Don't/When patterns, token lifecycle.
     DO NOT add here: Full implementation -> task docs, Token storage -> credentials guide, HTTP transport -> Guide 04. -->

## Principle

RFC 6749 Section 4.3 defines the Resource Owner Password Credentials (ROPC) grant type for trusted first-party clients where the resource owner has a trust relationship with the client. The token endpoint MUST accept `application/x-www-form-urlencoded` body encoding (RFC 6749 Section 4.3.2). Token refresh uses the same endpoint with `grant_type=refresh_token` (RFC 6749 Section 6).

## Our Implementation

The CLI authenticates via `POST /v1/auth/token` with form-encoded body (`grant_type=password`, `username`, `password` fields). Tokens are stored in `~/.prompsit/credentials.json`. The `AuthSession` layer wraps `HttpTransport` with a proactive+reactive token refresh strategy: proactive refresh before request if token is expired, reactive refresh on 401 response with single retry. Bearer token injection happens per-request via got `beforeRequest` hook.

## Token Lifecycle

```
Login (ROPC)          Proactive Refresh        Reactive Refresh
     |                      |                        |
POST /v1/auth/token   POST /v1/auth/token      POST /v1/auth/token
grant_type=password   grant_type=refresh_token  grant_type=refresh_token
     |                      |                        |
     v                      v                        v
Save tokens           Save new tokens           Save new tokens
Reset auth client     Reset auth client          Retry original request
```

## Patterns

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Use `form` option in got (auto-sets Content-Type) | Manually set Content-Type + encode body | POST /v1/auth/token requests |
| Inject Bearer header per-request via hook | Set Bearer at client creation time | All authenticated HTTP requests |
| Proactive refresh before request if token expired | Only react to 401 responses | Every authenticated request |
| Single retry on 401 (refresh + retry once) | Infinite retry loops on auth failure | Reactive refresh after 401 |
| Clear all tokens on refresh failure | Keep stale tokens after refresh fails | When refresh_token is also expired |
| Use monotonic clock for expiry checks | Use system wall clock (Date.now) | Token expiry comparison (drift-safe) |
| Prompt interactively when flags missing | Require all flags or fail | `prompsit login` without -a/-s |
| Hide secret input (raw mode, no echo) | Echo secret to terminal | Interactive secret prompt |
| Use standard JSON credential file format | Use system keyring or encrypted store | Simple file-based auth with `chmod 0600` |

## Token Endpoint Request Format

| Field | Login (ROPC) | Refresh |
|-------|-------------|---------|
| `grant_type` | `password` | `refresh_token` |
| `username` | Account email | -- |
| `password` | API secret key | -- |
| `refresh_token` | -- | Stored refresh token |
| Content-Type | `application/x-www-form-urlencoded` | `application/x-www-form-urlencoded` |
| Auth header | None (public endpoint) | None (public endpoint) |

## Error Handling

| Scenario | Action | User Message |
|----------|--------|-------------|
| Invalid credentials (401) | Do not store tokens | "Authentication failed. Check credentials." |
| Refresh token expired | Clear all tokens | "Session expired. Run: prompsit login" |
| Not authenticated (no token) | Guard rejects request | "Not authenticated. Run: prompsit login" |
| Network error during auth | Propagate NetworkError | "Cannot connect to API" |

## Sources

- RFC 6749 Section 4.3: Resource Owner Password Credentials Grant (IETF, 2012)
- RFC 6749 Section 6: Refreshing an Access Token (IETF, 2012)
- RFC 6750: The OAuth 2.0 Authorization Framework: Bearer Token Usage (IETF, 2012)
- Internal: [Architecture.md](../project/architecture.md)

## Related

**ADRs:** None yet
**Guides:** [03-error-handling-rfc9457.md](03-error-handling-rfc9457.md), [04-http-retry-rate-limiting.md](04-http-retry-rate-limiting.md)

---
**Last Updated:** 2026-02-13
