# Observability Operations

> **SCOPE:** Operational commands for CLI telemetry, Loki log queries, and debugging. Does NOT include: Loki handler internals (-> `logging/loki-handler.ts`), edge server setup (-> [devops task](../tasks/devops-loki-edge-setup.md)), API observability (-> prompsit-api docs).

---

## Telemetry Architecture

```
CLI command -> logger.error() -> trace.ts (X-Request-ID)
  -> logging/logger.ts -> logging/loki-handler.ts
  -> HTTP POST -> Loki /loki/api/v1/push
```

| Component | Role |
|-----------|------|
| `trace.ts` | Generates 8-char hex trace_id per got request (X-Request-ID header) |
| `logger.ts` | Structured logging facade (WARNING+) |
| `loki-handler.ts` | Batches records, pushes to Loki HTTP API |
| `got beforeRequest hook` | Injects trace_id into request headers |

**Graceful degradation:** Loki unreachable -> got timeout (3s) -> silent drop. CLI is never blocked.

---

## Configuration

```bash
prompsit config telemetry-enabled true     # Enable (default: false)
prompsit config telemetry-enabled false    # Disable
prompsit config telemetry-loki-timeout 5   # Custom timeout (default: 3.0s)
```

| Setting | Default | Description |
|---------|---------|-------------|
| `telemetry-enabled` | `false` | Enable remote error logging |
| `telemetry-loki-key` | (auto) | X-Telemetry-Key header (auto-resolved from preset) |
| `telemetry-loki-timeout` | `3.0` | HTTP timeout for Loki push (seconds) |

**Loki URL resolution** (automatic, no user config needed):

| API Preset | Loki URL | Auth Key |
|------------|----------|----------|
| `test` (edge.prompsit.com) | `https://edge.prompsit.com/loki` | Built-in preset key |
| `local` (localhost:8080) | `http://localhost:3100` | None (direct access) |
| Custom URL | Telemetry disabled | - |

---

## What Gets Logged

| Level | Sent to Loki? | Examples |
|-------|---------------|---------|
| ERROR | Yes | NetworkError, ServerError (5xx) |
| WARNING | Yes | AuthenticationError, RateLimitError |
| INFO | No | Normal operations |
| DEBUG | No | Request details, retry attempts |

**Metadata fields** (per Unified Logging Standard):

| Field | Source | Example |
|-------|--------|---------|
| `service` | Hardcoded | `prompsit-cli` |
| `name` | Logger name | `api.transport` |
| `trace_id` | `api/trace.ts` | `62ed3dd6` |
| `error_type` | Error class name | `AuthenticationError` |
| `os` | `process.platform` | `win32` |
| `version` | CalVer | `26.0215.1430` |
| `funcName` | Caller context | `apiErrors` |

---

## Grafana LogQL Recipes

Access: http://localhost:3000 -> Explore -> Loki datasource.

| Goal | LogQL Query |
|------|-------------|
| All CLI logs | `{service_name="prompsit-cli"}` |
| CLI errors only | `{service_name="prompsit-cli", level="ERROR"}` |
| By trace_id | `{service_name="prompsit-cli"} \| trace_id="62ed3dd6"` |
| Cross-service trace | `{service_name=~".+"} \| trace_id="62ed3dd6"` |
| Auth failures | `{service_name="prompsit-cli"} \| error_type="AuthenticationError"` |
| By OS | `{service_name="prompsit-cli"} \| os="Windows"` |
| By version | `{service_name="prompsit-cli"} \| version="26.210.1734"` |
| Error count (1h) | `count_over_time({service_name="prompsit-cli", level="ERROR"} [1h])` |

**Note:** CLI logs use Loki Push API directly (not Alloy). Metadata fields are in structured metadata (3rd element of values array).

---

## Debugging Workflow

### 1. Request Tracing (CLI <-> API)

```
1. Run CLI command -> note trace_id from error output: "API error: ... (trace: 62ed3dd6)"
2. Grafana Explore -> Loki -> {service_name=~".+"} | trace_id="62ed3dd6"
3. See both CLI error + API request logs with same trace_id
```

### 2. Error Investigation

```
1. Query: {service_name="prompsit-cli", level="ERROR"}
2. Check error_type field to categorize (AuthenticationError vs NetworkError vs APIError)
3. Use trace_id to find matching API-side logs
4. Check os + version fields for platform-specific issues
```

### 3. User Impact Assessment

```
1. Error rate: count_over_time({service_name="prompsit-cli", level="ERROR"} [1h])
2. By error type: sum by (error_type) (count_over_time({service_name="prompsit-cli"} [1h]))
3. By version: check if errors concentrate on specific CLI version
```

---

## Health Checks

```bash
# Loki readiness (local)
curl http://localhost:3100/ready

# Loki labels (verify CLI logs arrive)
curl -s "http://localhost:3100/loki/api/v1/label/service_name/values"

# Query CLI logs directly
curl -s -G "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={service_name="prompsit-cli"}' \
  --data-urlencode 'limit=5'

# Edge server Loki push test
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://edge.prompsit.com/loki/api/v1/push" \
  -H "Content-Type: application/json" \
  -H "X-Telemetry-Key: <key>" \
  -d '{"streams":[{"stream":{"service_name":"test"},"values":[["'$(date +%s)000000000","test"]]}]}'
```

---

## Common Issues

| Symptom | Solution |
|---------|----------|
| No CLI logs in Loki | Check `prompsit config telemetry-enabled` is `true` |
| Telemetry enabled but no logs | Verify API preset is `test` or `local` (custom URLs disable telemetry) |
| Edge Loki returns 403 | Invalid telemetry key. Check `prompsit config telemetry-loki-key` |
| Logs arrive without trace_id | trace.ts not wired. Check got hooks in `api/transport.ts` |
| Logs delayed | loki-handler.ts batches records before flush. Flushes on process exit |

---

## Related

- [Runbook](runbook.md) - CLI setup, testing, configuration
- [DevOps: Loki Edge Setup](../tasks/devops-loki-edge-setup.md) - Edge server nginx + Loki config
- [Architecture](architecture.md) - CLI architecture overview

---

**Last Updated:** 2026-02-15
