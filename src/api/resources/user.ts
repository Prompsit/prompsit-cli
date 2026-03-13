// User resource - GET /v1/user/usage with Zod validation
// Uses AuthSession (authenticated requests with auto-refresh).

import type { AuthSession } from "../auth-session.ts";
import { UserUsageResponseSchema, type UserUsageResponse } from "../models.ts";
import { Endpoint } from "../../shared/constants.ts";

/**
 * User API resource.
 *
 * Calls GET /v1/user/usage via AuthSession (requires auth).
 * Validates response with Zod schema at boundary.
 */
export class UserResource {
  private readonly session: AuthSession;
  private readonly baseUrl: string;

  constructor(session: AuthSession, baseUrl: string) {
    this.session = session;
    this.baseUrl = baseUrl;
  }

  /**
   * Get current usage and plan limits.
   *
   * @returns Validated UserUsageResponse
   * @throws AuthenticationError if not authenticated
   * @throws ZodError if response schema mismatch
   */
  async getUsage(): Promise<UserUsageResponse> {
    const data = await this.session.request<unknown>(
      "GET",
      `${this.baseUrl}${Endpoint.USER_USAGE}`,
      {}
    );
    return UserUsageResponseSchema.parse(data);
  }
}
