// Evaluation resource - POST /v1/quality/score (inline) + POST /v1/quality/score/file (file)
// Both methods go through AuthSession for auth, retry, hooks, and error classification.

import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";

import type { AuthSession } from "../auth-session.ts";
import {
  EvaluationResponseSchema,
  type EvaluationResponse,
  type EvaluateParams,
  type EvaluateFileParams,
  type EvaluateFileResult,
  type ScoreTagsParams,
} from "../models.ts";
import { Endpoint } from "../../shared/constants.ts";

/**
 * Evaluation API resource.
 *
 * - evaluate(): POST /v1/quality/score (JSON inline, via AuthSession)
 * - evaluateFile(): POST /v1/quality/score/file (multipart upload, binary response via requestRaw)
 */
export class EvaluationResource {
  private readonly session: AuthSession;
  private readonly baseUrl: string;

  constructor(session: AuthSession, baseUrl: string) {
    this.session = session;
    this.baseUrl = baseUrl;
  }

  /** Evaluate translation quality with specified metrics (inline segments). */
  async evaluate(params: EvaluateParams): Promise<EvaluationResponse> {
    const { segments, metrics, aggregation = "both" } = params;

    const data = await this.session.request<unknown>(
      "POST",
      `${this.baseUrl}${Endpoint.EVALUATE}`,
      {
        json: { segments, metrics, aggregation },
      }
    );

    return EvaluationResponseSchema.parse(data);
  }

  /**
   * Score inline tag quality (reference-free) via POST /v1/quality/tags.
   *
   * Omits sub_scores when not provided so the server computes both
   * (tag_preservation + tag_position). Response is wire-identical to
   * /v1/quality/score, so EvaluationResponseSchema is reused.
   *
   * Not wrapped in withWarmupRetry by the caller: a 503 here means the
   * alignment service is unavailable (tag_position only), not an ML engine
   * cold start, so it must fail fast instead of looping on warmup retry.
   */
  async scoreTags(params: ScoreTagsParams): Promise<EvaluationResponse> {
    const { segments, subScores, aggregation = "both" } = params;

    const data = await this.session.request<unknown>(
      "POST",
      `${this.baseUrl}${Endpoint.EVALUATE_TAGS}`,
      {
        json: { segments, ...(subScores ? { sub_scores: subScores } : {}), aggregation },
      }
    );

    return EvaluationResponseSchema.parse(data);
  }

  /**
   * Score a file via POST /v1/quality/score/file (multipart upload, binary response).
   *
   * Uses requestRaw() (buffer + headers) because we need X-Corpus-Scores header.
   * File size bounded by JOB_MAX_DOCUMENT_SIZE_MB (50MB) — safe to buffer.
   */
  async evaluateFile(
    params: EvaluateFileParams,
    outputPath: string,
    signal?: AbortSignal
  ): Promise<EvaluateFileResult> {
    const { filePath, metrics, aggregation = "both", outputFormat } = params;
    const url = `${this.baseUrl}${Endpoint.EVALUATE_FILE}`;

    // Build multipart form (openAsBlob streams from disk without buffering)
    const fileBlob = await openAsBlob(filePath);
    const formData = new FormData();
    formData.append("file", fileBlob, basename(filePath));
    if (metrics?.length) formData.append("metrics", metrics.join(","));
    formData.append("aggregation", aggregation);
    if (outputFormat) formData.append("output_format", outputFormat);

    const response = await this.session.requestRaw("POST", url, { body: formData }, signal);

    // Parse corpus scores from X-Corpus-Scores header
    let corpusScores: Record<string, number> = {};
    const scoresHeader = response.headers["x-corpus-scores"];
    if (typeof scoresHeader === "string") {
      try {
        corpusScores = z.record(z.string(), z.number()).parse(JSON.parse(scoresHeader));
      } catch {
        /* malformed header */
      }
    }

    await writeFile(outputPath, response.body, { signal });

    return { data: Buffer.alloc(0), filename: outputPath, corpusScores };
  }
}
