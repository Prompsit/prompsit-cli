# Requirements Specification: Prompsit CLI

**Document Version:** 2.0
**Date:** 2026-02-22
**Status:** Active
**Standard Compliance:** ISO/IEC/IEEE 29148:2018

<!-- SCOPE: Functional requirements (FR-XXX-NNN) with MoSCoW prioritization, acceptance criteria, constraints, assumptions, traceability ONLY. -->
<!-- DO NOT add here: NFR (removed completely per project policy), Tech stack -> tech_stack.md, API -> api_spec.md, Architecture -> architecture.md -->

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional requirements for Prompsit CLI, a command-line interface for the Prompsit Translation API.

### 1.2 Scope
**IN SCOPE:**
- Text translation via Prompsit API
- File translation (batch processing)
- Translation quality evaluation
- Translation engine discovery and selection
- Authentication and credential management
- Interactive REPL mode
- Configuration management

**OUT OF SCOPE:**
- Translation API server implementation
- Translation model training
- Custom translation engine development
- Web-based user interface

### 1.3 Intended Audience
- CLI Users (developers, translators, QA engineers)
- Development Team
- API Integration Partners
- DevOps/Infrastructure Team

### 1.4 References
- Architecture Document: [architecture.md](architecture.md)
- API Specification: [api_spec.md](api_spec.md)
- Technology Stack: [tech_stack.md](tech_stack.md)

---

## 2. Overall Description

### 2.1 Product Perspective
Prompsit CLI is a standalone command-line application that interfaces with the Prompsit Translation API (REST). It provides:
- API client wrapper with authentication (OAuth2 tokens in credentials.json)
- Command-line interface using Commander.js framework
- Terminal output with chalk styling and cli-table3 tables
- Configuration management via TOML files and environment variables
- Secure credential storage in `~/.prompsit/credentials.json`

### 2.2 User Classes and Characteristics
1. **Developers** - Tech-proficient, integrate translation into CI/CD pipelines, prefer CLI/scripting
2. **Translators/QA** - Moderate technical skills, batch file translation, quality evaluation
3. **API Integrators** - Advanced users, test API endpoints, explore engine capabilities
4. **System Administrators** - Configure and deploy CLI in automated workflows

### 2.3 Operating Environment
**Client:**
- OS: Windows, macOS, Linux
- Node.js: 22+
- Terminal: Modern terminal emulators with color support

