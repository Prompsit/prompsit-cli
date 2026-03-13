# Patterns Catalog

Architectural patterns with 4-score evaluation.

> **SCOPE:** Pattern inventory with scores, ADR/Guide links, drift baselining, and dependency/layer health.
> **Last Audit:** 2026-02-28

---

## Score Legend

| Score | Measures | Threshold |
|-------|----------|-----------|
| **Compliance** | Industry standards, naming, tech stack conventions, layer boundaries | 70% |
| **Completeness** | All components, error handling, observability, tests | 70% |
| **Quality** | Readability, maintainability, SOLID, no smells, no duplication | 70% |
| **Implementation** | Code exists, production use, monitored | 70% |

---

## Pattern Inventory

| # | Pattern | ADR | Guide | Compl | Complt | Qual | Impl | Avg | Notes | Story |
|---|---------|-----|-------|-------|--------|------|------|-----|-------|-------|
| 1 | Configuration (Zod + smol-toml) | [ADR-003](../reference/adrs/adr-003-configuration.md) | [G-02](../guides/02-toml-config-management-smol-toml.md) | 100% | 77% | 95% | 90% | **91%** | `buildCliKeyMap()` hardcodes schema fields (H); missing logging | - |
| 2 | DTO (Zod Schemas + z.infer) | - | [G-01](../guides/01-input-validation-zod-schemas.md) | 93% | 88% | 93% | 95% | **92%** | Zod bypass in evaluation.ts **fixed** (CS6) | - |
| 3 | Command (Commander.js + extra-typings) | [ADR-001](../reference/adrs/adr-001-cli-framework.md) | [G-06](../guides/06-cli-patterns-signal-handling.md) | 92% | 82% | 90% | 95% | **90%** | `data.ts` at 387 LOC approaching god-file threshold (H) | - |
| 4 | Retry/Resilience (got built-in) | [ADR-002](../reference/adrs/adr-002-http-client.md) | [G-04](../guides/04-http-retry-rate-limiting.md) | 93% | 77% | 89% | 95% | **89%** | `external-transport.ts` duplicates retry logic (H); no unit tests | - |
| 5 | Hybrid Token Refresh | [ADR-002](../reference/adrs/adr-002-http-client.md) | [G-05](../guides/05-oauth2-ropc-cli-authentication.md) | 95% | 85% | 95% | 85% | **90%** | Clean proactive+reactive; missing structured logging (M) | - |
| 6 | Resource Cleanup (try/finally) | - | [G-06](../guides/06-cli-patterns-signal-handling.md) | 95% | 80% | 85% | 95% | **89%** | Spinner try/finally **fixed** (CS9) | - |
| 7 | Cache (memory + file-utils.ts) | - | [G-02](../guides/02-toml-config-management-smol-toml.md) | 80% | 67% | 94% | 88% | **82%** | No TTL (H); logging **added** (CS8) | - |
| 8 | Event Hook (got hooks + curl.ts) | [ADR-002](../reference/adrs/adr-002-http-client.md) | [G-04](../guides/04-http-retry-rate-limiting.md) | 95% | 88% | 92% | 93% | **92%** | All 4 got lifecycle hooks typed; hook factory not pluggable (M) | - |
| 9 | Error Matching (errors/catalog.ts) | - | [G-03](../guides/03-error-handling-rfc9457.md) | 95% | 90% | 90% | 90% | **91%** | Dead export `ErrorRule` **fixed** (CS10); `CancelledError` not in catalog | - |
| 10 | Chain of Responsibility (RFC 9457) | - | [G-03](../guides/03-error-handling-rfc9457.md) | 92% | 83% | 93% | 90% | **90%** | `parseApiError()` if-else cascade needs composable chain (H) | - |
| 11 | REPL (pi-tui + output bridge) | [ADR-004](../reference/adrs/adr-004-repl-input-handling.md) | [REPL Guide](../reference/guides/repl-output-contract.md) | 95% | 92% | 85% | 90% | **91%** | 12 E2E tests; `controller.ts` at 512 LOC (M) | - |
| 12 | i18n (self-translating) | - | [Logging Policy](../reference/guides/logging-policy.md) | 90% | 75% | 90% | 85% | **85%** | No error translation in adapter (M); no retry for batch API | - |

