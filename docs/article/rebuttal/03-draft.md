# EAMT2026 Rebuttal — Submission 87 — Draft Response

> **SCOPE:** Final text to paste into the EAMT2026 rebuttal submission form. Any change must preserve the ≤300-word hard cap and remain grounded in `02-research.md`.
>
> **Current word count:** 298 / 300 (counted on the response body only, excluding this frontmatter).
>
> **Assumptions** (from `01-plan.md` open decisions — revise if any flip):
> literature reference for energy; DeepL + Google named; 2-day TTL acknowledged; TM self-service framing; pricing deferred to camera-ready; latency from observability stack.

---

We thank the reviewers for their careful and constructive feedback.

**Evidence for load-bearing claims (R1, R2, R3).** For the final version we will add: (a) a published reference plus an internal measurement note backing the "up to 100 times less energy" claim, comparing our quantized NMT/RBMT engines against general-purpose LLM inference; (b) p50/p95 latency from our observability stack, with payload sizes and cache-hit assumptions; (c) throughput figures for representative language pairs.

**Quality benchmarks and competitor comparison (R1, R2, R3).** We will add COMET and chrF results on FLORES-200 and WMT test sets for a sample of our engines versus DeepL and Google Cloud Translation, highlighting low-resource pairs where our offering is most differentiated.

**"Open-source" clarification (R1).** Correct — the CLI is Apache 2.0 and the backend is a hosted service. "Open-source" in the title refers to (a) the client, (b) the underlying engines we rely on (OPUS-MT, Apertium, CTranslate2, Bicleaner-AI, Monotextor), and (c) our own models released on HuggingFace. We will rephrase to remove ambiguity.

**Privacy (R3).** Synchronous payloads live only in worker memory for the request lifetime; no content logging, no training reuse, no third-party analytics. Async document jobs are stored time-bounded (≤2 days) with cryptographic-grade secure deletion. We will add a short deployment note and link to our data-processing statement.

**R2 clarifications.** (i) System-level fine-tuning is available on request from Prompsit, and user-level adaptation is fully self-service via our public Translation Memory API (TMX import, fuzzy match) — no developer contact required. (ii) "Variety converters" = language-variety converters. (iii) "Analysing parallel corpora and model performance" = translating held-out sources and comparing against references via COMET and MetricX. (iv) "Token overhead" means LLM per-token pricing inflates end-user cost versus our character-based model.

**Pricing (R2, R3).** We will add free-tier monthly character limits and paid-tier ranges.

We accept all minor grammatical corrections (R2).

---

## Maintenance

**Update Triggers:** any of the six open decisions in `01-plan.md` flips from its default; reviewer publishes a correction; word count drifts above 300.

**Last Updated:** 2026-04-20.
