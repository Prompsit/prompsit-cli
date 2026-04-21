# Rebuttal Plan — EAMT2026 Submission 87

> **SCOPE:** Strategy for the 300-word rebuttal response to EAMT2026 reviewers. Lists reviewer concerns, what the response commits to, and what is deliberately excluded.

## Rules We Operate Under

- Hard cap: 300 words.
- Factual errors and reviewer questions only. No new research results. No presentation reformulation.
- Polite and constructive tone. Reviewers see responses but do not reply.
- Rebuttal window: 17–22 April 2026.

## Consolidated Reviewer Concerns

| # | Theme | R1 | R2 | R3 | Priority |
|---|---|---|---|---|---|
| 1 | Energy "~100x" claim unsupported | x | x | x | HIGH |
| 2 | No quality benchmarks / competitor comparison (DeepL, Google, LLMs) | x | x | x | HIGH |
| 3 | "Millisecond responses" claim has no percentile numbers | | | x | HIGH |
| 4 | Privacy claim needs deployment detail (logging, retention, telemetry) | | | x | HIGH |
| 5 | "Open-source" scope ambiguous (CLI vs. backend) | x | | | MEDIUM |
| 6 | Fine-tuning workflow: must users contact developers? | | x | | MEDIUM |
| 7 | Pricing / free-tier limits / SLA / data residency absent | | x | x | MEDIUM |
| 8 | Terminology clarifications (variety converters; analysing parallel corpora; token overhead) | | x | | LOW |
| 9 | Minor grammar fixes (three items) | | x | | LOW |
| 10 | Title could mention low-resource languages | | x | | SKIP |

## Response Strategy

**Genre framing.** This is a 2-page Projects/Products track description, not a research paper. The page limit prevents folding additional benchmark tables, latency percentiles, deployment notes, and pricing into the article. Where reviewers ask for material that physically does not fit, we defer it to the **poster**, conditional on acceptance, rather than promising it for camera-ready.

**Block A — Evidence for load-bearing claims (rows 1, 2, 3).**
Concede the gap openly. For the energy claim: soften the wording to "an order of magnitude" and cite published references (Bentivogli et al. 2022, Patterson et al. 2021, Pangeanic 2024) — no internal measurements required. Defer to the **poster**: (a) p50/p95 latency with payload sizes and cache-hit assumptions, (b) throughput figures, (c) COMET/chrF on FLORES-200 and WMT against specific commercial providers (DeepL, Google Cloud Translation). Highlight low-resource pairs where differentiation is strongest.

**Block B — "Open-source" clarification (row 5).**
Concede R1's framing. Restate scope: CLI (Apache 2.0) + open-source engines (OPUS-MT, Apertium, CTranslate2, Bicleaner-AI, Monotextor) + our own released models. Commit to rephrasing.

**Block C — Privacy (row 4).**
Factual statement about deployment: payloads live in worker memory for request lifetime; for async document jobs, files have a short time-bounded TTL with secure deletion; no content logging, no training reuse, no third-party analytics. Commit to a short deployment note and link to data-processing statement.

**Block D — R2 question clarifications (rows 6, 8).**
Direct one-line answers: (i) fine-tuning available on request; user-level adaptation via the public Translation Memory API (TMX import, fuzzy search) — no developer contact needed; (ii) "variety converters" = language-variety converters; (iii) "analysing parallel corpora" = translating held-out sources and comparing against references via COMET/MetricX; (iv) "token overhead" = LLM per-token pricing inflates end-user cost vs. our character-based model.

**Block E — Pricing (row 7).**
One-line commitment to add free-tier limits and paid-tier ranges in camera-ready.

**Block F — Minor corrections (row 9).**
One-line acceptance of all three grammar fixes.

## Deliberately Excluded

- Row 10 (title): cosmetic, not factual — would burn word budget.
- Defence of the AI-agent section: R1 and R3 were positive about it; R3 only asked to "tighten", which is presentational. Not a factual error.
- Any new numerical results stated as findings. All numbers are commitments for camera-ready, not claims made in the rebuttal itself (per EAMT rules).

## Open Decisions

Final wording of `03-draft.md` depends on answers to these six questions. Current draft assumes the underlined default.

1. **Energy evidence**: <u>literature reference only</u> / own measurements / soften to "an order of magnitude".
2. **Competitors**: <u>DeepL + Google Cloud Translation explicit</u> / keep generic / also include LLM baseline (GPT-4o / Gemini).
3. **Privacy for async documents**: <u>acknowledge ≤2-day TTL with secure deletion</u> / keep wording abstract.
4. **Fine-tuning**: <u>"TM self-service + fine-tuning on request"</u> / "fine-tuning is not offered as a service".
5. **Pricing**: <u>defer concrete numbers to camera-ready</u> / commit to them now.
6. **Latency numbers**: source — <u>observability stack</u> / only aspirational targets.

## Execution Order

1. Resolve the six open decisions.
2. Edit `03-draft.md` if the defaults do not hold.
3. Verify word count ≤ 300 (strip markdown, count tokens).
4. Paste into the EAMT submission system before 22 April 2026.

## Maintenance

**Update Triggers:** reviewer adds a new review; user revises open decisions; camera-ready scope changes.

**Last Updated:** 2026-04-20.
