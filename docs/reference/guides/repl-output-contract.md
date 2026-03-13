# REPL Output Contract

This document defines the runtime event contract between the terminal output port and the REPL output bridge.

## Event Model

- `kind: "text"`: stdout text payload.
- `kind: "table"`: stdout structured table payload.
- `kind: "system"`: stderr diagnostic/status payload with a `level`.
- `kind: "command"`: REPL-local command echo emitted by `ReplService` before command execution.

## Stream Rules

- `stdout` must use `text` or `table` (and `command` for REPL command echo).
- `stderr` must use `system` only.

## Producer Rules

- `terminal.line/json/table` write to stdout.
- `terminal.info/dim/warn/success/error` write to stderr as `system`.
- `terminal.prompt` is CLI-interactive only and must not be used in REPL mode.

## Consumer Rules

- REPL renderer (`history-render`) must treat `system` as pre-styled message text and render as-is.
- Tests should assert stream/kind contract (`stderr -> system`) rather than depending on incidental table/text formatting.