**Column reference:**
- `ADR` - Architecture Decision Record (strategic decisions)
- `Guide` - Implementation guide or operational policy
- `Notes` - Inline context for scoring

---

## Discovered Patterns (Adaptive)

Patterns found via Phase 1b heuristic discovery and verified with code evidence.

| # | Pattern | Confidence | Evidence | Compl | Complt | Qual | Impl | Avg | Story |
|---|---------|------------|----------|-------|--------|------|------|-----|-------|
| 1 | Strategy (SSE/Polling trackers) | HIGH | `src/commands/job-tracking.ts` (`JobTracker`, `SSETracker`, `PollingTracker`) | 95% | 70% | 82% | 90% | **84%** | - |
| 2 | Registry (REPL command registry) | HIGH | `src/repl/registry.ts` | 95% | 70% | 95% | 70% | **83%** | Duplicate name check **added** (CS7) |
| 3 | HTTP Client (transport abstraction) | HIGH | `src/api/transport.ts`, `src/api/client.ts` | 95% | 85% | 76% | 90% | **87%** | - |
| 4 | Fail-Fast Validation | HIGH | `.parse()` / `.safeParse()` in `src/api/resources/*`, `src/commands/error-handler.ts` | 100% | 80% | 95% | 85% | **90%** | - |
| 5 | Batch Processor | HIGH | `src/commands/batch-processor.ts`, `translate.ts`, `data.ts`, `evaluate.ts` | 100% | 70% | 90% | 85% | **86%** | - |

---

## Layer Boundary Status

Audit results from `ln-642-layer-boundary-auditor` (`docs/project/.audit/642-layer-boundary.md`). Score: **6.2/10**.

**Post-remediation:** 4 of 5 active violations resolved (CS1, CS2, CS4, CS5). 1 remaining (curl state scatter, MEDIUM).

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Layer Violations | 5 remaining (0C, 0H, 1M, 4L) | 0 | WARNING |
| Resolved (CS1-CS5) | 4 violations (1H + 2M + 1M) | - | RESOLVED |
| HTTP Abstraction Coverage | 100% | 90% | PASS |
| Error Handling Centralized | Yes | Yes | PASS |

### Active Layer Violations

| # | File | Violation | Severity | Status |
|---|------|-----------|----------|--------|
| ~~1~~ | ~~`src/runtime/progress-adapters.ts`~~ | ~~Infrastructure→Application type import~~ | ~~HIGH~~ | **RESOLVED** (CS2) |
| ~~2~~ | ~~`src/commands/config/shared.ts`~~ | ~~Raw TOML parsing~~ | ~~MEDIUM~~ | **RESOLVED** (CS5) |
| ~~3~~ | ~~`src/commands/config/reset.ts`~~ | ~~Raw `fs.rmSync`~~ | ~~MEDIUM~~ | **RESOLVED** (CS5) |
| 4 | `src/api/curl.ts` state scattered | 6+ files set/read curl state | MEDIUM | OPEN |
| ~~5~~ | ~~`src/constants.ts` root-level~~ | ~~Phantom cycles~~ | ~~MEDIUM~~ | **RESOLVED** (CS4) |

---

## API Contract Status

Audit results from `ln-643-api-contract-auditor` (`docs/project/.audit/643-api-contract.md`). Score: **9.6/10** (C:100 K:95 Q:93 I:95).

| Check | Status | Details |
|-------|--------|---------|
| Layer Leakage (R1) | PASS | Command layer does not import `got` types; resources use typed wrappers |
| Missing DTO (R2) | PASS | All resource methods with 3+ params use typed DTOs |
| Entity Leakage (R3) | PASS | All API responses validated via Zod schemas at resource boundary |
| Error Contracts (R4) | WARNING | SSE parsing uses `return null` vs throw-only contract elsewhere (advisory) |
| Redundant Overloads (R5) | PASS | 3 transport methods serve fundamentally different response types |
| New binary methods | PASS | `requestRaw()`, `requestToFile()` have typed returns, no contract violations |
| Batch processor | PASS | `BatchOptions<T,R>` is clean addition without contract leakage |

---

## Dependency Graph Status

