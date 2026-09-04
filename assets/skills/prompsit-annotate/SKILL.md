---
name: prompsit-annotate
description: Annotate monolingual data with Monotextor metadata through the Prompsit Translation API.
license: Apache-2.0
---

# Prompsit annotate

Prefix files or directories with `@`.

```bash
prompsit annotate @corpus.jsonl -l en
prompsit annotate @corpus.jsonl -l en --metadata lid,docscorer
prompsit annotate @./data -l es --out ./annotated
```

Do not assume metadata types or formats. Query the live capability sources:

```bash
prompsit annotate --metadata
prompsit annotate --formats
prompsit annotate --help
```

Verify that the result is non-empty and contains the requested annotations for the submitted records.
