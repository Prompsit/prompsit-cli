---
name: prompsit-localize
description: |
  Localize content into target locales with editorial quality. Classifies strings into
  three tiers (witness / body / UI), applies a tier-appropriate strategy, enforces a
  project glossary, and gates outputs with back-translation and explicit review flags.
  Use when raw machine translation is not enough: marketing copy, hero pages, FAQ,
  OG/SEO metadata, or any content where tone, register, and cultural fit matter.
license: Apache-2.0
---

# Prompsit Localize

A coordinator skill for high-quality localization. Wraps machine translation (or replaces
it entirely) with an editorial pipeline that fixes the problem most teams hit: MT preserves
meaning but loses the voice. This skill restores the voice per-locale.

If the user only needs literal translation of a document or batch of files, use
`prompsit-translate` directly — it is faster and sufficient.

## Scope

This skill localizes **the user's project content** — strings end users read on a website,
in an app, in marketing copy, in OG/SEO metadata, in FAQ, or in product docs.

It does **not** modify the Prompsit CLI's own interface translations, which live at
`~/.prompsit/translations/{lang}.json` and are managed by the CLI's built-in self-translating
catalog. Different problems, different lifecycles — do not conflate the two.

## When to Use

- Translating website copy, UI labels, marketing pages, blog posts, or product docs.
- The output must read like native-written copy, not "translated from English".
- Multiple target locales need consistent terminology across them.
- The user wants explicit "needs review" flags, not silent draft delivery.

## Quick Start

This skill has no dedicated CLI command — it is an agent workflow. The user invokes it by
asking the AI assistant to localize content and pointing at the project's `localization/`
configs. Typical first session:

```bash
# 1. One-time project setup. Copy the templates from this skill's references/ folder:
mkdir -p localization
cp <skill>/references/glossary-template.json     localization/glossary.json
cp <skill>/references/style-guide-template.md    localization/style-guide.ru.md
cp <skill>/references/style-guide-template.md    localization/style-guide.es.md
# Optional: cp <skill>/references/tier-overrides-template.json localization/tier-overrides.json

# 2. Fill the configs (glossary terms, per-locale style guides). Then ask the AI assistant:
#
#    "Localize ./content/index.json to Russian and Spanish using the configs in ./localization/."

# 3. Optional: inspect raw MT for a single string before the editor pass.
prompsit translate "Welcome to our open source platform" -s en -t ru
```

