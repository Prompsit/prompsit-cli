# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Changed
- Automated npm publishing via GitHub Actions (CalVer from mirror commit date)
- `/publish` skill: commit+push only, npm publish handled by CI

### Added
- `--verbose` / `-v` CLI flag — enables debug logging to stderr for troubleshooting
- `fix:all` npm script — ESLint autofix + Prettier in one command
- `/changelog` skill for maintaining CHANGELOG.md
- GitHub Release auto-creation from CHANGELOG.md Unreleased section

### Fixed
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
