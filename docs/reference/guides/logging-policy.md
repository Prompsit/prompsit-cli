# Unified Logging Policy

<!-- SCOPE: Complete logging standards for CLI. Log level semantics, layer rules, console.log vs logger,
     metadata conventions, TypeScript patterns, anti-patterns.
     DO NOT add here: Handler configuration → src/logging/index.ts, Error codes → src/api/errors.ts -->

> Adapted from API Guide 57 (Unified Logging & Error Policy) + Guide 37 (Logging Layer Rules) for CLI context.

## Principle

All diagnostic/operational events MUST use `logger.*()` or `getLogger()`. User-facing output (REPL UI, tables, help) MUST use `console.log()` or `printX()` functions. Logger guarantees: trace_id correlation, file persistence (`~/.prompsit/debug.log`), remote telemetry (WARNING+).

---

## 1. Log Level Semantics

| Level | Priority | CLI Use When | Examples |
|-------|----------|-------------|----------|
| **ERROR** | 40 | Unrecoverable failure requiring user action | API unreachable, auth failed (401), file not found |
| **WARNING** | 30 | Degraded mode, automatic recovery, retries | SSE→polling fallback, retry attempt 2/3, deprecated flag |
| **INFO** | 20 | Normal operation milestone, audit trail | Command started/completed, config loaded, REPL session |
| **DEBUG** | 10 | Detailed diagnostic flow | REPL dispatch args, token refresh, metadata enrichment |

**CLI-specific rules:**
- Cancelled operations (Ctrl+C): **INFO** (expected user action, not error)
- Network errors (DNS, timeout, ECONNREFUSED): **ERROR**
- GOT retries: **WARNING** per attempt, **ERROR** only after exhaustion
- User input validation (invalid lang code): **ERROR** (command fails)

---

## 2. Exception → Log Level Decision Tree

```
Exception caught?
├─ CancelledError (Ctrl+C)         → propagate (REPL handles)
├─ APIError
│  ├─ AuthenticationError (401)     → ERROR
│  ├─ ForbiddenError (403)          → ERROR
│  ├─ RateLimitError (429)          → ERROR (retry exhausted)
│  ├─ ValidationError (422)         → ERROR
│  ├─ ServerError (5xx)             → ERROR
│  └─ Other APIError                → ERROR
├─ NetworkError (DNS/timeout)       → ERROR
├─ JobError (async job failed)      → ERROR
├─ ZodError (response mismatch)    → ERROR (API contract broken)
└─ Unknown Error                    → ERROR (catch-all)
```

**Anti-double-logging:** Log at CATCH point only. The layer that catches and handles logs it. Do NOT log at both throw and catch sites.

**Where to log:** Exception handlers in commands (final catch). NOT in domain constructors, NOT in resource layer (let errors bubble).

---

## 3. Layer-Specific Rules

### 3.1 Command Layer (`src/commands/*.ts`)

| What | Level | When |
|------|-------|------|
| Command lifecycle | INFO | Start (with args summary), completion (with duration_ms) |
| Command failure | ERROR | Via `handleCommandError()` — logs + shows user error |
| Input validation | ERROR | Invalid args before API call |

```typescript
const log = getLogger(import.meta.url);

.action(async (texts, opts) => {
  const startMs = Date.now();
  log.info("Command started", { command: "translate text" });
  try {
    const response = await getApiClient().translation.translate(...);
    log.info("Command completed", { command: "translate text", duration_ms: String(Date.now() - startMs) });
    // User output: console.log / printTable / printJson
  } catch (error: unknown) {
    handleCommandError(log, error, { command: "translate text", duration_ms: String(Date.now() - startMs) });
  }
});
```

### 3.2 API Resource Layer (`src/api/resources/*.ts`)

| What | Level | When |
|------|-------|------|
| API call | DEBUG | Method + endpoint + key params |
| API response | DEBUG | Status + response size |
| Errors | — | Do NOT catch — let bubble to command |

### 3.3 HTTP Transport (`src/api/transport.ts`)

| What | Level | When |
|------|-------|------|
| Retry attempt | WARNING | Before each retry (url, attempt, reason) |
| Error classification | DEBUG | After classifying error type |
| Request cancelled | INFO | Ctrl+C abort signal |
| Every request | — | Do NOT log (use show_curl setting for curl) |

### 3.4 Config Layer (`src/config/*.ts`)

| What | Level | When |
|------|-------|------|
| Parse failure + fallback | WARNING | TOML parse error, using defaults |
| Env override | DEBUG | When PROMPSIT_* overrides config |

### 3.5 REPL Layer (`src/repl/*.ts`)

| What | Level | When |
|------|-------|------|
| Command dispatch | DEBUG | Parsed command + args |
| Session lifecycle | INFO | Start/end of REPL session |
| User output | — | console.log (pi-tui UI requirement) |

---

## 4. Trace ID Propagation

Each CLI command execution gets a single trace_id that correlates all logs and HTTP requests.