Audit results from `ln-644-dependency-graph-auditor` (`docs/project/.audit/644-dep-graph.md`). Score: **3.8/10**.

**Post-remediation:** All 7 findings resolved (CS1-CS4). Verified by `dependency-cruiser` (0 violations, 148 modules, 529 dependencies).

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Transitive Cycles | ~~1 CRITICAL~~ → 0 | 0 | **RESOLVED** (CS1+CS2+CS3) |
| Pairwise Cycles | ~~1 HIGH~~ → 0 | 0 | **RESOLVED** (CS1) |
| NCCD | ~~3.35~~ → pending re-audit | < 2.0 | **RESOLVED** (CS4 eliminated phantom cycles) |
| SDP Violations | ~~1 HIGH~~ → 0 | 0 | **RESOLVED** (CS3) |
| Phantom cycles via `constants.ts` | ~~4~~ → 0 | 0 | **RESOLVED** (CS4) |

## Reuse Opportunity Status

Audit results from `ln-645-open-source-replacer` (`docs/project/.audit/645-open-source-replacer.md`). Score: **9.1/10** (separate metric, not in health score).

| Metric | Value |
|--------|-------|
| Modules scanned | 45 (>= 100 LOC) |
| Domain-specific excluded | 40 |
| Utility/integration analyzed | 5 |
| Actionable replacements | 1 (MEDIUM: `prompts.ts` -> `@inquirer/prompts`) |
| Verdict | Codebase clean from reinvented wheels |

---

## Quick Wins (< 4h effort)

All quick wins from 2026-02-28 audit have been implemented:

| Pattern | Issue | CS | Status |
|---------|-------|----|--------|
| Dep Graph | `constants.ts` phantom cycles | CS4 | **RESOLVED** |
| Registry | Duplicate names silently overwrite | CS7 | **RESOLVED** |
| Resource Cleanup | Spinner not in `finally` block | CS9 | **RESOLVED** |
| Cache | Zero logging | CS8 | **RESOLVED** |
| Error Matching | Dead export `ErrorRule` | CS10 | **RESOLVED** |

---

## Patterns Requiring Attention

### Score < 70% (Story Required)

| Pattern | Avg | Issue | Recommendation | Effort | Story |
|---------|-----|-------|----------------|--------|-------|
| - | - | None in current audit | Continue monitoring in next cycle | - | - |

### Score 70-80% (Improvement Planned)

| Pattern | Avg | Issue | Recommendation | Effort | Story |
|---------|-----|-------|----------------|--------|-------|
| Cache (memory + file-utils.ts) | 82% | No TTL (H); logging added (CS8) | Add TTL metadata | S | - |

### Dependency Graph Issues (Architectural Debt)

All dependency graph issues from 2026-02-28 audit have been resolved:

| Priority | Issue | CS | Status |
|----------|-------|----|--------|
| ~~CRITICAL~~ | ~~Transitive cycle `api→logging→runtime→i18n→api`~~ | CS1+CS2+CS3 | **RESOLVED** |
| ~~HIGH~~ | ~~Pairwise cycle `logging↔runtime`~~ | CS1 | **RESOLVED** |
| ~~HIGH~~ | ~~NCCD 3.35~~ | CS4 | **RESOLVED** |
| ~~HIGH~~ | ~~SDP: `i18n`→`api`~~ | CS3 | **RESOLVED** |

---

## Pattern Recommendations

Suggested patterns based on codebase conditions (advisory, not scored).

| Condition Found | Recommended Pattern | Rationale | Status |
|-----------------|---------------------|-----------|--------|
| ~~`logging↔runtime` cycle~~ | ~~Self-contained Logging HTTP~~ | ~~Move HTTP push helper into `logging/`~~ | **RESOLVED** (CS1) |
| `transport.ts` at 407 LOC with 3 methods | Extract Hook Factory | Separate `createGotHooks()` into `src/api/hooks.ts`; make hook chain pluggable (OCP) | OPEN |
| `parseApiError()` 76-line if-else cascade | Composable Chain | Refactor into array of parser functions, each returning `APIError \| null` | OPEN |
| No `IHttpTransport` interface | Dependency Inversion | Extract interface for testability; remove `as any` casts in tests | OPEN |
| ~~i18n coupled to API client~~ | ~~Adapter + Port~~ | ~~`translator-adapter.ts` in `i18n/`~~ | **RESOLVED** (CS3: moved to `api/`) |

