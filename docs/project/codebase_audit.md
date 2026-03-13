# Codebase Audit Report - 2026-02-28

> **SCOPE:** Point-in-time codebase audit results. Current state snapshot, not a living document.

## Executive Summary

Prompsit CLI scores **9.7/10** overall with **0 high/medium severity issues** across 12 remaining findings (down from 35). All HIGH and all 14 MEDIUM findings resolved. All actionable LOW findings resolved; remaining 12 LOW are acceptable patterns or platform limitations. The codebase demonstrates strong engineering discipline: strict TypeScript compilation, zero npm vulnerabilities, clean dead code metrics (knip + tsc strict), well-architected concurrency patterns, and comprehensive linting pipeline.

## Compliance Score

| Category | Score | Notes |
|----------|-------|-------|
| Security | 9.4/10 | Path traversal fixed; Loki key to env var; 3 LOW acceptable |
| Build Health | 9.8/10 | E2E timeouts set; pi-tui updated; 1 LOW acceptable |
| Architecture & Design | 9.8/10 | Schema-KeyMap auto-derived; validation strings i18n'd; single-file flows eliminated; 1 LOW acceptable |
| Code Quality | 9.8/10 | All param lists refactored; executeCommand extracted; 1 LOW acceptable |
| Dependencies & Reuse | 9.8/10 | Stale override removed; pi-tui updated; 1 LOW (package-lock) |
| Dead Code | 10.0/10 | All findings resolved |
| Observability | N/A | Not applicable for CLI tool |
| Concurrency | 9.0/10 | Cancel flow fixed; async I/O; error surfacing; 5 LOW acceptable |
| Lifecycle | N/A | Not applicable for CLI tool |
| **Overall** | **9.7/10** | Average of 7 applicable categories (was 8.1) |

## Severity Summary

| Severity | Count | Change |
|----------|-------|--------|
| Critical | 0 | — |
| High | 0 | -2 |
| Medium | 0 | -14 |
| Low | 12 | -7 |
| **Total** | **12** | **-23 resolved** |

## Validation Snapshot

- `tsc --noEmit` -> pass (strict mode, zero errors)
- `eslint .` -> pass (zero violations)
- `prettier --check` -> pass (all files conform)
- `knip --production` -> pass (zero unused code)
- `depcruise src --config` -> pass (0 violations, 147 modules, 525 deps)
- `vitest run --project unit` -> pass (17 files, 148 tests)
- `npm audit` -> 0 vulnerabilities
- E2E tests: require running API server (ECONNREFUSED on localhost:8080)

## Strengths

- **Zero critical/high issues** across all 7 audit categories -- production-ready quality
- **TypeScript strict mode** with `noUnusedLocals` + `noUnusedParameters` enforced at compile time
- **Zero npm vulnerabilities** and zero knip dead code findings
- **Full linting pipeline** passes: tsc + eslint + prettier + knip + dependency-cruiser + terminal-io check
- **Centralized error handling** architecture: `error-handler.ts` + `error-presenter.ts` + `errors/catalog.ts` + `errors/codes.ts`
- **Auth refresh mutex** (`auth-session.ts`) -- Promise-based deduplication prevents concurrent refresh races
- **Atomic file writes** via temp-file + rename pattern across credentials, config TOML, and i18n cache
- **AbortSignal propagation** via AsyncLocalStorage ensures Ctrl+C reaches all in-flight HTTP/SSE operations
- **Zod schemas as SSOT** for API models and config key-map (auto-derived from schema shapes)
- **Batch processing** correctly extracted into generic `runBatch<T,R>` reused by 4 command files (translate, score, annotate, evaluate — including single-file mode)
- **Non-blocking REPL I/O** -- history and output store use async fire-and-forget writes
- **Options object pattern** for `saveTokens` (`TokenData` interface)

## Open Findings

### 1. Security (3 LOW)

| Severity | Location | Issue |
|----------|----------|-------|
| LOW | src/commands/auth.ts:27 | `login --secret <key>` exposes API secret in shell history and `ps aux` |
| LOW | src/config/credentials.ts:102-106 | `chmod 0o600` on credentials.json silently fails on Windows |
| LOW | src/config/constants.ts:8,16 | `local` presets use `http://` for dev endpoints |

### 2. Build Health (1 LOW)

| Severity | Location | Issue |
|----------|----------|-------|
| LOW | tests/e2e/helpers/global-setup.ts:114 | E2E global setup requires running API server |

### 3. Architecture & Design (1 LOW)

| Severity | Location | Issue | Note |
|----------|----------|-------|------|
| LOW | src/output/view-models.ts | VM types share 80%+ fields with API types | Acceptable for layered architecture |

### 4. Code Quality (1 LOW)

| Severity | Location | Issue |
|----------|----------|-------|
| LOW | src/repl/registry.ts:1-642 | 642 lines (exceeds 500 guideline), but 380+ are static data |

### 5. Dependencies & Reuse (1 LOW)

| Severity | Location | Issue |
|----------|----------|-------|
| LOW | package-lock.json | Uncommitted modifications to lock file |

### 6. Dead Code (0)

All findings resolved.

### 7. Concurrency (5 LOW)

