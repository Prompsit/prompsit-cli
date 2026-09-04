# Contributing to Prompsit CLI

## Setup

The supported runtime is defined only by `package.json#engines`.

```bash
git clone https://github.com/Prompsit/prompsit-cli.git
cd prompsit-cli
npm install
npm run dev -- --help
```

## Change workflow

1. Create a focused branch from the repository's default branch.
2. Follow [AGENTS.md](AGENTS.md) for code and test conventions.
3. Update the canonical document that owns any changed public or operational behavior.
4. Run the required checks.
5. Open a pull request describing the behavior change and verification performed.

```bash
npm run lint:all
npm run test:unit
npm run build
```

E2E tests use a real API stand and require valid `TEST_ACCOUNT` and `TEST_SECRET` values.

For CLI UX changes, include a short command/output example in the pull request. Do not commit credentials, telemetry keys, generated `dist/` output, or local configuration.

## Documentation ownership

- User-facing installation and examples: [README.md](README.md)
- Development, verification, and release operations: [runbook.md](docs/project/runbook.md)
- Module boundaries and runtime flows: [architecture.md](docs/project/architecture.md)
- CLI-consumed endpoints: [api_spec.md](docs/project/api_spec.md)
- Stable architectural rationale: [ADRs](docs/reference/adrs/)
- Release history: [CHANGELOG.md](CHANGELOG.md)

Avoid copying option lists, dependency versions, defaults, endpoint paths, or test counts into prose when code can remain their source of truth.

## Issues

Use [GitHub Issues](https://github.com/Prompsit/prompsit-cli/issues). Include the CLI version, Node.js version, operating system, shell, and minimal reproduction.
