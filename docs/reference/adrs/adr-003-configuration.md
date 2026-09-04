# ADR-003: Zod-validated TOML configuration

**Status:** Accepted

## Context

The CLI needs readable persistent settings, environment overrides for automation, typed defaults, and safe writes across CLI and TUI entrypoints.

## Decision

Use Zod schemas for keys, defaults, coercion, and validation; use `smol-toml` for `~/.prompsit/config.toml`. Effective precedence is environment variables over TOML over schema defaults.

## Consequences

- `src/config/schemas.ts` is the key/default source of truth.
- CLI key names are derived from schema fields.
- Writes validate the complete candidate and replace the file atomically.
- Invalid configuration produces diagnostics and disables network commands until corrected.
- Credentials remain in a separate JSON store with atomic writes and a cross-process lock.

New settings must be added to the schema and surfaced through `config show`; documentation should not duplicate the complete key inventory.
