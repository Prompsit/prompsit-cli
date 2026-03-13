# ADR-001: CLI Framework (Commander.js)

**Date:** 2026-02-15 | **Status:** Accepted | **Category:** cli_framework | **Decision Makers:** Engineering Team

<!-- SCOPE: Architecture Decision Record for CLI framework selection ONLY. Contains context, decision, rationale, consequences, alternatives. -->
<!-- DO NOT add here: Implementation code -> commands/*.ts, API design -> api_spec.md, Architecture diagrams -> architecture.md -->

---

## Context

The CLI requires a framework for a translation API client with 12 command files, nested subcommands (`translate text`, `translate file`, `evaluate metrics`), and type-safe option parsing. REPL mode is handled separately by `@mariozechner/pi-tui`, so the framework only needs to cover command parsing and routing. TypeScript strict mode demands full type inference for `.opts()` and `.action()` parameters.

---

## Decision

Use **Commander.js 14+** with `@commander-js/extra-typings` for type-safe CLI commands.

---

## Rationale

1. **Type-safe options via `@commander-js/extra-typings`** -- `.opts()` returns inferred types from `.option()` definitions, `.action()` parameters are fully typed. No manual type declarations needed.
2. **Fluent subcommand API** -- `.command("translate").command("text")` creates nested groups naturally. Each command file exports a `Command` instance, composed in `src/index.ts`.
3. **Zero-config help generation** -- `.description()`, `.option()`, `.argument()` automatically generate `--help` output. No custom formatters required.

---

## Consequences

**Positive:**
- Type inference eliminates option type declarations (auto-inferred from `.option()` flags)
- Each command file is self-contained (`new Command("name")` pattern)
- Global options via `.passThroughOptions()` and parent command hooks
- 47M+ weekly npm downloads -- largest CLI framework ecosystem in Node.js

**Negative:**
- REPL requires separate solution (Commander.js is one-shot parse) -- solved by pi-tui
- No built-in Rich-like output -- solved by chalk + cli-table3
- `@commander-js/extra-typings` is a separate package (maintained by Commander.js team)

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|--------------|
| **yargs** | Mature, middleware support, auto-completion | Verbose chaining API, weaker TS inference than extra-typings, complex middleware model | Type inference less ergonomic; Commander's fluent API is simpler for our use case |
| **oclif** (Salesforce) | Plugin system, code generation, built-in testing | Heavy framework (class-based commands), opinionated structure, large dependency tree (~50 deps) | Over-engineered for a single CLI; plugin system unnecessary |
| **clipanion** (Yarn) | Excellent TS support (class decorators), built-in validation | Small ecosystem, class-based (not functional), less documentation | Decorator-based API doesn't match our functional command pattern |

---

## Related Decisions

- ADR-004: REPL Input Handling (pi-tui) -- REPL separated from command parsing
- ADR-002: HTTP Client (got) -- commands use got for API calls
- ADR-003: Configuration (Zod + smol-toml) -- commands read typed settings

---

**Last Updated:** 2026-02-15
