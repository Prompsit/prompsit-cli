# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Changed
- Node.js requirement is now explicit at 22.19+ to match the TUI dependency floor
- Automated npm publishing via GitHub Actions (CalVer from mirror commit date)
- `/publish` skill: commit+push only, npm publish handled by CI

### Added
- `eval --tags` — reference-free tag quality scoring (POST `/v1/quality/tags`): checks inline tag/placeholder preservation and positioning. Inline (`-s`/`-h`) or 2-column TSV batch; select sub-scores with `-m tag_preservation,tag_position`
- `--verbose` / `-v` CLI flag — enables debug logging to stderr for troubleshooting
- `fix:all` npm script — ESLint autofix + Prettier in one command
- `/changelog` skill for maintaining CHANGELOG.md
- GitHub Release auto-creation from CHANGELOG.md Unreleased section

### Fixed
- `prompsit tm import` now follows the API's asynchronous job lifecycle and reports the imported language pair and segment count after completion
- `npm install -g prompsit-cli` no longer emits npm `allow-scripts` warnings from Prompsit CLI install scripts or the native `koffi` dependency
- `npm install -g prompsit-cli` no longer pulls deprecated `@mariozechner/pi-tui`; the TUI dependency now uses `@earendil-works/pi-tui`
- `prompsit eval ...` now works from the CLI — the command was registered as `evaluate` while all docs/examples used `eval`, so the bare CLI printed root help. The command is now `eval` everywhere (CLI + REPL); the `evaluate` keyword is removed
- Device-token polling no longer retries semantic `400 authorization_pending` responses when a `Retry-After` header is present, removing the observed ~60s post-Google-login delay
- Device-flow login lag after Google sign-in — the CLI now honors the server-advertised polling interval instead of starting below it, which previously tripped the server's `slow_down` and locked polling at 10s. Post-auth detection is now bounded by the server interval (≤2s with the matching API change)
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
