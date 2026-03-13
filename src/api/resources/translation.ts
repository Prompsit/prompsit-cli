// See API-469, API-494: Translation resource - text translation + document upload
// Uses AuthSession (authenticated requests with auto-refresh).

import type { AuthSession } from "../auth-session.ts";
import {
  TranslationResponseSchema,
  type TranslationResponse,
  DocJobCreateResponseSchema,
  type DocJobCreateResponse,
  type TranslateParams,
  type UploadDocumentParams,
} from "../models.ts";
import { Endpoint } from "../../shared/constants.ts";
import { openAsBlob } from "node:fs";
import { basename } from "node:path";

/**
 * Translation API resource.
 *
 * Calls POST /v1/translation via AuthSession (requires auth).
 * Validates response with Zod schema at boundary.
 * - translate(): POST /v1/translation (text translation)
 * - uploadDocument(): POST /v1/translation/document (async file processing)
 */
export class TranslationResource {
  private readonly session: AuthSession;
  private readonly baseUrl: string;

  constructor(session: AuthSession, baseUrl: string) {
    this.session = session;
    this.baseUrl = baseUrl;
  }

  /**
   * Translate texts via API.
   *
   * @param params - Translation parameters (texts, languages, QE flag)
   * @returns Validated TranslationResponse
   * @throws AuthenticationError if not authenticated
   * @throws ZodError if response schema mismatch
   * @throws APIError on API errors (422 invalid lang pair, etc.)
   */
  async translate(params: TranslateParams): Promise<TranslationResponse> {
    const { texts, sourceLang, targetLang, enableQe = false } = params;
    const baseUrl = this.baseUrl;

    const body: Record<string, unknown> = {
      texts,
      source_lang: sourceLang,
      target_lang: targetLang,
    };

    // Build query params (enable_qe only when true)
    const searchParams = enableQe ? { enable_qe: "true" } : {};

    const data = await this.session.request<unknown>("POST", `${baseUrl}${Endpoint.TRANSLATE}`, {
      json: body,
      searchParams,
    });

    return TranslationResponseSchema.parse(data);
  }

  /**
   * Upload document for async translation.
   *
   * Sends multipart/form-data POST with file + metadata fields.
   * Uses openAsBlob for memory-efficient streaming from disk.
   *
   * @param params - Upload parameters (file path, languages, output format)
   * @returns Validated DocJobCreateResponse with job_id for tracking
   * @throws AuthenticationError if not authenticated
   * @throws APIError on API errors (422 unsupported format, 413 file too large)
   */
  async uploadDocument(params: UploadDocumentParams): Promise<DocJobCreateResponse> {
    const { filePath, sourceLang, targetLang, outputFormat } = params;
    const baseUrl = this.baseUrl;

    // See API-494: openAsBlob streams from disk without buffering entire file
    const fileBlob = await openAsBlob(filePath);
    const fileName = basename(filePath);

    const formData = new FormData();
    formData.append("file", fileBlob, fileName);
    formData.append("source_lang", sourceLang);
    formData.append("target_lang", targetLang);
    if (outputFormat) {
      formData.append("output_format", outputFormat);
    }

    const data = await this.session.request<unknown>(
      "POST",
      `${baseUrl}${Endpoint.DOCUMENT_TRANSLATE}`,
      { body: formData }
    );

    return DocJobCreateResponseSchema.parse(data);
  }
}
