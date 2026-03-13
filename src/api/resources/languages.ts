// Languages resource - GET /v1/translation/languages with Zod validation
// Uses AuthSession (authenticated requests with auto-refresh).

import { z } from "zod";
import type { AuthSession } from "../auth-session.ts";
import { LanguagePairDetailSchema, type LanguagePairDetail } from "../models.ts";
import { Endpoint } from "../../shared/constants.ts";

/**
 * Languages API resource.
 *
 * Calls GET /v1/translation/languages via AuthSession (requires auth).
 * Validates response with Zod schema at boundary.
 */
export class LanguagesResource {
  private readonly session: AuthSession;
  private readonly baseUrl: string;

  constructor(session: AuthSession, baseUrl: string) {
    this.session = session;
    this.baseUrl = baseUrl;
  }

  /**
   * List available language pairs.
   *
   * @param source - Optional source language code filter (BCP 47)
   * @param target - Optional target language code filter (BCP 47)
   * @returns Validated array of LanguagePairDetail objects
   * @throws AuthenticationError if not authenticated
   * @throws ZodError if response schema mismatch
   * @throws APIError on API errors
   */
  async list(source?: string, target?: string): Promise<LanguagePairDetail[]> {
    const baseUrl = this.baseUrl;

    const params: Record<string, string> = {};
    if (source) {
      params.source = source;
    }
    if (target) {
      params.target = target;
    }

    const data = await this.session.request<unknown>("GET", `${baseUrl}${Endpoint.LANGUAGES}`, {
      searchParams: params,
    });

    return z.array(LanguagePairDetailSchema).parse(data);
  }
}
