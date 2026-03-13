# CLI Patterns & Signal Handling

<!-- SCOPE: CLI entry point patterns for Node.js/TypeScript ONLY.
     Contains: POSIX signal handling, exit code conventions, global flags propagation, color control.
     DO NOT add here: Command implementations -> task docs, Auth flow -> Guide 05, Error formats -> Guide 03 -->

## Principle

POSIX-compliant CLI applications use standardized exit codes (0=success, 1=error, 2=usage, 128+N=signal) and handle SIGINT/SIGTERM for graceful shutdown. Global flags propagate via framework hooks, not per-command duplication. Color output respects `NO_COLOR` environment variable (no-color.org, 2025).

## Our Implementation

`prompsit` uses Commander.js 14 (`@commander-js/extra-typings`). Signal handlers registered at startup call `resetApiClient()` before exit. chalk 5 natively respects `NO_COLOR` env var. Exit codes defined as constants in `cli/exit-codes.ts`. Entry point: `src/index.ts`.

## Patterns

### Exit Codes

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Use constants: `SUCCESS=0`, `APP_ERROR=1`, `USAGE_ERROR=2`, `SIGINT_EXIT=130` | Hardcode magic numbers (`process.exit(1)`) | Every `process.exitCode` or `process.exit()` call |
| Exit 128+signal for signal termination (SIGINT=130, SIGTERM=143) | Exit 0 or 1 on signal interruption | Signal handler cleanup functions |
| Use `program.exitOverride()` to catch Commander parse errors as code 2 | Let Commander call `process.exit(1)` on bad args | CLI argument parsing phase |
| Call `copyInheritedSettings()` after `addCommand()` — it doesn't inherit automatically | Assume `addCommand()` copies exitOverride/configureOutput | Adding pre-created subcommands (`src/program.ts`) |
| In REPL: intercept `process.exit` during dispatch as safety net | Trust exitOverride alone to prevent REPL death | REPL command dispatch (`repl/executor.ts`) |

### Signal Handling

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Register `process.on("SIGINT", cleanup)` before `parseAsync()` | Ignore signals or let Node.js default handler run | Application startup, before command dispatch |
| Call `resetApiClient()` / close connections in cleanup | Call `process.exit()` without cleanup | Any signal handler |
| Accept double-SIGINT as force-kill (no second handler) | Block second SIGINT with recursive handler | Default behavior is acceptable |

### Color Control

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Respect `NO_COLOR` env var (chalk 5 does this natively) | Ignore environment, always output ANSI codes | All terminal output |
| Use `new Chalk({level: 0})` for isolated no-color instance | Mutate global `chalk.level` in library code | Reusable modules that need color control |

### Windows Considerations

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Handle SIGINT (works via Ctrl+C on Windows) | Rely on SIGTERM for Windows shutdown | Windows process termination |
| Document that SIGTERM is emulated by Node.js on Windows | Assume SIGTERM works identically to Linux | Cross-platform CLI applications |
| Use `SIGBREAK` for Ctrl+Break on Windows | Ignore Windows-specific signals | Windows console applications |

## Sources

- [Node.js Process: Signal Events](https://nodejs.org/api/process.html#signal-events) - Official signal handling reference (2025)
- [Node.js Process: Exit Codes](https://github.com/nodejs/node/blob/main/doc/api/process.md#exit-codes) - Exit code >128 = signal convention
- [Commander.js: Life Cycle Hooks](https://github.com/tj/commander.js#life-cycle-hooks) - preAction hook documentation (v14, 2025)
- [Commander.js: Commands](https://github.com/tj/commander.js#commands) - `.addCommand()` vs `.command()` inheritance behavior
- [Commander.js: Override Exit](https://github.com/tj/commander.js#override-exit-and-output-handling) - exitOverride + configureOutput
- [chalk: NO_COLOR support](https://github.com/chalk/chalk#supportscolor) - Environment variable color detection (v5, 2025)
- [no-color.org](https://no-color.org) - NO_COLOR standard specification

## Related

**ADRs:** None
**Guides:** [03-error-handling-rfc9457](03-error-handling-rfc9457.md) (error response patterns), [05-oauth2-ropc-cli-authentication](05-oauth2-ropc-cli-authentication.md) (auth commands)

---

## Maintenance

**Update Triggers:**
- When signal handling implementation changes
- When new global flags are added
- When exit code conventions are modified
- When color handling approach changes

**Verification:**
- [ ] All patterns match current implementation
- [ ] Sources link to docs >= 2025
- [ ] No code examples (tables only)

**Last Updated:** 2026-02-23
