# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

## 26.904.1804 - 2026-09-04

### Changed
- Node.js requirement now follows the package manifest and TUI dependency floor
- REPL history rendering now reuses width-aware formatted event lines instead of rebuilding the entire buffer on every frame
- CLI API/config/logging documentation now follows the implemented routes and terminal abstraction
- Updated compatible development-tool dependencies to resolve audit findings
- Markdown local links are checked by the unified quality gate and CI
- The test portfolio now keeps behavior-focused business and data-integrity checks instead of low-level TUI/framework duplication
- Automated npm publishing via GitHub Actions (CalVer from mirror commit date)
- npm releases now authenticate through GitHub Actions OIDC trusted publishing instead of a long-lived npm token
- Release operations now have one canonical runbook; agent commands delegate to it and the obsolete local publish script is removed
- `/publish` skill: commit+push only, npm publish handled by CI
- Documentation now has one canonical owner per topic and links to code for volatile commands, defaults, versions, and inventories

### Added
- `eval --tags` — reference-free tag quality scoring (POST `/v1/quality/tags`): checks inline tag/placeholder preservation and positioning. Inline (`-s`/`-h`) or 2-column TSV batch; select sub-scores with `-m tag_preservation,tag_position`
- `--verbose` / `-v` CLI flag — enables debug logging to stderr for troubleshooting
- `fix:all` npm script — ESLint autofix + Prettier in one command
- `/changelog` skill for maintaining CHANGELOG.md
- GitHub Release auto-creation from CHANGELOG.md Unreleased section

### Fixed
- Batch output naming remains unique for three or more same-name inputs instead of repeating the `_2` path

### Removed
- Unused 82 MB corpus fixture, obsolete Ink-era REPL plans, dead exports, and redundant low-level UI tests
- Removed point-in-time audits, pipeline reports, article drafts, generic pattern guides, templates, and duplicate documentation indexes
- REPL and E2E diagnostics no longer persist or echo raw `login` and `secret set` input, including validation and debug paths
- OAuth refresh is serialized across CLI processes and no longer overwrites or clears concurrently replaced credentials
- Invalid configuration is reported without silently enabling network requests; writes are validated and transactional
- Remote API URLs now require HTTPS, while loopback HTTP remains available for local development
- Downloads use unique temporary files and replace their destination only after a complete transfer
- Polling now uses the typed jobs resource with cancellation and response validation
- Builds and package preparation now clean stale output before compiling; CI checks all policy inputs without publishing test-only changes
- Updated `smol-toml` to a production-audit-clean release
- `prompsit tm import` now follows the API's asynchronous job lifecycle and reports the imported language pair and segment count after completion
- `npm install -g prompsit-cli` no longer emits npm `allow-scripts` warnings from Prompsit CLI install scripts or the native `koffi` dependency
- `npm install -g prompsit-cli` no longer pulls deprecated `@mariozechner/pi-tui`; the TUI dependency now uses `@earendil-works/pi-tui`
- `prompsit eval ...` now works from the CLI — the command was registered as `evaluate` while all docs/examples used `eval`, so the bare CLI printed root help. The command is now `eval` everywhere (CLI + REPL); the `evaluate` keyword is removed
- Device-token polling no longer retries semantic `authorization_pending` responses through the transport retry policy
- Device-flow login now honors the server-advertised polling interval instead of triggering repeated `slow_down` responses
- ESLint `no-confusing-void-expression` errors in annotate, score, translate commands
- Prettier formatting after ESLint autofix
- npm publish `--provenance` error on private GitHub repo

## 1.0.0 — Initial Public Release

First open-source release of Prompsit CLI.

### Features

- **translate** — Translate text and documents (XLIFF, CSV, PDF, DOCX, etc.) with quality estimation
- **eval** — Evaluate translation quality with automatic metrics (BLEU, chrF, MetricX)
- **score** — Compute translation likelihood scores with Bicleaner-AI
- **annotate** — Annotate monolingual documents with metadata (LID, dedup, PII, adult filter, docscorer)
- **engines** — List available translation engines and language pairs
- **formats** — List supported file formats
- **Interactive REPL** — Tab completion, persistent history, TUI settings screen
- **Multi-language interface** — Self-translating i18n catalog (en, es, and more)
- **OAuth2 authentication** — Secure token storage with automatic refresh
- **SSE document translation** — Real-time progress for long-running file translations
