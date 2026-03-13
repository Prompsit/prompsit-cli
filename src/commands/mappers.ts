import type {
  EvaluationResponse,
  HealthResponse,
  TranslationResponse,
  UserUsageResponse,
} from "../api/models.ts";
import type {
  EvaluationResponseVM,
  HealthResponseVM,
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

/** Map API usage response to display-layer view model, flattening nested structure. */
export function toUsageVM(input: UserUsageResponse): UsageVM {
  return {
    tierName: input.tier.name,
    charsUsed: input.daily_usage.chars_used,
    charsLimit: input.daily_usage.chars_limit,
    percentage: input.daily_usage.percentage,
    resetAt: input.daily_usage.reset_at,
    subscriptionActive: input.subscription.active,
  };
}
