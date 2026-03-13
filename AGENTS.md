# Repository Guidelines

<!-- SCOPE: Code style, structure, testing, and commit guidelines for AI agents and contributors. -->
<!-- DO NOT add here: CLI usage -> README.md, Architecture -> docs/project/architecture.md, Commands -> docs/project/runbook.md -->

## Project Structure

See [CLAUDE.md § Folder Structure](CLAUDE.md#folder-structure) and [architecture.md § Component Breakdown](docs/project/architecture.md#52-component-breakdown).

## Coding Style & Naming Conventions

- TypeScript strict mode (`strict: true` in tsconfig.json)
- ESM modules (`"type": "module"` in package.json)
- TUI via `@mariozechner/pi-tui` (replaced Ink)
- Commander.js with `@commander-js/extra-typings` for type-safe CLI
- Prefer clear module boundaries: CLI wiring in `commands/`, API calls in `api/`, config in `config/`

**For detailed conventions:** See [docs/project/tech_stack.md](docs/project/tech_stack.md) and [docs/principles.md](docs/principles.md)

## Testing Guidelines

- Framework: Vitest
- Naming: `tests/unit/*.test.ts`, `tests/e2e/**/*.test.ts`
- Tests should avoid real network calls; prefer mocks/fixtures

**For detailed testing strategy:** See [docs/reference/guides/testing-strategy.md](docs/reference/guides/testing-strategy.md)

## Commit & Pull Request Guidelines

- Git history uses short, direct messages like "Added ...", "Updated ...", "Fixed ...". Keep commits scoped and readable.
- PRs: describe behavior change, link issue/story if available, include CLI output snippet for UX changes, and ensure `npm run typecheck` and `npm test` pass.

## Security & Configuration Tips

- Never commit secrets. Auth tokens stored in `~/.prompsit/credentials.json`; runtime config at `~/.prompsit/config.toml`.
- Environment variables use `PROMPSIT_` with `__` nesting (e.g., `PROMPSIT_API__BASE_URL`).

**For detailed security guidelines:** See [docs/principles.md](docs/principles.md#security-by-design)