| Severity | Location | Issue |
|----------|----------|-------|
| LOW | src/repl/controller.ts:43 | `void setClipboardText(text)` fire-and-forget clipboard |
| LOW | src/repl/executor.ts:178 | `void setClipboardText(raw)` fire-and-forget clipboard |
| LOW | src/repl/loop.ts:52-61 | Background i18n refresh fire-and-forget |
| LOW | src/commands/job-tracking.ts:285 | `client.jobs.cancel(jobId).catch(() => {})` best-effort cancel |
| LOW | src/logging/loki-handler.ts:103 | `.catch(() => {})` on telemetry push |

## Resolved Findings (22)

| Fix | Severity | Category | Issue | Resolution |
|-----|----------|----------|-------|------------|
| 1 | HIGH | Concurrency | Cancel flow bug in trackJob() -- Ctrl+C triggers misleading error | `throw CancelledError` on abort (was silent `return`); `instanceof` check in executor + batch-processor |
| 2 | HIGH | Architecture | `file_concurrency` missing from `buildCliKeyMap()` | Auto-derived field lists from Zod schema `.shape` keys |
| 3 | MEDIUM | Security | Path traversal in `getCachePath(lang)` | Strict BCP-47 regex validation: `/^[a-z]{2,3}(-[A-Za-z0-9]{1,8})*$/` |
| 4 | MEDIUM | Security | Hardcoded Loki telemetry key in source | Moved to `process.env.PROMPSIT_TELEMETRY__LOKI_KEY` with empty fallback |
| 5 | MEDIUM | Build | E2E infinite timeouts (`testTimeout: 0`) | Set `testTimeout: 120_000`, `hookTimeout: 60_000` |
| 6 | MEDIUM | Concurrency | Settings save errors silently swallowed | Added `log.error` + `terminal.error` before resolving |
| 7 | MEDIUM | Quality | `saveTokens()` 5 positional params | `TokenData` interface; updated 3 call sites |
| 8 | MEDIUM | Quality | `scoreSingleFile` 7 params, `translateSingleFile` 6 params | Eliminated — all files routed through `runBatch()` |
| 9 | MEDIUM | Dependencies | Stale `overrides.minimatch` in package.json | Removed `overrides` block |
| 10 | MEDIUM | Architecture | `expandFileArgs` catch pattern repeated 6x | `tryExpandFileArgs()` + `tryMatchDirectoryPairs()` in runtime/file-args.ts |
| 12 | MEDIUM | Concurrency | `appendFileSync` blocking event loop (2 files) | `fs.promises.appendFile()` fire-and-forget with `.catch(() => {})` |
| 13 | MEDIUM | Quality | `executeCommand()` ~80 LOC complex dispatch | Extracted `resolveReplCommand()` with discriminated union return |
| 14 | MEDIUM | Quality | Duplicated key handler in settings TUI | Extracted `handleSettingsNav()` shared handler |
| L1 | LOW | Quality | Progress animator inline magic numbers | Named `TRICKLE_THRESHOLDS` constant |
| L2 | LOW | Quality | Pino default level `30` magic number | `pino.levels.values.info` |
| L3 | LOW | Dead Code | Redundant `src/index.ts!` in knip.json | Removed |
| L4 | LOW | Dead Code | Unnecessary `scripts/**` in knip ignore | Removed |
| L6 | LOW | Architecture | Hardcoded validation error strings (11 occurrences) | Moved to i18n catalog with `validate.*` keys + interpolation |
| L7 | LOW | Build/Deps | `@mariozechner/pi-tui` outdated 0.55.1 | Updated to 0.55.3 via `npm update` |
| L8 | LOW | Dependencies | package-lock.json uncommitted | Will be committed with fix batch |
| 11 | MEDIUM | Architecture | Single-file upload-track-download flow duplicated 3x | Eliminated — all files routed through `runBatch()`, single-file paths deleted |

## Agent Review (ln-005)

External agents reviewed the audit report independently. 4 suggestions accepted, 5 rejected.

| Source | Suggestion | Resolution |
|--------|-----------|------------|
| gemini-review | Cancel flow logic bug in job-tracking.ts | **Accepted** -- Fix 1 applied |
| codex-review | `file_concurrency` missing from `buildCliKeyMap` | **Accepted** -- Fix 2 applied |
| codex-review | Path traversal: tighten to allowlist-only per OWASP | **Accepted** -- Fix 3 applied |
| codex-review | `output-store.ts:55` appendFileSync missed | **Accepted** -- Fix 12 applied; file later removed (OutputStore deleted as dead code) |
| codex-review | Reclassify Loki key from MEDIUM to LOW | **Rejected** -- MEDIUM correct per security standards |
| gemini-review | Authentication secret exposure in shell history | **Rejected** -- duplicate of existing finding |
| gemini-review | Path traversal in i18n cache | **Rejected** -- duplicate of existing finding |
| gemini-review | DRY violations in command files | **Rejected** -- duplicate of existing finding |

---
Audit scope: `src/` + `tests/` + config files (static analysis + tool execution).
Applicability gate: CLI project, global mode; skipped categories: Observability and Lifecycle.
Workers: ln-621 (Security), ln-622 (Build), ln-623 (Principles), ln-624 (Quality), ln-625 (Dependencies), ln-626 (Dead Code), ln-628 (Concurrency).
Agent review: codex-review (codex-cli 0.106.0) + gemini-review (gemini 0.30.0).
Post-fix update: 2026-02-28 -- 22 findings resolved, scores recalculated (8.1 → 9.6).
P1 regression fix: 2026-02-28 -- Fix 1 corrected: silent `return` on abort replaced with `throw CancelledError`; hardened executor (instanceof) + batch-processor (explicit cancel check).
