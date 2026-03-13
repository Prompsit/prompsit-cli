// Discovery API resource — format and options endpoints for all services.
// Replaces FormatsResource (which only covered document translation formats).

import { z } from "zod";
import type { AuthSession } from "../auth-session.ts";
import {
  FormatsResponseSchema,
  DataScoreLanguagesResponseSchema,
  type FormatInfo,
  type FormatsResponse,
  type DataScoreLanguagesResponse,
} from "../models.ts";
import { Endpoint } from "../../shared/constants.ts";

/**
 * Discovery API resource for format/options discovery across all services.
 *
 * All endpoints are public (LIGHT rate limit), but use AuthSession for
 * consistency with the existing resource pattern.
 */
export class DiscoveryResource {
  private readonly session: AuthSession;
  private readonly baseUrl: string;

  constructor(session: AuthSession, baseUrl: string) {
    this.session = session;
    this.baseUrl = baseUrl;
  }

  /** Shared GET + Zod parse. Eliminates boilerplate across discovery methods. */
  private async get<T>(
    endpoint: string,
    schema: z.ZodType<T>,
    searchParams?: Record<string, string>
  ): Promise<T> {
    const data = await this.session.request<unknown>("GET", `${this.baseUrl}${endpoint}`, {
      ...(searchParams ? { searchParams } : {}),
    });
    return schema.parse(data);
  }

  /** GET /v1/translation/document/formats — document translation formats. */
  async documentFormats(): Promise<FormatInfo[]> {
    const result = await this.get(Endpoint.DOCUMENT_FORMATS, FormatsResponseSchema);
    return result.formats;
  }

  /** GET /v1/quality/score/formats — QE file scoring formats. */
  async qeFormats(): Promise<FormatInfo[]> {
    const result = await this.get(Endpoint.QE_FORMATS, FormatsResponseSchema);
    return result.formats;
  }

  /** GET /v1/data/score/formats — Bicleaner scoring formats. */
  async dataScoreFormats(): Promise<FormatsResponse> {
    return this.get(Endpoint.DATA_SCORE_FORMATS, FormatsResponseSchema);
  }

  /** GET /v1/data/score/languages — Bicleaner supported source languages. */
  async dataScoreLanguages(): Promise<DataScoreLanguagesResponse> {
    return this.get(Endpoint.DATA_SCORE_LANGUAGES, DataScoreLanguagesResponseSchema);
  }

  /** GET /v1/data/annotate/formats — annotation input formats. */
  async dataAnnotateFormats(): Promise<FormatsResponse> {
    return this.get(Endpoint.DATA_ANNOTATE_FORMATS, FormatsResponseSchema);
  }
}
