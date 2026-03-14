---
name: prompsit-annotate
description: |
  Annotate monolingual data with Monotextor metadata using the Prompsit
  Translation API. Use when the user needs language identification, PII detection,
  deduplication, or text annotation.
license: Apache-2.0
---

# Prompsit Annotate

Annotate monolingual data with Monotextor metadata.

## Basic Usage

```bash
prompsit annotate corpus.jsonl -l en --metadata "lid,docscorer"
prompsit annotate corpus.jsonl -l es --metadata "lid,pii,dedup"
```

## Batch with Filters

```bash
prompsit annotate @"./data/" -l fr --metadata "lid" --min-len 100
prompsit annotate @"./data/" -l en --metadata "lid,pii" --min-avg-words 5
```

## Discovery

```bash
prompsit annotate --metadata    # available metadata types
prompsit annotate --formats     # supported file formats
```

## Flags

| Flag | Description |
|------|-------------|
| `-l, --lang <code>` | Language code |
| `--metadata [options]` | Metadata types to compute (comma-separated) |
| `--min-len <n>` | Minimum text length filter |
| `--min-avg-words <n>` | Minimum average words filter |
| `--lid-model <model>` | Language identification model |
| `--out <dir>` | Output directory |
| `--output-format <fmt>` | Output format |
| `--formats` | List supported file formats |

## Definition of Done

- [ ] Metadata annotations computed for all requested types
- [ ] Output files written to specified directory

---
**Version:** 1.0.0
**Last Updated:** 2026-03-13
