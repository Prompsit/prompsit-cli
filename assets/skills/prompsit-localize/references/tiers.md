# Tier strategies

Detailed per-tier strategy for `prompsit-localize`. The main `SKILL.md` summarises tiers
in a table; this file is the source of truth for **how** to translate each tier.

## Witness — transcreate

**Use for:** marketing copy that must move the reader — hero titles, eyebrows, OG/SEO
meta, page titles, FAQ questions, footer taglines, marketing button labels.

**Strategy:**

1. Generate **2–3 variants** per string in the target locale.
2. Critique each against the locale style guide (`Sensitivity`, `Avoid`, `Examples`).
3. Pick the most natural; record the others under `variants` with brief notes.
4. Annotate the chosen variant with reasoning (one sentence: why this beats the others).

**Constraints:**

- Do not preserve source-language sentence structure.
- Do not translate word-by-word.
- The goal is the **emotional and persuasive effect**, not lexical fidelity.

**The editor test (acceptance criterion):**

> Would an editor of a serious publication in the target language publish this without
> any edits?

If the answer is "no", regenerate. The editor test is also enforced by the back-translation
check in Phase 3 of the workflow — semantic drift forces regeneration.

## Body — editor mode

**Use for:** prose paragraphs — lead, boundary, descriptions, FAQ answers, blog body,
why-cards, explanatory text.

**Strategy:**

1. Read the source.
2. Set it aside.
3. Write what a native editor would write from scratch given the same brief.

**Specific guidance:**

- **Conjunctions.** If the source joins two concepts with "and", in the target language
  consider a colon, dash, or separate sentence. Do not default to "и" / "y" / "i".
- **Verbal vs. nominal constructions.** If the source uses a verbal construction
  ("transforming the way we work"), consider a noun construction if that is more natural
  in the target language. In Russian, for example, "трансформация подхода к работе"
  reads better than "трансформируя то, как мы работаем". And vice versa where the target
  prefers verbs.
- **Word order.** Do not preserve source order. Use the natural order of the target
  language.
- **Length.** Target length may differ from source. Do not pad to match the source length.
- **Calque cognates.** Avoid "translator's false friends" — e.g. "actually" → "актуально"
  is wrong; the correct rendering is "на самом деле".

## UI — literal plus glossary

**Use for:** action labels, filters, statuses, ARIA strings, error messages, form labels.

**Strategy:**

- Glossary lookup. Match each UI string against `glossary.json` and apply the locked
  translation.
- If a term is missing from `glossary.json`, **fail loud** with
  `missing glossary entry: <term>` rather than guessing.

**Rationale:**

- UI strings need consistency across screens. Creative variation is a bug — a button
  labelled "Save" must be translated identically wherever it appears.
- Failing loud on missing entries forces the human reviewer to extend the glossary
  deliberately, rather than letting one-off translations leak in and create drift.

## Tier classification cheat sheet

Use this when overrides and heuristics both fail and a human is asked to label a string:

| Question | If yes → tier |
| -------- | ------------- |
| Does the string need to make the reader feel something? | witness |
| Is the string a paragraph that explains, narrates, or argues? | body |
| Is the string a label, status, action, or error message attached to UI chrome? | ui |
| When in doubt | body (safer than guessing witness or ui) |