**Server (External Dependency):**
- Prompsit Translation API (https://api.prompsit.com)
- Requires: Active API account with Account email and API Secret

---

## 3. Functional Requirements

### 3.1 Authentication (FR-AUTH)

**FR-AUTH-001** (MUST): Users shall authenticate using Account email and API Secret
- **AC1**: CLI accepts credentials via flags (`-a`, `-s`) or interactive input
- **AC2**: Credentials stored in `~/.prompsit/credentials.json`
- **AC3**: OAuth2 token obtained from `/v1/auth/token` endpoint

**FR-AUTH-002** (MUST): Users shall check authentication status
- **AC1**: `status` command displays authentication state
- **AC2**: Shows API URL, account status, token validity

**FR-AUTH-003** (MUST): Users shall logout and clear stored credentials
- **AC1**: `logout` removes credentials from storage
- **AC2**: Confirmation message displayed

### 3.2 Translation (FR-TRANS)

**FR-TRANS-001** (MUST): Users shall translate single or multiple text strings
- **AC1**: `translate "Hello" -s en -t es` translates text
- **AC2**: Supports multiple texts in single command
- **AC3**: Output displayed as table with source and translation

**FR-TRANS-002** (MUST): Users shall translate files
- **AC1**: `translate @input.txt -s en -t es --out ./output/`
- **AC2**: Batch processing with configurable batch size (default: 50)
- **AC3**: Progress shown for files > threshold (default: 10 lines)

**FR-TRANS-003** (SHOULD): Users shall request quality estimation (QE) scores
- **AC1**: `--qe` flag includes quality scores in output

### 3.3 Translation Engines (FR-ENG)

**FR-ENG-001** (MUST): Users shall list available translation engines
- **AC1**: `engines` displays all engines
- **AC2**: Table shows: ID, Name, Source Lang, Target Lang, Type
- **AC3**: Supports filtering by source/target language pair

### 3.4 Quality Evaluation (FR-EVAL)

**FR-EVAL-001** (MUST): Users shall evaluate translation quality with metrics
- **AC1**: `eval -s "source" -h "hypothesis" -r "reference"`
- **AC2**: Supports metrics: BLEU, CHRF, MetricX (default: all)

**FR-EVAL-002** (SHOULD): Users shall batch evaluate from file
- **AC1**: `eval "segments.tsv" -m "bleu,chrf"`
- **AC2**: Input: TSV with source, hypothesis, reference columns

### 3.5 Configuration Management (FR-CONF)

**FR-CONF-001** (MUST): Users shall configure API URL
- **AC1**: `config api-url https://api.prompsit.com`
- **AC2**: Stored in `~/.prompsit/config.toml`
- **AC3**: Can be overridden via `PROMPSIT_API__BASE_URL` env var

**FR-CONF-002** (SHOULD): Users shall set default source/target languages
- **AC1**: `config source-lang en` sets default

**FR-CONF-003** (SHOULD): Users shall view configuration file path
- **AC1**: `config path` shows config file location

**FR-CONF-004** (MUST): Configuration precedence: Env vars > Config file > Defaults
- **AC1**: Environment variables (PROMPSIT_*) override file settings
- **AC2**: File settings override Zod schema defaults
- **AC3**: Nested settings use `__` delimiter

### 3.6 Interactive Mode (FR-REPL)

**FR-REPL-001** (SHOULD): Users shall enter interactive REPL mode
- **AC1**: Running CLI without arguments starts REPL
- **AC2**: REPL provides autocomplete and suggestion list in terminal editor
- **AC3**: Uses `@mariozechner/pi-tui` for persistent TUI layout

**FR-REPL-002** (COULD): REPL shall provide command history
- **AC1**: History persists across sessions in `~/.prompsit/history`

### 3.7 Health Check (FR-HEALTH)

**FR-HEALTH-001** (SHOULD): Users shall check API health status
- **AC1**: `health` calls `/health` endpoint
- **AC2**: Displays API availability and response time
- **AC3**: Exit code 0 if healthy, non-zero if unhealthy

---

## 4. Acceptance Criteria (High-Level)

1. All MUST functional requirements implemented and passing automated tests
2. All SHOULD functional requirements reviewed and prioritized for v1.0
3. All commands documented with `--help`
4. Test suite covers critical user journeys (unit suite via Vitest)
5. Configuration management tested across all precedence levels

---

## 5. Constraints

### 5.1 Technical Constraints
- **Language**: TypeScript strict mode (Node.js 22+)
- **CLI Framework**: Commander.js with `@commander-js/extra-typings`
- **HTTP Client**: got (built-in retry, hooks, granular timeouts)
- **Configuration**: Zod + smol-toml (type-safe, env var integration)
- **Security**: credentials.json (no plaintext secrets in config)
- **Terminal Output**: chalk + cli-table3
- **REPL**: @mariozechner/pi-tui

### 5.2 Regulatory Constraints
- **Data Privacy**: No translation data logged or stored locally (GDPR)
- **API Credentials**: Must use secure storage, never commit secrets
- **License**: MIT License

---

## 6. Assumptions and Dependencies

### 6.1 Assumptions
1. Users have stable internet connection for API access
2. Prompsit Translation API maintains 99%+ uptime
3. Users have Node.js 22+ installed
4. Terminal supports ANSI colors and UTF-8 encoding

### 6.2 Dependencies
- **External API**: Prompsit Translation API (https://api.prompsit.com)
- **npm Packages**: See [tech_stack.md](tech_stack.md) for version pinning

---

## 7. Traceability

| FR ID | Epic | Story | Test Coverage |
|-------|------|-------|---------------|
| FR-AUTH-001 | Authentication | User Login | `tests/unit/credentials.test.ts` |
| FR-AUTH-002 | Authentication | Check Status | `tests/unit/auth-session.test.ts` |
| FR-TRANS-001 | Translation | Translate Text | `tests/unit/translation-resource.test.ts` |
| FR-CONF-001 | Configuration | Set API URL | `tests/unit/settings.test.ts` |
| FR-REPL-001 | REPL | Interactive Mode | `tests/unit/executor.test.ts`, `tests/unit/completer.test.ts` |

---

## Maintenance

**Last Updated:** 2026-02-22

**Update Triggers:**
- New functional requirements added
- Acceptance criteria modified
- MoSCoW priorities changed
- Traceability links updated

**Verification:**
- [ ] All FR IDs are unique and sequential
- [ ] All MUST requirements have test coverage
- [ ] MoSCoW prioritization is clear
- [ ] Traceability matrix is complete
