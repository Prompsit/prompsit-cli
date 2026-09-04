# Claude Code entrypoint

Follow [AGENTS.md](AGENTS.md); it is the single repository-wide instruction source.

Prompsit CLI is a strict-TypeScript, ESM command-line client for translation, quality evaluation, data processing, and translation-memory operations. The executable starts in [src/index.ts](src/index.ts), command registration lives in [src/program.ts](src/program.ts), and running without arguments starts the REPL.

Use the documentation map at [docs/README.md](docs/README.md). In particular:

- [Runbook](docs/project/runbook.md) for commands, verification, configuration, and OIDC release behavior.
- [Architecture](docs/project/architecture.md) for module boundaries and runtime flows.
- [API contract](docs/project/api_spec.md) for the routes consumed by this CLI.
- [ADRs](docs/reference/adrs/) for stable design rationale.

The adjacent `../prompsit-api/` checkout, when present, is a read-only reference from this repository. Make API changes only from that project's own working directory and instructions.
