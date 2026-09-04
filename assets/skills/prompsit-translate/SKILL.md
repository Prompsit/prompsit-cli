---
name: prompsit-translate
description: Translate text or documents with the Prompsit Translation API.
license: Apache-2.0
---

# Prompsit translate

Use plain positional values for text and prefix files or directories with `@`.

```bash
prompsit translate "Hello world" -s en -t es
prompsit translate "Hello" "Goodbye" -s en -t de --qe
prompsit translate @file.docx -s en -t fr --out ./output
prompsit translate @./documents -s en -t pt
```

Query capabilities instead of assuming formats or languages:

```bash
prompsit translate --languages
prompsit translate --formats
prompsit translate --help
```

A successful document workflow must create a non-empty output file in the resolved destination. A successful text workflow must return translations for every requested input.
