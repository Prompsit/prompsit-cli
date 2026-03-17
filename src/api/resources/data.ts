// See API-495: DataResource - multipart upload for data annotation and scoring
// Uses AuthSession (authenticated requests with auto-refresh).
// Pattern: FormData + Blob for multipart file upload via got.

import { openAsBlob } from "node:fs";
import { basename } from "node:path";
import type { AuthSession, Progress } from "../auth-session.ts";
import {
  DataJobCreateResponseSchema,
  type DataJobCreateResponse,
  type ScoreParams,
  type AnnotateParams,
} from "../models.ts";
import { Endpoint } from "../../shared/constants.ts";

/**
 * Data processing API resource (annotation + scoring).
 *
 * Calls POST /v1/data/annotate and POST /v1/data/score via AuthSession.
 * Both endpoints accept multipart file uploads and return DataJobCreateResponse
 * for async job tracking.
 */
export class DataResource {
  private readonly session: AuthSession;
  private readonly baseUrl: string;

  constructor(session: AuthSession, baseUrl: string) {
    this.session = session;
    this.baseUrl = baseUrl;
  }

  /**
   * Upload corpus file for annotation via Monotextor (async job).
   *
   * @param params - Annotation parameters (file, lang, pipeline, optional filters)
   * @returns DataJobCreateResponse with job_id for tracking
   */
  async annotate(
    params: AnnotateParams,
    onUploadProgress?: (progress: Progress) => void
  ): Promise<DataJobCreateResponse> {
    const { filePath, lang, pipeline, minLen, minAvgWords, lidModel } = params;
    const fileBlob = await openAsBlob(filePath);
    const fileName = basename(filePath);

    const formData = new FormData();
    formData.append("file", fileBlob, fileName);
    formData.append("lang", lang);
    if (pipeline != null) formData.append("pipeline", pipeline.join(","));
    if (minLen != null) formData.append("min_len", String(minLen));
    if (minAvgWords != null) formData.append("min_avg_words", String(minAvgWords));
    formData.append("lid_model", lidModel);

    const data = await this.session.request<unknown>(
      "POST",
      `${this.baseUrl}${Endpoint.DATA_ANNOTATE}`,
      { body: formData },
      undefined,
      onUploadProgress
    );

    return DataJobCreateResponseSchema.parse(data);
  }

  /**
   * Upload file(s) for quality scoring via Bicleaner (async job).
   *
   * Supports two modes:
   * - Single file: TMX, TSV
   * - Parallel mode: source_file + target_file (two separate files)
   *
   * @param params - Score parameters (source file, optional target file and output format)
   * @returns DataJobCreateResponse with job_id for tracking
   * @throws AuthenticationError if not authenticated
   * @throws ZodError if response schema mismatch
   * @throws APIError on API errors
   */
  async score(
    params: ScoreParams,
    onUploadProgress?: (progress: Progress) => void
  ): Promise<DataJobCreateResponse> {
    const { sourceFile, targetFile, outputFormat, sourceLang } = params;
    const baseUrl = this.baseUrl;
    const sourceBlob = await openAsBlob(sourceFile);

    const formData = new FormData();
    formData.append("source_file", sourceBlob, basename(sourceFile));

    if (targetFile) {
      const targetBlob = await openAsBlob(targetFile);
      formData.append("target_file", targetBlob, basename(targetFile));
    }

    if (outputFormat) {
      formData.append("output_format", outputFormat);
    }

    if (sourceLang) {
      formData.append("source_lang", sourceLang);
    }

    const data = await this.session.request<unknown>(
      "POST",
      `${baseUrl}${Endpoint.DATA_SCORE}`,
      { body: formData },
      undefined,
      onUploadProgress
    );

    return DataJobCreateResponseSchema.parse(data);
  }
}
