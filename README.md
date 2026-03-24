# Prompsit CLI

[![CI](https://github.com/Prompsit/prompsit-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Prompsit/prompsit-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/prompsit-cli)](https://www.npmjs.com/package/prompsit-cli)
[![license](https://img.shields.io/npm/l/prompsit-cli)](https://www.npmjs.com/package/prompsit-cli)
[![node](https://img.shields.io/node/v/prompsit-cli)](https://nodejs.org/)

One CLI for the entire Prompsit API services. Translate text and documents, evaluate translation quality, score parallel corpora with Bicleaner-AI, and annotate monolingual data with Monotextor — from your terminal or an interactive REPL.

## Quick Start

```bash
npm install -g prompsit-cli

prompsit login -a "EMAIL" -s "SECRET"
prompsit translate "Hello world" -s "en" -t "es"
prompsit translate @"report.docx" -s "en" -t "es"
prompsit                                            # Interactive REPL
```

> [!TIP]
> Run `prompsit` with no arguments to enter the **interactive REPL** with tab completion, command history, and bundled example files in `~/.prompsit/examples/`.

**Update:** `npm install -g prompsit-cli@latest`
**Uninstall:** `npm uninstall -g prompsit-cli`

---

## Features

| Feature | Description | Example |
|---------|-------------|---------|
| **Translate text** | Translate one or more segments with optional quality estimation | `translate "Hello" -s "en" -t "es" --qe` |
| **Translate files** | Translate documents with SSE progress tracking | `translate @"report.pdf" -s "en" -t "es"` |
| **Evaluate** | Measure translation quality (BLEU, chrF, MetricX, COMET) | `eval -s "Hello" -h "Hola" -r "Hola"` |
| **Score** | Score parallel corpora with Bicleaner-AI | `score @"corpus.tmx"` |
| **Annotate** | Add metadata to monolingual data (LID, PII, dedup, etc.) | `annotate @"data.jsonl" -l "en"` |
| **Engines** | List available translation engines by language pair | `engines -s "en" -t "es"` |

Supports XLIFF, CSV, PDF, DOCX, TMX, TSV, TXT, JSONL, and more. Run `prompsit translate --formats` for the full list.

---

## Commands

> [!IMPORTANT]
> **Quoting rule:** all values must be quoted. Commands, subcommands, and flags stay unquoted.
> Run `prompsit <command> --help` for the full flag reference.

### Authentication

```bash
prompsit login -a "EMAIL" -s "SECRET"    # Authenticate
prompsit login                           # Open contact page (no credentials)
prompsit logout                          # Clear stored credentials
prompsit status                          # Show auth state and token expiry
```

### Translation

```bash
# Text mode
prompsit translate "Hello world" -s "en" -t "es"
prompsit translate "Hello" "Good morning" -s "en" -t "es" --qe

# File mode (@ prefix)
prompsit translate @"report.pdf" -s "en" -t "es" --output-format "docx"
prompsit translate @"file1.csv" @"file2.csv" -s "en" -t "es" --out "./translated/"

# Discovery
prompsit translate --languages -s "en"
prompsit translate --formats
```

### Evaluation

```bash
prompsit eval -s "Hello" -h "Hola" -r "Hola"                    # Inline
prompsit eval -s "Hello" -h "Hola" -r "Hola" -m "bleu,metricx"  # Custom metrics
prompsit eval "segments.tsv" -m "bleu,chrf"                      # Batch from TSV
prompsit eval @"report.txt" -s "en" -t "es"                      # File scoring
```

### Data Processing

```bash
prompsit score @"corpus.tmx"                                                    # Bicleaner-AI scoring
prompsit score "corpus.tsv" --output-format "tsv" --out "results/"

prompsit annotate @"data.jsonl" -l "en" --metadata "lid,docscorer"              # Monotextor annotation
prompsit annotate @"data.jsonl" -l "en" --out "results/"
prompsit annotate --metadata                                                    # List available metadata
```

### Configuration

```bash
prompsit config                          # Open interactive TUI settings screen
prompsit config show                     # Show current configuration
prompsit config "api-base-url"           # Get a value
prompsit config "api-base-url" "URL"     # Set a value
prompsit config api-url "test"           # Switch API endpoint preset
prompsit language "es"                   # Set interface language
```

### System

| Command | Description |
|---------|-------------|
| `health` | API health check |
| `usage` | Show plan usage and quotas |
| `help` | Show all commands (also: `?`) |
| `clear` | Clear screen |
| `exit` | Quit REPL (also: `quit`, `q`) |

---

## FAQ

<details>
<summary><b>How do I get API credentials?</b></summary>

Run `prompsit login` without arguments to open the contact page. You'll receive an account email and API secret from Prompsit.

</details>

<details>
<summary><b>REPL or CLI — which should I use?</b></summary>

**REPL** (`prompsit` with no args) — for interactive exploration. Tab completion, persistent command history, bundled examples in `~/.prompsit/examples/`, and a settings TUI (`config`).

**CLI** (`prompsit <command>`) — for scripts, pipelines, and one-off commands. Same commands, same flags.

</details>

<details>
<summary><b>What file formats are supported?</b></summary>

XLIFF, CSV, PDF, DOCX, TMX, TSV, TXT, JSONL, and others. Run `prompsit translate --formats` for the complete list. Use `--output-format` to convert between formats (e.g., PDF to DOCX).

</details>

<details>
<summary><b>How does configuration work?</b></summary>

Three-level precedence: **environment variables** (`PROMPSIT_API__BASE_URL`) > **config file** (`~/.prompsit/config.toml`) > **defaults**. Use `config show` to see active values. See [runbook](docs/project/runbook.md) for details.

</details>

<details>
<summary><b>How do I change the interface language?</b></summary>

```bash
prompsit language "es"     # CLI
> language "es"            # REPL
```

Translations are fetched from the API on first use and cached in `~/.prompsit/translations/`.

</details>

<details>
<summary><b>Command not found after install?</b></summary>

```bash
# Check global npm bin is on PATH
echo "$PATH" | tr ':' '\n' | grep '.npm-global/bin'
command -v prompsit
```

</details>

<details>
<summary><b>Something is broken — where do I start?</b></summary>

1. `prompsit health` — verify API connectivity
2. `prompsit status` — check authentication state
3. `prompsit config show` — review active configuration
4. See the [runbook](docs/project/runbook.md) for common errors and fixes

</details>

---

## Project Structure

```
src/
├── index.ts              # Entry point
├── program.ts            # Commander.js program definition
├── commands/             # CLI command handlers
├── api/                  # HTTP client (got) + Zod models + SSE
├── config/               # Settings (Zod + smol-toml + env vars)
├── repl/                 # Interactive REPL (pi-tui)
├── tui/                  # TUI settings screen
├── output/               # Terminal formatting (chalk + cli-table3)
├── i18n/                 # Internationalization
├── errors/               # Error contracts
├── cli/                  # Global options, exit codes
├── runtime/              # Platform abstractions
└── logging/              # Telemetry transport
```

> [!TIP]
> **For AI agents:** entry point is `src/index.ts` -> `src/program.ts`. Commands in `src/commands/`, REPL in `src/repl/`, config in `src/config/`. TypeScript strict, ESM-only, layered architecture (Presentation -> Application -> Domain -> Infrastructure). Full docs: [architecture.md](docs/project/architecture.md), [CLAUDE.md](CLAUDE.md).

---

## Links

| | |
|---|---|
| **Documentation** | [docs/README.md](docs/README.md) |
| **Architecture** | [docs/project/architecture.md](docs/project/architecture.md) |
| **Runbook** | [docs/project/runbook.md](docs/project/runbook.md) |
| **Contributing** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Issues** | [GitHub Issues](https://github.com/Prompsit/prompsit-cli/issues) |
| **npm** | [prompsit-cli](https://www.npmjs.com/package/prompsit-cli) |

## License

Apache-2.0 — [Prompsit Language Engineering, S.L.](https://www.prompsit.com/)
