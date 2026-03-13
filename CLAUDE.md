# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **SCOPE:** Entry point with project overview and navigation ONLY. Contains project summary, critical rules, documentation links, and project highlights. DO NOT add detailed documentation here - use docs/ directory.

## ⚠️ Critical Rules for AI Agents

**Read this table BEFORE starting any work.**

| Rule | When to Apply | Details |
|------|---------------|---------|
| **Use Skills Proactively** | During workflow operations | Actively use available skills (built into Claude Code) for documentation, planning, task management, and execution |
| **Check Current Date** | Start of session | Always check and rely on system date from `<env>Today's date: ...</env>` at session start |
| **Read Runbook for Commands** | On any command failure | When ANY command fails (npm, tsx, vitest, tsc, etc.), ALWAYS read [docs/project/runbook.md](docs/project/runbook.md) for correct syntax |
| **English Only (Project)** | All project content | Code, docs, tasks, commits, variables - everything in English. Chat communication must be in Russian (per user's global instructions) |
| **MCP Hashline-Edit Preferred** | File editing | When `hashline-edit` MCP is available, prefer `mcp__hashline-edit__*` methods over standard Read/Edit for verified edits |
| **TypeScript Strict Mode** | All code | Strict mode enforced via tsconfig.json. `tsc --noEmit` must pass with zero errors |
| **REPL Architecture** | REPL development | `@mariozechner/pi-tui` for TUI. See [ADR-004](docs/reference/adrs/adr-004-repl-input-handling.md) |

## Navigation

**DAG Structure:** CLAUDE.md → [docs/README.md](docs/README.md) → topic docs. Read SCOPE tag first in each doc.

## Project Overview

Prompsit CLI is a command-line interface for the Prompsit Translation API. Translate text and documents, evaluate quality, score parallel corpora, and annotate monolingual data.

**Architecture:** Layered (Presentation → Application → Domain → Infrastructure). Entry point: [src/index.ts](src/index.ts) → Commander.js commands or REPL ([repl/](src/repl/)).

## Quick Start

```bash
git clone https://github.com/Prompsit/prompsit-cli.git
cd prompsit-cli
npm install
npm run dev                     # Interactive REPL mode
```

**For detailed commands, environment setup, and troubleshooting:** See [docs/project/runbook.md](docs/project/runbook.md)

## Documentation

All project documentation accessible through **[docs/README.md](docs/README.md)** - central navigation hub.

**Quick links:**
- **Requirements:** [docs/project/requirements.md](docs/project/requirements.md) - Formal requirements (FR-XXX), MoSCoW prioritization
- **Architecture:** [docs/project/architecture.md](docs/project/architecture.md) - System architecture, layered design, quality attributes
- **ADRs:** [docs/reference/adrs/](docs/reference/adrs/) - Architecture Decision Records
- **Tech Stack:** [docs/project/tech_stack.md](docs/project/tech_stack.md) - Technology choices, versions, dependencies
- **Runbook:** [docs/project/runbook.md](docs/project/runbook.md) - Environment setup, commands, troubleshooting

**For complete navigation:** See [docs/README.md](docs/README.md)

## Development Principles

**9 core principles:** Standards First • YAGNI • KISS • DRY • Consumer-First Design • No Legacy Code • Documentation-as-Code • Security by Design • Auto-Generated Migrations Only

**For detailed principles and decision framework:** See [docs/principles.md](docs/principles.md)

## Project Highlights

**Unique to this project** (not generic Node.js/TypeScript patterns):

- **pi-tui REPL with persistent TUI:** Interactive mode uses `@mariozechner/pi-tui` for terminal editor, completion list, and persistent layout. See [ADR-004](docs/reference/adrs/adr-004-repl-input-handling.md)
- **Triple config precedence:** Environment variables (`PROMPSIT_*`) > `config.toml` > Zod defaults. Nested keys use `__` delimiter (e.g., `PROMPSIT_API__BASE_URL`). See [tech_stack.md](docs/project/tech_stack.md#configuration-management)
- **OAuth2 credential storage:** Tokens stored in `~/.prompsit/credentials.json` (not system keyring). No plaintext secrets in config files
- **CalVer versioning from git:** Version format `YY.MMDD.HHMM` auto-generated from git commit timestamp via `release` script
- **Commander.js with extra-typings:** Type-safe CLI with inferred `.opts()` types. See [ADR-001](docs/reference/adrs/adr-001-cli-framework.md)
- **got HTTP client:** Built-in retry + granular timeouts (connect/read/write/pool). See [ADR-002](docs/reference/adrs/adr-002-http-client.md)
- **SSE with reconnection:** Document translation jobs use Server-Sent Events with `Last-Event-ID` replay and exponential backoff
- **Self-translating i18n catalog:** Interface translations fetched from API on first use, cached in `~/.prompsit/translations/{lang}.json`

**See [docs/project/architecture.md](docs/project/architecture.md) and [docs/reference/adrs/](docs/reference/adrs/) for detailed architecture and design decisions**

## Folder Structure

**Hybrid Layered Architecture** with clear separation:

```
src/
├── index.ts              # Commander.js entry point
├── commands/             # CLI command groups
├── api/                  # got HTTP client + Zod models + SSE
├── config/               # Settings (Zod + smol-toml + env parser)
├── repl/                 # pi-tui REPL (loop, controller, executor, registry)
├── tui/                  # TUI settings screen
├── output/               # Terminal formatting (chalk + cli-table3)
├── i18n/                 # Internationalization
├── errors/               # Error catalog
├── cli/                  # Global options, exit codes
├── runtime/              # Platform abstractions (clipboard, progress, request context)
└── logging/              # Loki telemetry
```

**For detailed architecture:** See [docs/project/architecture.md](docs/project/architecture.md)

## Technology Stack

**Core:** Node.js 22+ • TypeScript 5.9+ • Commander.js + extra-typings • got • Zod • @mariozechner/pi-tui • chalk + cli-table3

**For complete stack, versions, and dependencies:** See [docs/project/tech_stack.md](docs/project/tech_stack.md)

## Code Conventions

**Core:**
- TypeScript strict mode (`strict: true` in tsconfig.json)
- ESM-only (`"type": "module"` in package.json)
- TUI via `@mariozechner/pi-tui` (replaced Ink)

**For complete technology stack and build system:** See [docs/project/tech_stack.md](docs/project/tech_stack.md)

**For coding style and testing:** See [AGENTS.md](AGENTS.md)

## Documentation Maintenance Rules

1. **SCOPE Tags**: All documentation files must include SCOPE tag in first 10 lines
2. **Maintenance Sections**: All docs require "## Maintenance" section
3. **Navigation**: CLAUDE.md is entry point, all detailed docs in docs/
4. **Updates**: Update "Last Updated" date when modifying any documentation

## Maintenance

**Update Triggers:**
- When changing project navigation (new/renamed docs)
- When updating critical rules for agents
- When modifying documentation structure

**Verification:**
- [ ] All links resolve to existing files
- [ ] SCOPE tag clearly defines document boundaries
- [ ] Critical rules align with current requirements
- [ ] No duplicated content across documents

**Last Updated:** 2026-02-26