On the first run, `localization/.translation-state.json` is created with empty hashes.
Subsequent runs use it for diff-aware re-translation (see [Diff-Aware Re-Run](#diff-aware-re-run)).

## Inputs

The skill is content-format-agnostic. It operates on `(key, source_text, target_locale)`
triples extracted from JSON, YAML, `.po`, `.strings`, Markdown — whatever the project uses.
It expects three configs under `localization/` (path is configurable):

| File | Purpose | Template |
| ---- | ------- | -------- |
| `glossary.json` | Frozen terminology per locale + terms to preserve in source language | [references/glossary-template.json](references/glossary-template.json) |
| `style-guide.<locale>.md` | Per-locale voice contract: audience, register, sensitivity, avoid, examples | [references/style-guide-template.md](references/style-guide-template.md) |
| `tier-overrides.json` (optional) | Override the default tier classifier per key pattern | [references/tier-overrides-template.json](references/tier-overrides-template.json) |

The skill **MUST** use glossary translations literally. If a source string contains a glossary
term and the output does not include the locked translation, regenerate the string.

## The Three Tiers

Every translatable string falls into one of three tiers; strategies differ sharply. See
[references/tiers.md](references/tiers.md) for the full per-tier strategy and the editor test.

| Tier | Use for | Strategy summary |
| ---- | ------- | ---------------- |
| **Witness** | Hero titles, eyebrows, OG/SEO meta, FAQ questions, marketing button labels | Transcreate: 2–3 variants, critique, pick most natural, back-translate to verify |
| **Body** | Lead, descriptions, FAQ answers, blog body, why-cards, explanatory prose | Editor mode: read source, set aside, write what a native editor would write |
| **UI** | Action labels, filters, statuses, ARIA strings, error messages, form labels | Glossary lookup. Missing term → fail loud. Consistency across screens is required |

## Workflow

### Phase 1 — Classify

For each `(key, text)` pair in the source:

1. Apply `tier-overrides.json` patterns first.
2. Otherwise apply heuristics in this order:
   - path matches `hero|title|eyebrow|tagline|og|seo|faq.*.question` → witness
   - path matches `body|lead|boundary|description|content|faq.*.answer` → body
   - path matches `actions|buttons|status|filter|aria|error|label` → ui
   - length < 30 chars, no sentence-end punctuation, not already classified → ui
   - length > 50 chars with sentence punctuation → body
   - default → body (safer than guessing witness or ui)

### Phase 2 — Translate per tier

Apply the tier strategy from [references/tiers.md](references/tiers.md). For each output
string, record:

- `key`, `source_text`, `target_locale`, `output_text`
- `tier` (witness / body / ui)
- `glossary_hits` — list of glossary terms found in source and used in output
- `variants` (witness only) — the 2–3 candidates with brief notes
- `needs_review: true`

### Phase 3 — Verify

1. **Glossary lint.** For every glossary term present in `source_text`, verify the locked
   translation appears in `output_text`. On miss, regenerate the string with explicit
   instruction: `you MUST use "<locked>" for "<source term>"`.
2. **Back-translation check** (witness only). Translate the output back to the source
   language. Compare semantically to the original. If the meaning has drifted, regenerate.
   Acceptance criterion: a native speaker should recognize source and back-translation as
   expressing the same idea in different registers.
3. **Style-guide compliance** (witness and body). Re-read each output against the locale
   style guide's `Sensitivity` and `Avoid` sections. On violation, regenerate.
4. **Parity check.** Every source key must have a translation in every target locale. On
   miss, fail loud.

### Phase 4 — Output

1. Write translations back to the project's storage in its original format.
2. Update `localization/.translation-state.json` (schema below).
3. Print a review checklist grouped by tier, listing every `needs_review: true` entry.
4. Tell the user: "Draft ready. N strings need native-speaker review before publication."
   Do not communicate "translation done".

`localization/.translation-state.json` schema:

```json
{
  "source_hash_per_key": { "hero.title": "sha256:..." },
  "translations": {
    "ru": {
      "hero.title": {
        "output": "...",
        "tier": "witness",
        "needs_review": true,
        "generated_at": "2026-04-28T12:00:00Z",
        "glossary_hits": ["open source"]
      }
    }
  }
}
```

## Optional MT Pre-Pass

For projects with thousands of strings where speed matters, an MT pre-pass via
`prompsit-translate` is supported. Off by default. Enable per project:

```bash
export PROMPSIT_LOCALIZE__USE_MT_PREPASS=true
```

When enabled, **body** strings only:

1. Batch and send to `prompsit translate -s <source> -t <target>` for a raw MT draft.
2. Pass the MT output to the LLM with editor framing: "Here is the source and a raw machine
   translation. Rewrite as a native editor would. The MT is a reference for meaning, not
   for style."
3. Continue to Phase 3.

Witness and UI tiers ignore the pre-pass: witness needs creative generation (MT will be flat
by definition), UI needs glossary lookup (MT can drift from frozen terminology).

Skip the pre-pass when content is under ~500 strings, sensitive in tone, or when locale
consistency matters more than throughput.

## Diff-Aware Re-Run

When source content changes, re-translate only what changed:

1. Compute the hash of each source key's text.
2. Compare to `source_hash_per_key` in `localization/.translation-state.json`.
3. Run the full pipeline only for keys whose source hash changed, or whose target is missing
   for any locale.
4. Preserve `needs_review` from the previous run for unchanged keys. A previously approved
   translation stays approved.

## Forbidden

- Do not auto-clear `needs_review`. Only an explicit human review action clears it.
- Do not invent glossary entries. If a term is missing from `glossary.json`, fail loud.
- Do not preserve source-language structure for witness or body strings.
- Do not deduplicate "близкие по смыслу" strings. Each key has its own context.
- Do not treat style-guide examples as templates to copy. They define the voice, not the
  wording.

## Native Review Is the Exit Gate

This skill produces drafts. Final publication requires native-speaker review. The skill
makes that explicit by flagging every output and listing flagged outputs in the Phase 4
checklist. The user clears flags after review, not the skill.

## Definition of Done

- [ ] Parity check passes: every source key has output in every target locale.
- [ ] Glossary lint passes: every glossary term in source has locked translation in output.
- [ ] Witness strings pass back-translation check.
- [ ] Witness and body strings pass style-guide compliance.
- [ ] Output written to project storage in original format.
- [ ] `localization/.translation-state.json` updated with hashes and review flags.
- [ ] Review checklist printed; user knows count of strings pending native review.

---
**Version:** 0.1.0
**Last Updated:** 2026-04-28
