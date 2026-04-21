# Rebuttal Research — Evidence from the Prompsit API Codebase

> **SCOPE:** Factual findings from the `D:\Development\prompsit-api` repository (read on 2026-04-20) used to ground the EAMT2026 rebuttal. Every claim made in `03-draft.md` must be backed by verified code evidence listed here.

## 1. Privacy: "In-memory processing, no data storage or use for model training"

| Sub-claim | Verdict | Evidence |
|---|---|---|
| Request/response content not logged | YES | `app/infrastructure/observability/logging.py:121-134`; `app/infrastructure/http/middleware/http_logging.py:73-92`; `app/api/v1/translation.py:342-363` — only metadata (batch size, char count, lang pair, engine) is logged |
| No third-party analytics (Sentry/GA/etc.) | YES | No dependency on sentry, datadog, mixpanel, segment, GA in `pyproject.toml`; zero grep hits in `app/` |
| Internal metrics capture only counts + latency | YES | `app/services/usage/tracking.py:66-137` — tracks account_id, engine, chars, latency_ms; no payloads |
| Sync translation payloads live only in worker memory | YES | `app/services/translation/service.py` — synchronous function params; FastAPI releases after response |
| Async document files persistence | PARTIAL | `app/config.py:211` `JOB_TEMP_DIR="/tmp/prompsit-jobs"`; `app/services/job/cleanup.py:33-83` — 2-day TTL (`JOB_CLEANUP_DAYS` default 2); `app/core/security/secure_delete.py:31-111` — zero-pass overwrite before deletion |
| Job DB stores metadata only | YES | `app/infrastructure/persistence/models/translation_job.py:39-249` — status / file_path / lang pair / engine / timestamps; no source/target text columns |
| No production-to-training pipeline | YES | No "feedback_loop", "collect_training", or scheduled training-data export found |

**Rebuttal implication:** the claim is accurate for sync traffic. For async documents, honest phrasing is "time-bounded (≤2 days) with cryptographic-grade secure deletion, no training reuse, no analytics".

## 2. Latency and Caching: "5-level caching" and "millisecond responses"

| Sub-claim | Verdict | Evidence |
|---|---|---|
| Exactly 5 cache levels | YES | `app/services/tm/service.py:1-8`; `CLAUDE.md:66`. L1 Redis TM per-profile (TTL 3600 s), L2 PG exact match, L3 PG fuzzy (pg_trgm, threshold 0.75), L4 shared Redis response cache (TTL 30 d), L5 MT engine |
| 8-step pipeline | YES | `app/services/translation/batch_orchestrator.py:119-129` — tag extract, cache lookup, batch MT, cache store, tag refit, QE, result build, usage track; each step timed via `perf_counter()` |
| SSE job progress streaming | YES | `app/api/v1/jobs/sse_stream.py`; `app/services/job/sse_service.py` — events: connected / progress / complete / error / cancelled; PG LISTEN/NOTIFY + 10 s fallback poll + 15 s keep-alive |
| Measured p50/p95 in repo | NO | Only aspirational targets in `README.md:48` (<1 s translate, <500 ms languages). Grafana dashboards exist in `config/grafana/dashboards/` but no historical numbers committed to the repo |

**Rebuttal implication:** the architectural claims (5 levels, 8 steps, SSE) are defensible and can be cited with file paths in camera-ready. The "millisecond" phrasing needs measured percentiles — we must either provide them from our observability stack or soften the wording.

## 3. Energy Efficiency: "up to 100 times less energy than LLMs"

| Sub-claim | Verdict | Evidence |
|---|---|---|
| Quantized NMT via CTranslate2 | YES (from agent probes) | Service stack includes `prompsit_mt_api` running CTranslate2 engines |
| Apertium RBMT is CPU-only | YES | `prompsit_apertium_api` container in `docker-compose.yml` |
| Internal energy measurements | NOT FOUND in repo | No files matching `energy`, `power`, `watt`, `kwh`, `carbon`, `co2` returned meaningful content |
| Throughput numbers committed | NOT FOUND in repo | No benchmark artefacts in the repo |
| External published references | YES (added 2026-04-21) | See sub-section below |

### External published references (added 2026-04-21)

