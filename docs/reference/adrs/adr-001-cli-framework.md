# ADR-001: Commander.js command model

**Status:** Accepted

## Context

The CLI needs nested commands, typed options, generated help, predictable parse errors, and reuse of the same command graph from one-shot and REPL execution.

## Decision

Use `@commander-js/extra-typings` to define the command tree. `src/program.ts` owns composition; command modules own workflow handlers. REPL metadata remains in `src/repl/registry.ts` and maps to Commander paths.

## Consequences

- Command help is the option-reference source of truth.
- Added commands must be registered in the program and, when exposed interactively, in the REPL registry.
- Commands added with `addCommand()` require the repository's inherited-setting propagation.
- Parser failures are mapped to the CLI usage exit contract.

Alternatives such as a custom parser or parser generator are not justified by the current command grammar.