---

## Excluded Patterns

Patterns detected by keywords but excluded after applicability verification.

| # | Pattern | Source | Keywords Found | Exclusion Reason | Last Seen |
|---|---------|--------|---------------|-----------------|-----------|
| 1 | Repository | Baseline | `Repository`, `findBy` | Found naming hints, but no repository interface + implementation pair in CLI architecture | 2026-02-22 |
| 2 | CQRS | Baseline | `Command`/`Query` terms | Commander command naming only; no read/write model separation | 2026-02-22 |
| 3 | Event Sourcing | Baseline | `Event*` symbols | Event terms map to SSE/runtime events, not event-store/aggregate architecture | 2026-02-22 |
| 4 | Message Queue | Baseline | `Queue`/`Job` keywords | Polling/SSE job tracking present, but no broker consumer/producer architecture | 2026-02-22 |
| 5 | Saga | Baseline | `step`/`workflow` tokens | No compensation workflow orchestration detected | 2026-02-22 |
| 6 | API Gateway | Baseline | `gateway`/`proxy` terms in docs | CLI is client app, not gateway/router service boundary | 2026-02-22 |
| 7 | Package Manager Update | Previous inventory | `src/update/`, `src/commands/update.ts` | Code fully deleted; update delegated to npm directly (`npm install -g`) | 2026-02-24 |

---

## Summary

**Architecture Health Score:** 84% → **improved** (post-remediation, pending formal re-audit). See [architecture_health.md](architecture_health.md).

Formula: `avg(17 pattern avgs/10 + layer/10 + api/10 + dep_graph/10) * 10` — all 20 values normalized to 0-10 scale, then averaged and scaled to percentage.

**Trend:** 85% → 84% → **↑ expected** (all cycles eliminated, 5 quick wins resolved, dependency graph 3.8→expected ≥8.0).

| Status | Count | Patterns |
|--------|-------|----------|
| Healthy (85%+) | 15 | Configuration, DTO, Command, Retry/Resilience, Hybrid Token Refresh, Resource Cleanup, Event Hook, Error Matching, Chain of Responsibility, REPL, i18n, HTTP Client, Fail-Fast Validation, Batch Processor, Registry (83%→borderline) |
| Warning (70-84%) | 2 | Cache (82%), Strategy (84%) |
| Critical (<70%) | 0 | - |

### Top Systemic Issues

All 4 systemic issues from 2026-02-28 audit have been resolved:

| # | Issue | CS | Status |
|---|-------|----|--------|
| ~~1~~ | ~~Transitive cycle `api→logging→runtime→i18n→api`~~ | CS1+CS2+CS3 | **RESOLVED** |
| ~~2~~ | ~~`logging↔runtime` pairwise cycle~~ | CS1 | **RESOLVED** |
| ~~3~~ | ~~`constants.ts` phantom cycles~~ | CS4 | **RESOLVED** |
| ~~4~~ | ~~`JSON.parse(header) as Record` Zod bypass~~ | CS6 | **RESOLVED** |

### Research Sources (2026-02-28)

- Batch processing patterns in TypeScript: <https://www.harshajayamanna.com/2026/02/micro-batch-processing-in-python-java-and-typescript-node.html>
- Got retry API: <https://github.com/sindresorhus/got/blob/main/documentation/7-retry.md>
- Zod parsing and safeParse guidance: <https://zod.dev/basics>
- pi-tui package info: <https://www.npmjs.com/package/@mariozechner/pi-tui>

---

## Maintenance

**Updated by:** ln-640-pattern-evolution-auditor (21 subagents)
**Layer audit by:** ln-642-layer-boundary-auditor
**API contract audit by:** ln-643-api-contract-auditor
**Dependency graph audit by:** ln-644-dependency-graph-auditor
**OSS replacement audit by:** ln-645-open-source-replacer

**Update Triggers:**
- New pattern implemented
- Pattern refactored
- ADR/Guide updated
- Layer/dependency violations remediated

**Next Audit:** 2026-03-28 (30 days)

---
**Template Version:** 3.0.0