```
CLI/REPL entry point
  └─ traceStore.run(traceId, async () => { ... })
       ├─ log.info("Command started")        → trace_id in meta (auto)
       ├─ transport.request(...)
       │    └─ beforeRequest hook             → X-Request-ID = getTraceId()
       ├─ log.info("Command completed")       → same trace_id
       └─ handleCommandError(log, error, ...) → same trace_id
```

| Entry Point | File | Wrapping |
|------------|------|----------|
| CLI mode | `src/index.ts` | `traceStore.run(traceId, () => program.parseAsync(...))` |
| REPL mode | `src/repl/executor.ts` | `traceStore.run(traceId, () => dispatch block)` |
| HTTP header | `src/api/transport.ts` | `getTraceId() \|\| generateTraceId()` (fallback for edge cases) |

**Rule:** Never call `generateTraceId()` in command code. Trace context is established at entry points.

---

## 5. Standard Metadata Fields

| Field | Type | Source | Example |
|-------|------|--------|---------|
| `module` | string | Auto (getLogger) | `"commands/translate"` |
| `trace_id` | string | Auto (AsyncLocalStorage) | `"a1b2c3d4"` |
| `command` | string | Command layer | `"translate text"` |
| `duration_ms` | string | Command completion | `"1234"` |
| `error_code` | string | Error logs | `"E4001"` |
| `endpoint` | string | API resource | `"/v1/translate"` |
| `job_id` | string | Job tracking | `"uuid-..."` |
| `attempt` | string | Retry logs | `"2"` |

**Rules:** All values as strings (`Record<string, string>`). Use `String(value)` for numbers. Use snake_case.

---

## 6. Handler Output Formats

| Handler | Destination | Format | Example |
|---------|------------|--------|---------|
| **Console** | stderr | `[LEVEL] message` (verbose: `+timestamp +module`) | `[ERROR] Command failed` |
| **File** | `~/.prompsit/debug.log` | `timestamp [LEVEL] [trace_id] module - message {meta}` | `2026-02-15 18:30:45 [ERROR   ] [a3f5c8d2] commands/translate - Command failed {error_code=E1003, duration_ms=1234}` |
| **Loki** | Remote telemetry | JSON streams with structured metadata | `{stream: {service, level}, values: [[ns, msg, meta]]}` |

**File handler rules:**
- `trace_id` in brackets after level (only if non-empty)
- Metadata as `{key=val}` suffix (excludes `module`, `trace_id`, `stack`)
- Stack traces on separate indented line

**Loki handler rules:**
- WARNING+ only (never DEBUG or INFO)
- Fire-and-forget with in-flight cap (max 10 concurrent requests)
- Labels: `service=prompsit-cli`, `os=platform`, `level`, `version`

---

## 7. Message Conventions

| Rule | Good | Bad |
|------|------|-----|
| Imperative, no periods | `"Config loaded"` | `"The config has been loaded."` |
| Action first | `"Command started"` | `"Starting the command now"` |
| Data in metadata, not message | `"Command completed"` + `{duration_ms}` | `"Command completed in 1234ms"` |
| Grep-friendly keywords | `"auth failed"`, `"retry"`, `"timeout"` | Unique messages per case |

---

## 8. console.log vs logger

| Output Type | Tool | Destination |
|-------------|------|-------------|
| Translation result | `process.stdout.write()` | stdout (pipeable) |
| Help text, REPL greeting | `console.log()` | stdout (pi-tui UI) |
| Error message to user | `printError()` | stderr (chalk) |
| Table output | `printTable()` | stdout |
| Diagnostic logs | `logger.info/debug()` | debug.log + stderr |
| Error logging | `logger.error()` | debug.log + Loki |

**pi-tui rule:** REPL uses pi-tui for input area. All command output MUST use `console.log()` to appear above TUI. This is user output, NOT diagnostic logging.

---

## 9. Anti-Patterns & Fixes

| Anti-Pattern | Fix |
|-------------|-----|
| `console.log("[DEBUG] ...")` | `logger.debug("...", {...})` |
| No logging in command catch | `handleCommandError(log, error, meta)` |
| Catch without logging | Always `log.error()` before `printError()` |
| Double-logging (resource + command) | Log at final handler (command) only |
| String interpolation in message | Use metadata: `log.info("Done", { duration_ms })` |
| Logging user output | Use `console.log` or `printX()` for user-facing |
| Numeric metadata values | `String(value)` — metadata is `Record<string, string>` |

---

## Maintenance

**Update Triggers:**
- New command or layer type added
- Error hierarchy changes (new exception types)
- New standard metadata fields
- Logging infrastructure changes (new handlers)

**Last Updated:** 2026-02-15

## Sources

- API Guide 57: Unified Logging & Error Policy (adapted)
- API Guide 37: Logging Layer Rules (adapted)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html)
- [ADR-004: REPL Input Handling](../adrs/adr-004-repl-input-handling.md) (console.log for pi-tui UI)
