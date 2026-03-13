# Prompsit CLI

[![npm version](https://img.shields.io/npm/v/prompsit-cli)](https://www.npmjs.com/package/prompsit-cli)
[![license](https://img.shields.io/npm/l/prompsit-cli)](https://www.npmjs.com/package/prompsit-cli)
[![node](https://img.shields.io/node/v/prompsit-cli)](https://nodejs.org/)

CLI for the Prompsit Translation API. Translate text and documents, evaluate quality, score parallel corpora, and annotate monolingual data.

## Requirements

[Node.js](https://nodejs.org/) 22+

```bash
node -v   # Should print v22.x or higher
```

## Install

```bash
npm install -g prompsit-cli
```

**Update:** `npm install -g prompsit-cli@latest --prefer-online`
**Uninstall:** `npm uninstall -g prompsit-cli`

<details>
<summary>Command not found after install?</summary>

```bash
# Check global npm bin is on PATH
echo "$PATH" | tr ':' '\n' | grep '.npm-global/bin'
command -v prompsit
```

</details>

## Usage

Run `prompsit` to enter interactive REPL with tab completion.

```bash
prompsit                                    # Enter interactive REPL
prompsit translate "Hello" -s "en" -t "es"  # Run single command
```

> **Quoting rule:** All values must be quoted. Commands, subcommands, and flags stay unquoted.

## Commands

### Authentication

#### `login` --account "EMAIL" --secret "SECRET"

Authenticate with the Prompsit API.

- `-a, --account "EMAIL"` Account email
- `-s, --secret "SECRET"` API secret

```
$ prompsit login                               # Open contact page
$ prompsit login -a "EMAIL" -s "SECRET"        # Login with credentials
```

#### `logout`

Clear stored credentials (`~/.prompsit/credentials.json`).

#### `status`

Show auth state, plan type, and token expiry.

---

### Configuration

#### `config` [subcommand|key] [value]

Interactive TUI settings screen, or manage config via subcommands.

**Subcommands:**

- `config show` Show current configuration
- `config "key"` Get a config value
- `config "key" "value"` Set a config value
- `config api-url ["preset_or_url"]` Switch API endpoint
- `config reset [--force]` Reset to defaults
- `config path` Show config file path

```
> config show
> config "api-base-url"
> config "api-base-url" "https://my-server.com"
> config api-url "test"
```

#### `language` [code]

Set interface language.

```
> language "es"
$ prompsit language "en"
$ prompsit config language
```

---

### Translation

#### `translate` "text" --source "lang" --target "lang" [--qe]

Translate text. Aliases: `t`

- `-s, --source "lang"` Source language code
- `-t, --target "lang"` Target language code
- `--qe` Enable quality estimation score

```
> "Hello world" -s "en" -t "es"
> "Hello" "Good morning" "Thank you" -s "en" -t "es"
> t "Hello" -s "en" -t "es" --qe
$ prompsit translate "Hello world" -s "en" -t "es"
$ prompsit translate "Hello" "Good morning" "Thank you" -s "en" -t "es"
```

#### `translate` @"file..." --source "lang" --target "lang" [--out "dir"] [--output-format "fmt"]

Translate files (XLIFF, CSV, PDF, DOCX, etc.). Use `@` prefix for file mode. Alias: `t`

- `-s, --source "lang"` Source language code
- `-t, --target "lang"` Target language code
- `--out "dir"` Output directory (default: beside input file)
- `--output-format "fmt"` Output format (e.g. docx)

```
> t @"~/.prompsit/examples/translate/sample.xliff" -s "en" -t "es"
> t @"~/.prompsit/examples/translate/sample.txt" @"~/.prompsit/examples/translate/sample.csv" -s "en" -t "es"
> t @"~/.prompsit/examples/translate/sample.csv" -s "en" -t "es" --out "./translated/"
> t @"report.pdf" -s "en" -t "es" --output-format "docx"
$ prompsit translate @"~/.prompsit/examples/translate/sample.xliff" -s "en" -t "es"
$ prompsit translate @"~/.prompsit/examples/translate/sample.csv" -s "en" -t "es" --out "./translated/"
$ prompsit translate @"report.pdf" -s "en" -t "es" --output-format "docx"
$ prompsit translate @"manual.md" @"notes.md" -s "en" -t "es" --output-format "docx"
```

---

### Engines

#### `engines` [--source "lang"] [--target "lang"]

List available translation engines.

- `-s, --source "lang"` Filter by source language
- `-t, --target "lang"` Filter by target language

```
> engines
> engines -s "en" -t "es"
$ prompsit engines
$ prompsit engines -s "en" -t "es"
```

---

### Quality Evaluation

#### `eval` --source "src" --hypothesis "hyp" --reference "ref" [--metrics "metrics"]

Evaluate translation quality with automatic metrics (inline mode). Alias: `e`

- `-s, --source "src"` Source text
- `-h, --hypothesis "hyp"` Machine translation (hypothesis)
- `-r, --reference "ref"` Reference translation
- `-m, --metrics "metrics"` Comma-separated: bleu,chrf,metricx (default: bleu,chrf)

#### `eval` "file" [--metrics "metrics"]

Batch evaluation from TSV file.

#### `eval` @"file" [options]

File scoring mode. Use `@` prefix.

```
> eval -s "Hello" -h "Hola" -r "Hola"
> eval -s "Hello" -h "Hola" -r "Hola" -m "bleu,chrf,metricx"
> eval "segments.tsv" -m "bleu,chrf"
> eval @"report.txt" -s "en" -t "es"
$ prompsit eval -s "Hello" -h "Hola" -r "Hola"
$ prompsit eval -s "Hello" -h "Hola" -r "Hola" -m "bleu,chrf,metricx"
```

---

### Data Processing

#### `score` "file" [options]

Compute translation likelihood scores with Bicleaner-AI.

```
> score "~/.prompsit/examples/score/sample.tmx"
> score "corpus.tsv" --output-format "tsv" --out "results/"
$ prompsit score "corpus.tmx" --out "results/"
```

#### `annotate` "file" --lang "code" [--metadata "options"] [--out "dir"]

Annotate monolingual documents with metadata using Monotextor.

- `-l, --lang "code"` Language code (e.g. en, es, zh-Hans)
- `--metadata "options"` Metadata to add (comma-separated: lid, dedup, pii, adult_filter, monofixer, docscorer)
- `--out "dir"` Output directory (default: beside input file)

```
> annotate @"data.jsonl" -l "en" --metadata "lid,docscorer"
> annotate @"data.jsonl" -l "en" --out "results/"
> annotate --metadata
$ prompsit annotate @"data.jsonl" -l "en" --metadata "lid,docscorer" --out "results/"
$ prompsit annotate --metadata
```

---

### Reference

#### `formats`

List supported file formats. Alias: `f`

```
> formats
$ prompsit formats
```

---

### System

| Command | Description |
|---------|-------------|
| `health` | API health check |
| `help` | Show all commands (also: `?`) |
| `clear` | Clear screen |
| `exit` | Quit CLI (also: `quit`, `q`) |

---

## Configuration Reference

Config file: `~/.prompsit/config.toml` | Env override: `PROMPSIT_<SECTION>__<KEY>`

| Key | CLI Command | Default | Description |
|-----|-------------|---------|-------------|
| `api.base_url` | `config api-url` | `https://edge.prompsit.com` | API endpoint |
| `api.timeout` | - | `30` | HTTP read timeout (sec) |
| `cli.language` | `language "code"` | `en` | Interface language |
| `cli.log_level` | `config set log-level "val"` | `INFO` | Log level |

## Data Directory: `~/.prompsit/`

| Path | Purpose |
|------|---------|
| `config.toml` | User configuration (TOML) |
| `credentials.json` | OAuth2 tokens |
| `history` | REPL command history |
| `translations/{lang}.json` | Interface translation cache |
| `examples/translate/` | Translation examples (txt, csv, xliff) |
| `examples/evaluate/` | Evaluation examples (tmx) |
| `examples/score/` | Scoring examples (tmx) |
| `examples/annotate/` | Annotation examples (jsonl) |

## Troubleshooting

See [docs/project/runbook.md](docs/project/runbook.md) for setup issues, common errors, and fixes.

## License

MIT
