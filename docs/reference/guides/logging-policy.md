# Logging contract

This document defines the behavior that code changes must preserve. The implementation in `src/logging/` and `src/output/terminal.ts` is authoritative.

## Output ownership

- User results and actionable messages go through the terminal port.
- Diagnostic events go through the module logger.
- Only terminal/logging adapters may write directly to stdout or stderr.
- API resources normally let errors propagate; the command-level handler classifies, logs, and presents them once.

| Content | Channel |
|---|---|
| Translation/data result or table | terminal stdout event |
| Status, warning, hint, or user-facing error | terminal system event / CLI stderr |
| Debug, lifecycle, retry, and exception diagnostics | logger |
| Remote telemetry | warning/error logger events only |

## Levels

- `debug`: request flow and troubleshooting detail.
- `info`: expected lifecycle events and cancellation.
- `warn`: degraded behavior or successful recovery.
- `error`: operation failure requiring user action.

Do not log the same exception at both the resource and command layers.

## Structured metadata

Use stable messages and put variable data in metadata. Metadata values are strings. Common keys are `module`, `trace_id`, `command`, `duration_ms`, `error_code`, `endpoint`, `job_id`, and `attempt`.

Never log access tokens, refresh tokens, account secrets, telemetry keys, authorization headers, or raw sensitive commands. Redaction must occur before validation/debug branches can emit input.

## Trace propagation

CLI execution establishes an async trace context; REPL dispatch establishes one per command. The HTTP transport forwards it as `X-Request-ID`. Command code should read the current context and must not create competing trace IDs.

## Destinations and shutdown

The console level comes from `--verbose` or `cli.log_level`. The file stream always records debug events in `~/.prompsit/debug.log`. Opt-in Loki receives warning/error events and is drained for a bounded interval during forced shutdown.

Operational configuration and investigation steps live in [observability-operations.md](../../project/observability-operations.md).
