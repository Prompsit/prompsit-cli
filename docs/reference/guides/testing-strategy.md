# Testing strategy

Tests exist to protect Prompsit behavior, data integrity, failure recovery, and external contracts. Test counts and coverage percentages are not goals.

## Portfolio

| Suite | Location | Purpose |
|---|---|---|
| Unit | `tests/unit/**/*.test.ts` | Deterministic business rules and failure contracts without network access |
| E2E | `tests/e2e/**/*.test.ts` | Selected user outcomes against a real API stand |

Vitest project configuration in [`vitest.config.ts`](../../../vitest.config.ts) owns discovery, isolation, timeouts, and pools.

## Selection rules

Keep a test when failure would reveal a distinct product risk: authentication/refresh, configuration safety, API validation, job lifecycle/cancellation, translation/evaluation/data output, output-file integrity, or a critical REPL contract.

Delete or merge tests that only prove a framework/library works, assert incidental formatting, repeat the same outcome at another layer, or survive while the protected behavior is broken.

## Test design

- Assert meaningful values and durable side effects, not only absence of exceptions.
- Mock at external seams; do not mock the internal path being verified.
- Give each test independent state and deterministic time.
- Use table-driven cases when one rule has multiple inputs.
- Add a regression test for a confirmed defect at the narrowest layer that can prove it.
- Keep live API breadth small; unit tests should carry permutations and failure branches.

## Commands

```bash
npm run test:unit
npm run test:e2e:critical
npm run test:e2e
```

E2E setup requires a reachable stand plus valid `TEST_ACCOUNT` and `TEST_SECRET`. It uses a temporary `PROMPSIT_DATA_DIR` and runs files serially to avoid shared account races. See the [runbook](../../project/runbook.md#end-to-end-tests).

When changing test infrastructure, prove discovery, isolation, and cleanup as well as assertions.
