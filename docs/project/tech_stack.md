# Technology Stack: Prompsit CLI

**Document Version:** 2.0
**Date:** 2026-02-22

<!-- SCOPE: Technology stack with versions, dependencies, development tools, build system, deployment ONLY. -->
<!-- DO NOT add here: Architecture -> architecture.md, API contracts -> api_spec.md, Operations -> runbook.md -->

---

## Overview

Prompsit CLI is built with Node.js 22+ and TypeScript in strict mode. The stack prioritizes type safety, developer experience, and cross-platform compatibility. ESM-only (`"type": "module"`).

---

## Runtime Technologies

### Language & Runtime

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 22+ | Runtime (ESM, native fetch, --experimental-strip-types) |
| **TypeScript** | 5.9+ | Language (strict mode, ESM-first setup) |
| **npm** | Latest | Package management |
| **tsx** | 4.21+ | Dev-time loader (esbuild-based, transforms TS/ESM) |

---

## Core Dependencies

### CLI Framework

| Package | Version | Purpose |
|---------|---------|---------|
| **@commander-js/extra-typings** | ^14.0.0 | Type-safe CLI commands with inferred `.opts()` types |
| **chalk** | ^5.6.2 | Terminal string styling (colors, bold, dim) |
| **cli-table3** | ^0.6.5 | Unicode table rendering for terminal output |
| **ora** | ^9.3.0 | Spinner for long-running operations |

### HTTP Client

| Package | Version | Purpose |
|---------|---------|---------|
| **got** | ^14.6.6 | HTTP client with built-in retry, hooks, granular timeouts |

### Data Validation

| Package | Version | Purpose |
|---------|---------|---------|
| **zod** | ^4.3.6 | Schema validation + TypeScript type inference (`z.infer`) |

### Configuration

| Package | Version | Purpose |
|---------|---------|---------|
| **smol-toml** | ^1.6.0 | TOML 1.0 parser/stringifier (zero deps, ~3KB) |

### Interactive REPL

| Package | Version | Purpose |
|---------|---------|---------|
| **@mariozechner/pi-tui** | ^0.54.1 | Terminal UI primitives for REPL editor, completion list, and status layout |

### Distribution

| Channel | Purpose |
|---------|---------|
| **npmjs (`prompsit-cli`)** | Global install/update via npm (`npm install -g prompsit-cli`) |

---

## Development Dependencies

### Testing

| Package | Version | Purpose |
|---------|---------|---------|
| **vitest** | ^4.0.18 | Test framework (Vite-powered, ESM-native) |

### Type Checking & Build

| Package | Version | Purpose |
|---------|---------|---------|
| **typescript** | ^5.9.3 | Compiler + type checker (strict mode) |
| **tsx** | ^4.21.0 | Dev-time esbuild loader (TS/ESM transform) |
| **@types/node** | ^25.3.0 | Node.js type definitions |

---

## Build & Packaging

### Build System

| Tool | Purpose |
|------|---------|
| **tsc** | TypeScript compiler -> `dist/` (production build) |
| **tsx** | esbuild-based dev runner (no pre-compilation needed) |
| **package.json** | ESM module, `"type": "module"` |

**Entry Point:**

| Mode | Command | Path |
|------|---------|------|
| Dev | `npm run dev` | `tsx src/index.ts` |
| Production | `prompsit` | `dist/index.js` |
| REPL | No args | `src/index.ts` -> `src/repl/loop.ts` (`runRepl`) |

**Package Structure:**
```
prompsit-cli/
  src/           # TypeScript source
  dist/          # Compiled output (tsc)
  package.json   # ESM module config
  tsconfig.json  # TypeScript strict + nodenext
```

---

## Configuration Management

### Configuration Files

| File | Location | Format | Purpose |
|------|----------|--------|---------|
| `config.toml` | `~/.prompsit/` | TOML | User configuration |
| `credentials.json` | `~/.prompsit/` | JSON | OAuth2 tokens (access, refresh, account) |
| `history` | `~/.prompsit/` | Text | REPL command history |
| `translations/{lang}.json` | `~/.prompsit/` | JSON | Interface translation cache |

### Environment Variables

**Prefix:** `PROMPSIT_`
**Delimiter:** `__` (double underscore for nested keys)

| Variable | Example |
|----------|---------|
| `PROMPSIT_API__BASE_URL` | `https://api.prompsit.com` |
| `PROMPSIT_API__TIMEOUT` | `60` |
| `PROMPSIT_CLI__LANGUAGE` | `es` |
| `PROMPSIT_TELEMETRY__ENABLED` | `true` |

**Precedence:** Environment variables > config.toml > Zod schema defaults

---

## Platform Support

### Operating Systems

| OS | Support | Notes |
|----|---------|-------|
| **Windows** | Full | Windows 10+ (Windows Terminal recommended) |
| **macOS** | Full | macOS 11+ |
| **Linux** | Full | Ubuntu 20.04+, Debian 11+, RHEL 8+ |

### System Dependencies

| Dependency | Purpose | Platforms |
|------------|---------|-----------|
| **Node.js 22+** | Runtime | All platforms |
| **Internet Connection** | API access | Required |

---

## Version Management

### CalVer Versioning

**Format:** `YY.MMDD.HHMM` (from git commit timestamp)

| Component | Source | Example |
|-----------|--------|---------|
| `YY` | Year (2-digit) | `26` |
| `MMDD` | Month + Day | `0215` |
| `HHMM` | Hour + Minute | `1430` |

**Result:** `26.0215.1430` -- version is the build timestamp, no manual bumping.

### Dependency Pinning

**Philosophy:** Caret ranges (`^`) for all dependencies -- allow MINOR/PATCH updates.

---

## Performance Characteristics

### Startup Time

| Scenario | Time | Notes |
|----------|------|-------|
| **CLI command** | < 200ms | Single command execution |
| **REPL startup** | < 300ms | pi-tui initialization + welcome banner |

### Memory Footprint

| Operation | Memory | Notes |
|-----------|--------|-------|
| **Idle CLI** | ~40MB | Base Node.js + dependencies |
| **REPL session** | ~60MB | pi-tui rendering + output bridge |
| **Translation (100 segments)** | ~70MB | Batch processing |

---

## Maintenance

**Last Updated:** 2026-02-22

**Update Triggers:**
- New dependency added or version changed
- Build system modified
- Platform support changes

**Verification:**
- [ ] All dependencies match package.json versions
- [ ] All development tools listed
- [ ] Platform support matrix current
