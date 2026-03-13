export interface ServiceHealthInfoVM {
  status: string;
  version?: string | null;
  missing_env?: string[] | null;
}

export interface HealthResponseVM {
  status: string;
  database: string;
  redis: string;
  services: Record<string, ServiceHealthInfoVM>;
  version: string;
  timestamp: string;
}

export interface TranslationItemVM {
  translated_text: string;
  latency_ms: number | null;
  quality_score: number | null;
}

export interface TranslationResponseVM {
  source_lang: string;
  target_lang: string;
  engine: string | null;
  total_latency_ms: number | null;
  translations: TranslationItemVM[];
}

export interface EvaluationResponseVM {
  corpus_scores?: Record<string, number> | null;
}

/** Display model for GET /v1/user/usage — flattened from nested API response. */
export interface UsageVM {
  tierName: string;
  charsUsed: number;
  charsLimit: number;
  percentage: number;
  resetAt: string;
  subscriptionActive: boolean;
}

/** Unified language entry for both translation and annotation --languages tables. */
export interface LanguageEntryVM {
  source: string;
  target: string | null;
  engines: string;
  examples: string;
}

/** Unified format entry for all --formats tables (document, QE, score/annotate). */
export interface FormatEntryVM {
  extensions: string[];
  description: string;
  output_formats: string[];
  examples: string;
}
