// See API-535: Translation Memory resource — list, segments, import, search
// Uses AuthSession (authenticated requests with auto-refresh).
// F1: profile_id is a query param in import, NOT a form field.

import type { AuthSession, Progress } from "../auth-session.ts";
import {
  TMListResponseSchema,
  TMSegmentListResponseSchema,
  TMImportResponseSchema,
  TMSearchResponseSchema,
  type TMListResponse,
  type TMSegmentListResponse,
  type TMImportResponse,
  type TMSearchResponse,
  type TMListParams,
  type TMShowSegmentsParams,
  type TMSearchParams,
} from "../models.ts";
import { Endpoint, TM_SEARCH_THRESHOLD } from "../../shared/constants.ts";
import { openAsBlob } from "node:fs";
import { basename } from "node:path";

/**
 * Translation Memory API resource.
 *
 * - list(): GET /v1/translation/memory (TM containers)
 * - listSegments(): GET /v1/translation/memory/segments (paginated)
 * - importTmx(): POST /v1/translation/memory/import (multipart form)
 * - search(): POST /v1/translation/memory/search (fuzzy)
 */
export class TMResource {
  private readonly session: AuthSession;
  private readonly baseUrl: string;

  constructor(session: AuthSession, baseUrl: string) {
    this.session = session;
    this.baseUrl = baseUrl;
  }

  /**
   * List translation memories for a profile.
   * Optionally filter by source/target language.
   */
  async list(params?: TMListParams): Promise<TMListResponse> {
    const searchParams: Record<string, string> = {};
    if (params?.profileId) searchParams.profile_id = params.profileId;
    if (params?.sourceLang) searchParams.source_lang = params.sourceLang;
    if (params?.targetLang) searchParams.target_lang = params.targetLang;

    const data = await this.session.request<unknown>("GET", `${this.baseUrl}${Endpoint.TM}`, {
      searchParams,
    });

    return TMListResponseSchema.parse(data);
  }

  /**
   * List segments of a specific TM (paginated).
   * Requires both source and target language.
   */
  async listSegments(params: TMShowSegmentsParams): Promise<TMSegmentListResponse> {
    const searchParams: Record<string, string | number> = {
      source_lang: params.sourceLang,
      target_lang: params.targetLang,
    };
    if (params.profileId) searchParams.profile_id = params.profileId;
    if (params.page !== undefined) searchParams.page = params.page;
    if (params.pageSize !== undefined) searchParams.page_size = params.pageSize;

    const data = await this.session.request<unknown>(
      "GET",
      `${this.baseUrl}${Endpoint.TM_SEGMENTS}`,
      { searchParams }
    );

    return TMSegmentListResponseSchema.parse(data);
  }

  /**
   * Import TMX file into TM.
   *
   * F1: profile_id is a QUERY PARAM, not a form field.
   * Language pair is auto-detected from TMX header by the API.
   */
  async importTmx(
    filePath: string,
    profileId?: string,
    onUploadProgress?: (progress: Progress) => void
  ): Promise<TMImportResponse> {
    const fileBlob = await openAsBlob(filePath);
    const fileName = basename(filePath);

    const formData = new FormData();
    formData.append("file", fileBlob, fileName);

    // F1: profile_id goes in searchParams, NOT in formData
    const searchParams: Record<string, string> = {};
    if (profileId) searchParams.profile_id = profileId;

    const data = await this.session.request<unknown>(
      "POST",
      `${this.baseUrl}${Endpoint.TM_IMPORT}`,
      { body: formData, searchParams },
      undefined,
      onUploadProgress
    );

    return TMImportResponseSchema.parse(data);
  }

  /**
   * Fuzzy search across profile TMs.
   * Threshold hardcoded to TM_SEARCH_THRESHOLD (0.7).
   */
  async search(params: TMSearchParams): Promise<TMSearchResponse> {
    const body: Record<string, unknown> = {
      query: params.query,
      source_lang: params.sourceLang,
      target_lang: params.targetLang,
      threshold: TM_SEARCH_THRESHOLD,
    };
    if (params.limit !== undefined) body.limit = params.limit;
    if (params.profileId) body.profile_id = params.profileId;

    const data = await this.session.request<unknown>(
      "POST",
      `${this.baseUrl}${Endpoint.TM_SEARCH}`,
      { json: body }
    );

    return TMSearchResponseSchema.parse(data);
  }
}
