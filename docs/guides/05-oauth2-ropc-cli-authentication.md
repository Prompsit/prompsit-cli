# OAuth2 Device Flow and ROPC Fallback for CLI Authentication

<!-- SCOPE: Pattern documentation for OAuth2 Device Flow and Resource Owner Password Credentials (ROPC) fallback in CLI context ONLY.
     Contains: principle (RFC 8628, RFC 6749 Section 4.3), implementation approach, Do/Don't/When patterns, token lifecycle.
     DO NOT add here: Full implementation -> task docs, Token storage -> credentials guide, HTTP transport -> Guide 04. -->

## Principle

RFC 8628 defines OAuth 2.0 Device Authorization Grant for devices or terminals where browser access may be separate from the CLI session. This is the primary `prompsit login` path: the CLI requests a device code, prints a user code and URL, opens the browser when possible, and polls until the API returns tokens.

RFC 6749 Section 4.3 defines Resource Owner Password Credentials (ROPC). Prompsit CLI keeps this as a backward-compatible fallback for already-issued Prompsit account email + API secret pairs. Token refresh uses `POST /v1/auth/token` with `grant_type=refresh_token` (RFC 6749 Section 6).

## Our Implementation

`prompsit login` authenticates via `POST /v1/auth/device` followed by polling `POST /v1/auth/device/token` with JSON body (`grant_type=urn:ietf:params:oauth:grant-type:device_code`, `device_code`). The CLI prints the code and URL, attempts to copy the sign-in URL to the system clipboard, falls back to OSC 52 terminal clipboard when possible, and opens the default browser when available.

`prompsit login -a "EMAIL" -s "SECRET"` authenticates via `POST /v1/auth/token` with form-encoded body (`grant_type=password`, `username`, `password`). Tokens are stored in `~/.prompsit/credentials.json`. The `AuthSession` layer wraps `HttpTransport` with proactive refresh before request if the token is expired and reactive refresh on 401 response with a single retry. Bearer token injection happens per-request via got `beforeRequest` hook.

## Token Lifecycle

```
Device Login          Proactive Refresh        Reactive Refresh
     |                      |                        |
POST /v1/auth/device  POST /v1/auth/token      POST /v1/auth/token
poll device/token     grant_type=refresh_token  grant_type=refresh_token
     |                      |                        |
     v                      v                        v
Save tokens           Save new tokens           Save new tokens
Reset auth client     Reset auth client          Retry original request
```

## Patterns

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Use device flow as the default login path | Require users to request secrets before first use | `prompsit login` |
| Print the login URL and code even when opening the browser succeeds | Assume the local machine has a browser | Headless servers, SSH, WSL |
| Copy the login URL when possible and tolerate clipboard failure | Make clipboard failure abort login | Device flow setup |
| Use `form` option in got (auto-sets Content-Type) | Manually set Content-Type + encode body | POST /v1/auth/token requests |
| Inject Bearer header per-request via hook | Set Bearer at client creation time | All authenticated HTTP requests |
| Proactive refresh before request if token expired | Only react to 401 responses | Every authenticated request |
| Single retry on 401 (refresh + retry once) | Infinite retry loops on auth failure | Reactive refresh after 401 |
| Clear all tokens on refresh failure | Keep stale tokens after refresh fails | When refresh_token is also expired |
| Use monotonic clock for expiry checks | Use system wall clock (Date.now) | Token expiry comparison (drift-safe) |
| Require both `-a` and `-s` for fallback login | Accept partial fallback credentials | `prompsit login -a/-s` |
| Use standard JSON credential file format with `chmod 0600` on Unix | Store auth state in `config.toml` or source files | Simple file-based auth |

## Endpoint Request Format

### Device Flow

| Endpoint | Body | Purpose |
|----------|------|---------|
| `POST /v1/auth/device` | empty public request | Start sign-in and receive device code |
| `POST /v1/auth/device/token` | JSON `grant_type`, `device_code` | Poll for token or RFC 8628 polling error |

### ROPC Fallback and Refresh

| Field | Password fallback | Refresh |
|-------|-------------------|---------|
| `grant_type` | `password` | `refresh_token` |
| `username` | Account email | -- |
| `password` | API secret key | -- |
| `refresh_token` | -- | Stored refresh token |
| Content-Type | `application/x-www-form-urlencoded` | `application/x-www-form-urlencoded` |
| Auth header | None (public endpoint) | None (public endpoint) |

## Error Handling

| Scenario | Action | User Message |
|----------|--------|-------------|
| Browser cannot open | Print URL and code; rely on clipboard/OSC 52 if possible | "Could not open browser. Open the URL above manually." |
| Device authorization pending | Continue polling at server interval | "Waiting for authorization..." |
| Device code expired | Stop polling | "Sign-in timed out. Run 'login' to try again." |
| Invalid credentials (401) | Do not store tokens | "Authentication failed. Check credentials." |
| Refresh token expired | Clear all tokens | "Session expired. Run: prompsit login" |
| Not authenticated (no token) | Guard rejects request | "Not authenticated. Run: prompsit login" |
| Network error during auth | Propagate NetworkError | "Cannot connect to API" |

## Sources

- RFC 8628: OAuth 2.0 Device Authorization Grant (IETF, 2019)
- RFC 6749 Section 4.3: Resource Owner Password Credentials Grant fallback (IETF, 2012)
- RFC 6749 Section 6: Refreshing an Access Token (IETF, 2012)
- RFC 6750: The OAuth 2.0 Authorization Framework: Bearer Token Usage (IETF, 2012)
- Internal: [Architecture.md](../project/architecture.md)

## Related

**ADRs:** None yet
**Guides:** [03-error-handling-rfc9457.md](03-error-handling-rfc9457.md), [04-http-retry-rate-limiting.md](04-http-retry-rate-limiting.md)

---
**Last Updated:** 2026-06-12
