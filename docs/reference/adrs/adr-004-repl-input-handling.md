# ADR-004: REPL Input Handling — pi-tui

**Date:** 2026-02-24 | **Status:** Accepted | **Category:** Technical | **Decision Makers:** Engineering Team

<!-- SCOPE: Architecture Decision Record for REPL input handling approach ONLY. Contains context, decision, rationale, alternatives. -->

---

## Revision History

| Date | Change |
|------|--------|
| 2026-02-15 | Initial: readline + keypress events |
| 2026-02-15 | Superseded: Migrated to Ink (React terminal UI) after readline layout issues |
| 2026-02-24 | **Current:** Migrated from Ink to `@mariozechner/pi-tui` for simpler, lighter TUI |

---

## Context

The REPL needs interactive features: command completion, persistent status bar, history navigation. Previously used Ink (React for terminal), which added 3 runtime deps (`ink`, `react`, `@inkjs/ui`) and required JSX transform (`tsx` loader).

### Why Ink was replaced

| Issue | Impact |
|-------|--------|
| 3 runtime dependencies (ink, react, @inkjs/ui) | Bundle bloat, version conflicts |
| JSX transform required | `tsx` loader in dev, `react-jsx` in tsconfig |
| React component model overhead | Overkill for a prompt + status bar |
| Ink v6 maintenance uncertainty | Single maintainer project |

---

## Decision

Use **`@mariozechner/pi-tui`** — a lightweight terminal UI library with built-in editor, completion, and layout primitives.

```
REPL Loop
    ↓
pi-tui terminal editor
    ↓
┌─────────────────────────────┐
│ › user input here           │ ← pi-tui editor with completion
│ ────────────────────────    │ ← separator
│ tip | auth | env | lang     │ ← status bar
└─────────────────────────────┘
```

---

## Rationale

| Factor | Decision Rationale |
|--------|-------------------|
| Single dependency | `@mariozechner/pi-tui` replaces `ink` + `react` + `@inkjs/ui` |
| No JSX required | Plain TypeScript, no transform needed |
| Built-in editor | Handles input, cursor, history natively |
| Completion support | Built-in completion list rendering |
| Lighter runtime | No React reconciler overhead |

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| **Ink v6 (React)** | 3 deps, JSX required, React overhead — was previous solution |
| **readline + keypress** | Architecturally incompatible with persistent multi-line layout (see Revision History) |
| **terminal-kit** | +19 deps; 1 maintainer; CJS; no TS types |

---

## Consequences

| Type | Consequence |
|------|------------|
| Positive | Single dependency instead of 3 |
| Positive | No JSX transform — plain TypeScript throughout |
| Positive | Lighter runtime footprint |
| Positive | Built-in editor with history and completion |
| Negative | Less ecosystem support than React/Ink |

---

## Implementation

| File | Role |
|------|------|
| `src/repl/loop.ts` | REPL main loop using pi-tui |
| `src/repl/controller.ts` | Input processing and dispatch |
| `src/repl/executor.ts` | Command execution with process.exit guard |
| `src/repl/registry.ts` | Command registry for completion |
| `src/tui/settings-screen.ts` | TUI settings screen using pi-tui |

---

## Maintenance

**Update Triggers:**
- If `@mariozechner/pi-tui` introduces breaking API changes
- When adding new TUI features (split panes, scrollable output)

**Last Updated:** 2026-02-24
