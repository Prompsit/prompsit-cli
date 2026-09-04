---
name: prompsit-evaluate
description: Evaluate translation quality or tag preservation with the Prompsit Translation API.
license: Apache-2.0
---

# Prompsit evaluate

The command name is `eval`.

```bash
prompsit eval -s "Hello" -h "Hola" -r "Hola"
prompsit eval -s "Hello" -h "Hola" -r "Hola" -m bleu,chrf
prompsit eval -s "Hello <b>world</b>" -h "Hola <b>mundo</b>" --tags
prompsit eval @sample.tmx --out ./scored
```

Plain input files are TSV batch input; `@file` submits a document evaluation job. Query `prompsit eval --formats` and `prompsit eval --help` rather than assuming available formats or metrics.

Verify that requested metrics return numeric values and document mode creates a non-empty result.
