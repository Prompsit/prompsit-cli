# Documentation map

This index routes each reader to one canonical owner. Command definitions, schemas, manifests, and CI configuration remain authoritative for machine-verifiable details.

| Need | Read | Source of truth |
|---|---|---|
| Install and use the CLI | [Root README](../README.md) | `prompsit --help` and `src/commands/` |
| Develop, verify, configure, or release | [Runbook](project/runbook.md) | `package.json#scripts`, config schemas, CI files |
| Understand modules and runtime flows | [Architecture](project/architecture.md) | Source imports and `.dependency-cruiser.cjs` |
| Inspect CLI-consumed API routes | [API contract](project/api_spec.md) | `src/shared/constants.ts`, API resources, Zod schemas |
| Operate logs and telemetry | [Observability](project/observability-operations.md) | `src/logging/` and config schemas |
| Understand stable design choices | [ADRs](reference/adrs/) | Accepted ADR plus current implementation |
| Change logging behavior | [Logging contract](reference/guides/logging-policy.md) | `src/logging/` and terminal adapters |
| Change tests | [Testing strategy](reference/guides/testing-strategy.md) | `vitest.config.ts` and current tests |
| Change REPL output events | [REPL output contract](reference/guides/repl-output-contract.md) | `src/repl/core/output-bridge.ts` |

## Ownership rules

- Do not copy full option lists, dependency versions, configuration defaults, route inventories, or test counts outside their canonical owner.
- Use links to code for volatile facts and keep prose for user tasks, contracts, constraints, and rationale.
- Keep point-in-time audits, task reports, article drafts, and generated research out of the maintained documentation tree.
- Update a document only when its owned behavior changes. Git history is the archive.