| Reference | Relevance | Citation |
|---|---|---|
| Bentivogli et al. 2022, *The Ecological Footprint of Neural Machine Translation Systems* | Peer-reviewed energy/CO₂ measurements for NMT inference (Transformer vs RNN, GPU vs CPU, quantization) | arxiv 2202.02170 / Springer LNCS |
| Patterson et al. 2021, *Carbon Emissions and Large Neural Network Training* | Training/inference energy of large models (incl. GPT-3 baseline at 1287 MWh / 552 tCO₂eq) | arxiv 2104.10350 |
| Pangeanic 2024, *NMT vs LLM White Book* | Industry benchmark: 10–100× NMT throughput gap; 5–50× per-word cost gap | blog.pangeanic.com/which-is-better-for-my-use-case-nmt-neural-mt-or-llm-translation |

**Rebuttal implication:** the "100 times less energy" claim is defensible *with literature citation*, not with our own internal measurements. The chosen rebuttal/poster wording is "an order of magnitude" + the three references above. Our quantized CTranslate2 + Apertium RBMT stack is contextualised against this published baseline; no self-measured numbers are required for the EAMT response.

## 4. Services and Scope (answering R2 directly)

| Claim in paper | Verdict | Evidence |
|---|---|---|
| 12 microservices | YES — exactly 12 | `docker-compose.yml`: postgres, api, apertium, mt, metricx, comet, bicleaner, pdf (Docling+pypandoc), word_alignment, tikal (Okapi), redis, monotextor |
| 25+ formats | YES — 28 registered | `app/domain/document/formats.py:261-520` — XLIFF, TMX, CSV, TSV, JSON, ARB, TXT, MD, RESX, RESW, Properties, Strings, XCStrings, HTML, SRT, VTT, PO, POT, XML, YAML, MOSES, DOCX, XLSX, PPTX, IDML, PDF |
| Translation (NMT + RBMT + AltLang) | YES | `app/api/v1/translation.py:49`; AltLang pairs: en_US↔en_GB, pt_BR↔pt_PT, fr_CA↔fr_FR, es_LA↔es_ES |
| Evaluation (COMET, MetricX) | YES | `app/api/v1/quality.py:50`; clients in `app/infrastructure/clients/comet_client.py`, `metricx_client.py` |
| Scoring (Bicleaner) | YES | `app/api/v1/scoring.py:48`; `bicleaner_client.py` |
| Annotation (Monotextor) | YES | `app/api/v1/annotation.py:42`; `monotextor_client.py`; docker service |
| Language pair count | 52 pairs | `scripts/seed_data/language_pairs.py:1-100` — AltLang 8 records, Apertium 17, Prompsit NMT 27 |
| Fine-tuning endpoint | NO | No `/finetune`, `/train`, `/custom_model` endpoints |
| Custom model upload | NO | `TranslationRequest` has no model-upload field |
| Translation Memory public API | YES | `app/api/v1/translation_memory.py:1-40` — 9 endpoints: CRUD, TMX import/export, batch add, paginated list, edit, delete, fuzzy search. Model: 1:1 per (profile, src_lang, tgt_lang). Service: `app/services/tm/service.py`; importer: `app/services/tm/importer.py` |

**Rebuttal implication:** the honest answer to R2's fine-tuning question is "no, users do not have to contact developers: system-level fine-tuning is on request, but user-level adaptation is fully self-service via the public Translation Memory API (TMX upload, fuzzy matching, hierarchy by profile)".

## Summary of Defensible vs. Fragile Claims

| Claim | Defensible with code citations | Needs softening / measurement |
|---|---|---|
| 5-level caching | YES | — |
| 8-step pipeline | YES | — |
| SSE job progress | YES | — |
| 12 microservices | YES | — |
| 25+ formats | YES (28) | — |
| In-memory sync; no logging; no training reuse | YES | Clarify ≤2-day async TTL |
| Open-source engines (OPUS-MT, Apertium, CTranslate2, Bicleaner-AI, Monotextor) | YES | — |
| Fine-tuning: no developer contact needed | YES via TM API | — |
| Millisecond responses | — | Need measured p50/p95 from observability stack |
| 100× less energy | — | Need external reference or softened wording |

## Maintenance

**Update Triggers:** API repository evolves; reviewer feedback adds new claims to verify; camera-ready adds new numbers that need grounding.

**Last Updated:** 2026-04-20.
