---
name: prompsit-translate
description: |
  Translate text and documents using the Prompsit Translation API.
  Use when the user needs machine translation, document translation,
  batch file translation, or quality estimation on translations.
license: Apache-2.0
---

# Prompsit Translate

Translate text or documents via the Prompsit API. Prefix `@` for file/directory mode.

## Text Translation

```bash
prompsit translate "Hello world" -s en -t es
prompsit translate "Hello" "Goodbye" -s en -t de    # multiple texts
prompsit translate "Hello" -s en -t es --qe          # with quality estimation
```

## Document Translation

Async job with SSE progress tracking.

```bash
prompsit translate @"file.docx" -s en -t fr --out ./output
prompsit translate @"./docs/" -s en -t pt            # batch directory
prompsit translate @"file.po" -s en -t pt --output-format arb  # format conversion
```

## Discovery

```bash
prompsit translate --formats      # supported file formats
prompsit translate --languages    # available language pairs
```

## Flags

| Flag | Description |
|------|-------------|
| `-s, --source <lang>` | Source language code |
| `-t, --target <lang>` | Target language code |
| `--qe` | Include quality estimation scores |
| `--out <dir>` | Output directory for documents |
| `--output-format <fmt>` | Convert output format |
| `-l, --languages` | List available language pairs |
| `--formats` | List supported file formats |

## Workflow Example

```bash
prompsit login                                              # interactive auth
prompsit translate @"./input/" -s en -t es --out ./output
```

## Definition of Done

- [ ] Translation output matches expected language pair
- [ ] Output files written to specified directory (document mode)

---
**Version:** 1.0.0
**Last Updated:** 2026-03-13
