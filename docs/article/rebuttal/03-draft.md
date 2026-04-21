# EAMT2026 Rebuttal — Submission 87 — Draft Response

> **SCOPE:** Final text to paste into the EAMT2026 rebuttal submission form. Any change must preserve the ≤300-word hard cap and remain grounded in `02-research.md`.
>
> **Current word count:** ~278 / 300 (counted on the response body only, excluding this frontmatter).
>
> **Strategy** (per `01-plan.md` revision 2026-04-21): product-description framing + poster deferral. Energy claim softened to "an order of magnitude" with literature citations (Bentivogli et al. 2022, Patterson et al. 2021, Pangeanic 2024). Quantitative material (latency percentiles, FLORES-200/WMT, pricing) deferred to the poster, conditional on acceptance. R2's grammatical fixes already applied to the manuscript.

---

We thank the reviewers for their careful feedback.

Within the strict 2-page limit of the EAMT Projects/Products track, the additional measurements requested in the reviews are deferred to the accompanying poster, conditional on acceptance.

**Energy/latency/benchmarks [R1, R2, R3].** We will soften "100 times less energy" to "an order of magnitude" and cite published NMT-vs-LLM inference work (Bentivogli et al., 2022; Patterson et al., 2021; Pangeanic 2024: 10–100× throughput gap, 5–50× per-word cost gap). Poster: p50/p95 latency, payload sizes, cache-hit assumptions, throughput from our observability stack; plus COMET and chrF on FLORES-200 and WMT against DeepL and Google Cloud Translation, focused on low-resource pairs.

**"Open-source" [R1].** Correct — the CLI is Apache 2.0; the backend is hosted. "Open-source" refers to the CLI, the engines we use (OPUS-MT, Apertium, CTranslate2, Bicleaner-AI, Monotextor), and our own released engines.

**Privacy [R3].** Synchronous payloads live only in worker memory for the request lifetime; no content logging, no training reuse, no third-party analytics. Async document jobs are stored ≤2 days with cryptographic-grade secure deletion. A deployment note and link to our data-processing statement will accompany the poster.

**R2 clarifications.** (i) System-level fine-tuning is on request; user-level adaptation is self-service via our public Translation Memory API (TMX import, fuzzy match). (ii) "Variety converters" = language-variety converters. (iii) "Analysing parallel corpora" = translating held-out sources and comparing against references via COMET/MetricX. (iv) "Token overhead" = LLM per-token pricing inflates end-user cost versus our character-based model.

**Pricing [R2, R3].** Free-tier limits and paid-tier ranges accompany the poster. R2's three grammatical corrections are already applied to the manuscript.

We thank the reviewers again for their time and constructive comments, and we look forward to the program committee's discussion.

---

## Maintenance

**Update Triggers:** strategy in `01-plan.md` shifts; reviewer publishes a correction; word count drifts above 300.

**Last Updated:** 2026-04-21.
