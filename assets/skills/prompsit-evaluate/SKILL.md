---
name: prompsit-evaluate
description: |
  Evaluate translation quality with metrics (BLEU, chrF, MetricX) using the
  Prompsit Translation API. Use when the user needs quality evaluation, QE scores,
  or translation metric comparisons.
license: Apache-2.0
---

# Prompsit Evaluate

Evaluate translation quality. Alias: `eval`.

## Inline Evaluation

```bash
prompsit evaluate -s "Hello" -h "Hola" -r "Hola" -m "bleu,chrf"
prompsit evaluate -s "Hello" -h "Hola" -r "Hola" -m "bleu,chrf,metricx"
```

## File Evaluation

TSV format: `source\thypothesis\treference` (tab-separated).

```bash
prompsit evaluate @"scores.tsv" -m "bleu,chrf,metricx"
```

## Document Evaluation

```bash
prompsit evaluate @"file.xlsx" -m "bleu" --out ./scored
```

## Discovery

```bash
prompsit evaluate --formats    # supported file formats
```

## Flags

| Flag | Description |
|------|-------------|
| `-s, --source <text>` | Source text |
| `-h, --hypothesis <text>` | Translation hypothesis |
| `-r, --reference <text>` | Reference translation |
| `-m, --metrics <list>` | Comma-separated metric names |
| `--out <dir>` | Output directory |
| `--output-format <fmt>` | Output format |
| `--formats` | List supported file formats |

## Definition of Done

- [ ] Metric scores returned for all requested metrics
- [ ] Output files written to specified directory (file/document mode)

---
**Version:** 1.0.0
**Last Updated:** 2026-03-13
