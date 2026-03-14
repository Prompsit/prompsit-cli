---
name: prompsit-score
description: |
  Score parallel corpora with Bicleaner using the Prompsit Translation API.
  Use when the user needs corpus quality scoring, parallel text cleaning,
  or bilingual data filtering.
license: Apache-2.0
---

# Prompsit Score

Score parallel corpora with Bicleaner quality estimation.

## TMX Files

Auto-detects source and target languages from TMX metadata.

```bash
prompsit score corpus.tmx
prompsit score corpus.tmx --out ./scored
```

## Parallel TSV Files

Requires explicit source language.

```bash
prompsit score source.txt -t target.txt -s en
```

## Batch Scoring

```bash
prompsit score @"./corpora/" -t @"./targets/" -s en
```

## Discovery

```bash
prompsit score --languages    # supported language pairs
prompsit score --formats      # supported file formats
```

## Flags

| Flag | Description |
|------|-------------|
| `-s, --source-lang <lang>` | Source language code |
| `-t, --target <path>` | Target file path |
| `--out <dir>` | Output directory |
| `--output-format <fmt>` | Output format |
| `-l, --languages` | List supported language pairs |
| `--formats` | List supported file formats |

## Definition of Done

- [ ] Bicleaner scores returned for all input segments
- [ ] Output files written to specified directory

---
**Version:** 1.0.0
**Last Updated:** 2026-03-13
