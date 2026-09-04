# ADR-004: pi-tui REPL

**Status:** Accepted; supersedes the earlier readline and Ink implementations.

## Context

Interactive mode needs a persistent layout, editor, completion, history navigation, selectable output, progress, and cross-platform input handling without maintaining a second command implementation.

## Decision

Use `@earendil-works/pi-tui` for terminal UI primitives. Dispatch commands through the shared Commander program. Keep command metadata in the REPL registry and route output through structured terminal events.

## Consequences

- REPL UI code is plain TypeScript without React/JSX.
- CLI and REPL share command behavior and differ only at the presentation adapter.
- Command history and output history are separate; sensitive commands enter neither persistent history nor command echo.
- Rendering must preserve event ordering, width-aware wrapping, selection, scrolling, and bounded history.
- TUI upgrades must be validated through these contracts rather than library-internal behavior.

The prior implementations are historical git state, not maintained documentation.
