import type {
  EvaluationResponse,
  HealthResponse,
  TMListResponse,
  TMSearchResponse,
  TMSegmentListResponse,
  TranslationResponse,
  UserUsageResponse,
} from "../api/models.ts";
import type {
  EvaluationResponseVM,
  HealthResponseVM,
  TmListVM,
  TmSearchVM,
  TmSegmentListVM,
  TranslationResponseVM,
  UsageVM,
} from "../output/view-models.ts";

/** Map API health check response to display-layer view model. */
export function toHealthResponseVM(input: HealthResponse): HealthResponseVM {
  return {
    status: input.status,
    database: input.database,
    redis: input.redis,
    services: input.services,
    version: input.version,
    timestamp: input.timestamp,
  };
}

/** Map API translation response to display-layer view model, flattening nested items. */
export function toTranslationResponseVM(input: TranslationResponse): TranslationResponseVM {
  return {
    source_lang: input.source_lang,
    target_lang: input.target_lang,
    engine: input.engine,
    total_latency_ms: input.total_latency_ms,
    translations: input.translations.map((item) => ({
      translated_text: item.translated_text,
      latency_ms: item.latency_ms,
      quality_score: item.quality_score,
    })),
  };
}

/** Map API evaluation response to display-layer view model. */
export function toEvaluationResponseVM(input: EvaluationResponse): EvaluationResponseVM {
  return {
    corpus_scores: input.corpus_scores,
  };
}

/** Map API TM list response to display-layer view model. */
export function toTmListVM(input: TMListResponse): TmListVM {
  return {
    items: input.items.map((tm) => ({
      sourceLang: tm.source_lang,
      targetLang: tm.target_lang,
      segmentCount: tm.segment_count,
      createdAt: tm.created_at,
    })),
  };
}

/** Map API TM segment list response to display-layer view model. */
export function toTmSegmentListVM(input: TMSegmentListResponse): TmSegmentListVM {
  return {
    items: input.items.map((seg) => ({
      sourceText: seg.source_text,
      targetText: seg.target_text,
      createdAt: seg.created_at,
    })),
  };
}

/** Map API TM search response to display-layer view model. */
export function toTmSearchVM(input: TMSearchResponse): TmSearchVM {
  return {
    hits: input.hits.map((hit) => ({
      sourceText: hit.source_text,
      targetText: hit.target_text,
      similarity: hit.similarity,
      matchType: hit.match_type,
    })),
  };
}

/** Map API usage response to display-layer view model, flattening nested structure. */
export function toUsageVM(input: UserUsageResponse): UsageVM {
  return {
    tierName: input.tier.name,
    charsUsed: input.daily_usage.chars_used,
    charsLimit: input.daily_usage.chars_limit,
    percentage: input.daily_usage.percentage,
    resetAt: input.daily_usage.reset_at,
    corpusBytesUsed: input.corpus_usage.bytes_used,
    corpusBytesLimit: input.corpus_usage.bytes_limit,
    corpusPercentage: input.corpus_usage.percentage,
    corpusResetAt: input.corpus_usage.reset_at,
    subscriptionActive: input.subscription.active,
  };
}
