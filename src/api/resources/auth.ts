// See API-450: Auth Resource + Transport Bearer Integration
// AuthResource for OAuth2 ROPC flow (RFC 6749 Section 4.3).
// Uses public transport (token endpoint does not require Authorization header).

import type { HttpTransport } from "../transport.ts";
import { TokenResponseSchema, type TokenResponse } from "../models.ts";
import { Endpoint, GrantType } from "../../shared/constants.ts";

/**
 * Auth API resource for OAuth2 token operations.
 *
 * Calls POST /v1/auth/token via public transport (no auth).
 * Uses application/x-www-form-urlencoded (NOT JSON) per OAuth2 spec.
 * Validates response with Zod schema at boundary.
 */
export class AuthResource {
  private readonly transport: HttpTransport;
  private readonly baseUrl: string;

  constructor(transport: HttpTransport, baseUrl: string) {
    this.transport = transport;
    this.baseUrl = baseUrl;
  }

  /**
   * Authenticate with username/password (Resource Owner Password Credentials).
   *
   * @param username - User account ID (e.g., email)
   * @param password - User secret/API key
   * @returns Validated TokenResponse with nullable fields normalized to undefined
   * @throws AuthenticationError if credentials invalid (401)
   * @throws NetworkError if API unreachable
   */
  async getToken(username: string, password: string): Promise<TokenResponse> {
    const baseUrl = this.baseUrl;
    const data = await this.transport.request<unknown>(
      "POST",
      `${baseUrl}${Endpoint.AUTH_TOKEN}`,
      {
        form: {
          grant_type: GrantType.PASSWORD,
          username,
          password,
        },
      },
      true // public client (no auth header)
    );
    return TokenResponseSchema.parse(data);
  }

  /**
   * Refresh access token using refresh token (RFC 6749 Section 6).
   *
   * @param refreshToken - Valid refresh token
   * @returns Validated TokenResponse with new access token
   * @throws AuthenticationError if refresh token invalid/expired (401)
   * @throws NetworkError if API unreachable
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const baseUrl = this.baseUrl;
    const data = await this.transport.request<unknown>(
      "POST",
      `${baseUrl}${Endpoint.AUTH_TOKEN}`,
      {
        form: {
          grant_type: GrantType.REFRESH_TOKEN,
          refresh_token: refreshToken,
        },
      },
      true // public client (no auth header)
    );
    return TokenResponseSchema.parse(data);
  }
}
