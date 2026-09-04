# Observability operations

The CLI always writes local diagnostics and can optionally send warning/error events to a Loki push endpoint. Telemetry is best-effort and must never fail a user command.

## Destinations

| Destination | Behavior |
|---|---|
| stderr | Uses the configured console level; `--verbose` forces debug |
| `~/.prompsit/debug.log` | JSON lines at debug level with bounded rotation |
| Loki | Warning and error events only, when telemetry is enabled and the selected API preset has a Loki mapping |

The test API preset maps to `https://edge.prompsit.com/loki`; local maps to `http://localhost:3100`. Custom API URLs disable remote telemetry because no Loki target can be inferred.

## Configure

```bash
prompsit config telemetry-enabled true
prompsit config telemetry-loki-timeout SECONDS
```

The push-only credential is supplied through `PROMPSIT_TELEMETRY__LOKI_KEY`. Do not store it in documentation, source, `config.toml`, shell history, or committed environment files.

Telemetry uses `POST /loki/api/v1/push` with `X-Telemetry-Key` when a key is present. The edge proxy should expose only that push path; query and administration APIs remain private.

## Trace an error

1. Reproduce with `prompsit --verbose <command>`.
2. Note the `trace_id` in stderr.
3. Search `~/.prompsit/debug.log` for that value.
4. If remote telemetry is enabled, query Loki by `service="prompsit-cli"` and the same trace ID.
5. Compare the CLI trace with the API logs.

Every API request carries `X-Request-ID`. CLI and API logs can therefore be correlated without logging request credentials or command secrets.

## Delivery guarantees

Loki delivery uses bounded concurrency, retry, and timeout settings. Events may be dropped under pressure. Forced shutdown attempts a bounded flush; delivery is never guaranteed.

For implementation rules, see the [logging contract](../reference/guides/logging-policy.md). Configuration defaults live in [`src/config/schemas.ts`](../../src/config/schemas.ts); endpoint mappings live in [`src/config/constants.ts`](../../src/config/constants.ts).
