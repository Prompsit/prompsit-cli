# Reference Documentation

**Version:** 4.0.0
**Last Updated:** 2026-02-15

<!-- SCOPE: Reference documentation hub (ADRs, Guides, Manuals) with links to subdirectories -->
<!-- DO NOT add here: ADR/Guide/Manual content -> specific files, Project details -> project/README.md -->

---

## Overview

This directory contains reusable knowledge base and architecture decisions:

- **Architecture Decision Records (ADRs)** - Key technical decisions
- **Project Guides** - Reusable patterns and best practices
- **Package Manuals** - API reference for external libraries

---

## Architecture Decision Records (ADRs)

- [ADR-001: CLI Framework (Commander.js)](adrs/adr-001-cli-framework.md) | Accepted | 2026-02-15
- [ADR-002: HTTP Client (got)](adrs/adr-002-http-client.md) | Accepted | 2026-02-15
- [ADR-003: Configuration (Zod + smol-toml)](adrs/adr-003-configuration.md) | Accepted | 2026-02-15
- [ADR-004: REPL Input Handling (pi-tui)](adrs/adr-004-repl-input-handling.md) | Accepted | 2026-02-24

---

## Project Guides

### TypeScript/Node.js Patterns (`docs/guides/`)

- [01-Input Validation (Zod Schemas)](../../docs/guides/01-input-validation-zod-schemas.md) | 2026-02-13
- [02-TOML Config Management (smol-toml)](../../docs/guides/02-toml-config-management-smol-toml.md) | 2026-02-13
- [03-Error Handling (RFC 9457)](../../docs/guides/03-error-handling-rfc9457.md) | 2026-02-13
- [04-HTTP Retry & Rate Limiting (got)](../../docs/guides/04-http-retry-rate-limiting.md) | 2026-02-13
- [05-OAuth2 ROPC CLI Authentication](../../docs/guides/05-oauth2-ropc-cli-authentication.md) | 2026-02-13
- [06-CLI Patterns & Signal Handling (Commander.js)](../../docs/guides/06-cli-patterns-signal-handling.md) | 2026-02-13
- [07-SSE Streaming Patterns](../../docs/guides/07-sse-streaming-patterns.md) | 2026-02-15

### Universal Patterns (`docs/reference/guides/`)

- [Testing Strategy](guides/testing-strategy.md) | 2026-02-10

---

## Package Manuals

(No manuals yet -- all packages used in standard way)

---

## Maintenance

**Last Updated:** 2026-02-15

**Update Triggers:**
- New ADRs added to adrs/ directory
- New guides added to guides/ directory
- New manuals added to manuals/ directory

**Verification:**
- [x] All ADR links in registry are valid
- [x] All guide links in registry are valid
- [x] All manual links in registry are valid
