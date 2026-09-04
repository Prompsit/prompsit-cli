# Prompsit CLI

Command-line and interactive access to the Prompsit Translation API.

## Install

Use a Node.js version allowed by [`package.json`](package.json).

```bash
npm install -g prompsit-cli
prompsit login
prompsit health
```

Use `npx prompsit-cli --help` for an occasional run. The authoritative command and option reference is built into the executable:

```bash
prompsit --help
prompsit <command> --help
```

## Common workflows

```bash
# Translate text or documents
prompsit translate "Hello world" -s en -t es
prompsit translate @report.docx -s en -t de --out ./translated

# Evaluate translations
prompsit eval -s "Hello" -h "Hola" -r "Hola"
prompsit eval @sample.tmx -m bleu,chrf

# Score and annotate corpora
prompsit score @corpus.tmx
prompsit annotate @data.jsonl -l en --metadata lid,docscorer

# Translation memory
prompsit tm show
prompsit tm import memory.tmx
prompsit tm search "Hello world" -t es
```

Run `prompsit` without arguments for the interactive REPL. Prefix file inputs with `@`; plain positional values are text unless a command's help states otherwise.

Discovery commands query the API so their output stays current:

```bash
prompsit translate --languages
prompsit translate --formats
prompsit eval --formats
prompsit score --languages
prompsit annotate --metadata
```

## Authentication and configuration

`prompsit login` uses browser-based device authorization. For an issued API secret, use:

```bash
prompsit login -a "EMAIL" -s "SECRET"
```

Credentials are stored in `~/.prompsit/credentials.json`. Configuration, REPL history, translations, examples, and debug logs live under `~/.prompsit/` by default. Sensitive REPL commands such as `login` and `secret set` are not retained in command history.

```bash
prompsit config show
prompsit config path
prompsit config api-url test
prompsit config language es
prompsit config reset
```

Configuration precedence is environment variables, then `config.toml`, then schema defaults. Environment keys use the `PROMPSIT_` prefix and `__` between sections, for example `PROMPSIT_API__BASE_URL`.

## Documentation

- [Operations and releases](docs/project/runbook.md)
- [Architecture](docs/project/architecture.md)
- [CLI-consumed API contract](docs/project/api_spec.md)
- [Observability](docs/project/observability-operations.md)
- [Documentation map](docs/README.md)
- [Contributing](CONTRIBUTING.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
