# Architecture Health Timeline

> **SCOPE:** Append-only health history for architecture drift detection. Scores from ln-640 audits only.

## 2026-02-22

| Metric | Score | Prev | Delta | Status |
|--------|-------|------|-------|--------|
| Health Score | 85 | N/A | N/A | OK |
| Layer Boundary | 7.8/10 | N/A | N/A | WARNING |
| API Contract | 8.3/10 | N/A | N/A | OK |
| Dependency Graph | 6.5/10 | N/A | N/A | ACTION_REQUIRED |
| Pattern: Cache | 80/74/78/80 | N/A | N/A | WARNING |
| Pattern: REPL | 88/79/82/84 | N/A | N/A | WARNING |
| Pattern: CLI Update | 86/80/84/86 | N/A | N/A | WARNING |
| Pattern: Strategy (SSE/Polling) | 86/80/82/84 | N/A | N/A | WARNING |
| Pattern: Registry | 85/82/84/85 | N/A | N/A | WARNING |

Baseline run detected with no prior snapshot for drift comparison.

SLA Breaches: 1 | Stories Created: 0 (Log-only mode)

ACTION_REQUIRED: Dependency graph SLA violated (`cycles_detected > 0`).
Remediation target: break SCCs in (`config <-> logging`) and (`cli/output/repl/i18n/errors/api`) before next audit.

## 2026-02-24

| Metric | Score | Prev | Delta | Status |
|--------|-------|------|-------|--------|
| Health Score | 85 | 85 | 0 | OK |
| Layer Boundary | 7.2/10 | 7.8/10 | -0.6 | WARNING |
| API Contract | 8.3/10 | 8.3/10 | 0 | OK |
| Dependency Graph | 7.2/10 | 6.5/10 | +0.7 | IMPROVED |
| Pattern: Cache | 80/74/78/80 | 80/74/78/80 | 0 | WARNING |
| Pattern: REPL | 90/82/85/88 | 88/79/82/84 | +3/+3/+3/+4 | IMPROVED |
| Pattern: i18n | 88/86/84/87 | 88/86/84/87 | 0 | WARNING |
| Pattern: Strategy (SSE/Polling) | 86/80/82/84 | 86/80/82/84 | 0 | WARNING |
| Pattern: Registry | 85/82/84/85 | 85/82/84/85 | 0 | WARNING |

**Key Changes:**
- Pattern #12 (Package Manager Update) **REMOVED** — `src/update/` code fully deleted
- Large SCC (`cli/output/repl/i18n/errors/api`) **RESOLVED** — modules now singletons
- `config <-> logging` cycle **MUTATED** → `logging <-> runtime` cycle (same root cause, different path)
- Previous 3 layer violations **ALL RESOLVED**, 14 new violations detected (2H, 5M, 7L)
- REPL scores improved: pi-tui migration completed, ADR-004 rewritten

SLA Breaches: 1 | Stories Created: 0 (Log-only mode)

ACTION_REQUIRED: Dependency graph SLA still violated (`cycles_detected > 0`).
Remediation target: break `logging <-> runtime` cycle by extracting zero-dep HTTP utility.

## 2026-02-28

| Metric | Score | Prev | Delta | Status |
|--------|-------|------|-------|--------|
| Health Score | 84 | 85 | -1 | OK |
| Layer Boundary | 6.2/10 | 7.2/10 | -1.0 | WARNING |
| API Contract | 9.6/10 | 8.3/10 | +1.3 | IMPROVED |
| Dependency Graph | 3.8/10 | 7.2/10 | -3.4 | **ACTION_REQUIRED** |
| Reuse Opportunity | 9.1/10 | N/A | N/A | OK |
| Pattern: Cache | 80/57/94/88 (80%) | 80/74/78/80 (78%) | +2 avg | WARNING |
| Pattern: Registry | 95/55/95/55 (75%) | 85/82/84/85 (84%) | -9 avg | WARNING |
| Pattern: Strategy (SSE/Polling) | 95/70/82/90 (84%) | 86/80/82/84 (83%) | +1 avg | WARNING |
| Pattern: Batch Processor (NEW) | 100/70/90/85 (86%) | N/A | N/A | OK |

**Key Changes:**
- **NEW CRITICAL:** Transitive cycle `api→logging→runtime→i18n→api` discovered (4-module, escalation of `logging↔runtime`)
- **NEW pattern:** Batch Processor added to Discovered Patterns (86%, HIGH confidence)
- **Methodology correction (ln-642):** Presentation→Infrastructure reclassified as allowed in top-down layers; real violations reduced from 14 to 9, but stricter scoring applied
- **Registry score artifact:** Drop 84%→75% is Generic Scoring methodology stricter, not code degradation (refactoring improved code)
- API Contract improved significantly (+1.3): new binary methods (`requestRaw`, `requestToFile`) have clean typed returns
- REPL improved: 12 E2E tests added, controller still 512 LOC (MEDIUM)
- `JSON.parse(header) as Record` in evaluation.ts confirmed as Zod bypass by 2 workers independently
- NCCD degraded: 3.35 (threshold 2.0) — highly coupled dependency graph

**SLA Breaches: 1 incident (2 rules)** | Stories Created: 0 (Log-only mode)

| SLA Rule | Threshold | Actual | Status |
|----------|-----------|--------|--------|
| Health >= 70 | 70 | 84 | PASS |
| Health drop < 10 | 10 | 1 | PASS |
| No new critical violations | 0 | 1 (transitive cycle) | **BREACH** |
| No new cycles | 0 | 1 (transitive cycle) | **BREACH** |
| Per-pattern drop < 15% | 15 | 9 (Registry) | PASS |

ACTION_REQUIRED: Dependency graph SLA breached — new CRITICAL transitive cycle `api→logging→runtime→i18n→api` (note: `runtime→i18n` edge is type-only `import type`).

### Remediation Completed (2026-02-28)

All 10 change sets (CS1-CS10) implemented and verified. `dependency-cruiser`: 0 violations, 148 modules, 529 dependencies. `npm run lint:all`: all 6 checks pass.

| CS | Change | Finding Resolved |
|----|--------|------------------|
| CS1 | `external-transport.ts` → `logging/` | `logging↔runtime` pairwise cycle |
| CS2 | `TranslationProgressSink` → `runtime/progress-sink.ts` | `runtime→i18n` type edge |
| CS3 | `translator-adapter.ts` → `api/` | `i18n→api` SDP violation, transitive cycle |
| CS4 | `constants.ts`/`version.ts` → `shared/` | 4 phantom cycles, 3 SDP violations |
| CS5 | `readRawToml`/`deleteConfigFile` → `config/` | Layer violations in config commands |
| CS6 | Zod validation for `JSON.parse` | Zod bypass in evaluation.ts |
| CS7 | Duplicate name check in registry | Registry completeness gap |
| CS8 | Logging in `i18n/cache.ts` | Zero observability in cache |
| CS9 | `try/finally` around `poolMap` spinner | Spinner resource leak |
| CS10 | `ErrorRule` export removed | Dead export |

**SLA breach status:** REMEDIATED. Next audit will confirm score improvement.
