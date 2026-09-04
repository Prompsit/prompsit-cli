# Repository guidelines

These are the authoritative repository-wide instructions for contributors and coding agents.

## Sources of truth

| Subject | Canonical source |
|---|---|
| CLI commands and flags | Commander definitions in `src/program.ts` and `src/commands/`; verify with `prompsit --help` |
| Configuration keys and defaults | `src/config/schemas.ts` and `src/config/constants.ts` |
| API paths | `src/shared/constants.ts` |
| Dependencies and runtime floor | `package.json` and `package-lock.json` |
| Architecture boundaries | `.dependency-cruiser.cjs` and [architecture.md](docs/project/architecture.md) |
| Development and release commands | `package.json#scripts` and [runbook.md](docs/project/runbook.md) |
| Public usage | [README.md](README.md) |

## Code

- TypeScript strict mode and ESM are mandatory.
- Keep CLI wiring in `src/commands/`, transport and API resources in `src/api/`, settings in `src/config/`, terminal presentation in `src/output/`, and interactive behavior in `src/repl/`.
- Use `@commander-js/extra-typings` for commands and `@earendil-works/pi-tui` for TUI behavior.
- Route user-facing output through the terminal port. Do not write directly to stdout or stderr outside its adapters.
- Never log or persist credentials. REPL-sensitive commands must be recognized by `src/repl/sensitive-command.ts`.
- Preserve unrelated working-tree changes.

## Tests and verification

- Keep tests that protect Prompsit business behavior, data integrity, failure recovery, or external contracts.
- Do not test framework internals or duplicate the same outcome at multiple layers without a distinct risk.
- Unit tests must not use the network. E2E tests target a selected real API stand and must isolate local state.
- Before handoff, run `npm run lint:all`, `npm run test:unit`, and `npm run build`. Run relevant E2E tests when valid stand credentials are available.

## Documentation

Write project documentation in English. Keep one canonical owner per topic and link to it from secondary entrypoints. Prefer durable contracts and rationale over copied inventories, version tables, status snapshots, or implementation narration.

## Commits and pull requests

Use short, scoped commit messages. Pull requests should explain the behavior change, its risk, and verification; include CLI output for UX changes.
