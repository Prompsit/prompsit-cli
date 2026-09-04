---
name: prompsit-score
description: Score parallel corpora with Bicleaner through the Prompsit Translation API.
license: Apache-2.0
---

# Prompsit score

Prefix input files and directories with `@`.

```bash
prompsit score @corpus.tmx
prompsit score @source.txt -t @target.txt -s en
prompsit score @./sources -t @./targets -s en --out ./scored
```

TMX metadata can supply languages; TSV and parallel-file workflows require the source language expected by current command help. Query capabilities before execution:

```bash
prompsit score --languages
prompsit score --formats
prompsit score --help
```

Verify that the result is non-empty and preserves the input/output pairing.
