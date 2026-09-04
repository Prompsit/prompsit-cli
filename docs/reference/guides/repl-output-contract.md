# REPL output contract

The terminal port and REPL bridge exchange structured events:

| Kind | Meaning |
|---|---|
| `text` | stdout text |
| `table` | stdout table model |
| `system` | stderr status, warning, hint, or error with a level |
| `command` | non-sensitive REPL command echo |

`terminal.line`, `terminal.json`, and `terminal.table` produce stdout events. Informational, warning, success, and error methods produce `system` events. `terminal.prompt` is CLI-only.

Sensitive commands must produce neither persistent history nor a command echo. The renderer treats system message text as already styled. Tests should assert event kind, stream ownership, ordering, and sensitive-data exclusion rather than incidental wrapping or color codes.

The event types in [`src/repl/core/output-bridge.ts`](../../../src/repl/core/output-bridge.ts) are authoritative.
