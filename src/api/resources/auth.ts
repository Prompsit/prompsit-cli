// See API-450: Auth Resource + Transport Bearer Integration
// AuthResource for OAuth2 ROPC flow (RFC 6749 Section 4.3).
// Uses public transport (token endpoint does not require Authorization header).

import type { HttpTransport } from "../transport.ts";
import {
  TokenResponseSchema,
  DeviceAuthorizationResponseSchema,
  DeviceTokenResponseSchema,
  DeviceTokenErrorSchema,
  ChangeSecretResponseSchema,
  type TokenResponse,
  type DeviceAuthorizationResponse,
  type DeviceTokenResponse,
  type ChangeSecretResponse,
} from "../models.ts";
import { Endpoint, GrantType } from "../../shared/constants.ts";
import { APIError } from "../../errors/contracts.ts";

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

  /**
   * Initiate device authorization flow (RFC 8628 §3.1).
   *
   * @returns Device code, user code, and verification URI for browser auth
   */
  async requestDeviceCode(): Promise<DeviceAuthorizationResponse> {
    const data = await this.transport.request<unknown>(
      "POST",
      `${this.baseUrl}${Endpoint.AUTH_DEVICE}`,
      {},
      true // public client
    );
    return DeviceAuthorizationResponseSchema.parse(data);
  }

  /**
   * Poll device token endpoint (RFC 8628 §3.4).
   *
   * Returns discriminated union to encapsulate RFC 8628 error semantics.
   * Uses requestRaw with throwHttpErrors:false because transport.request<T>()
   * catches HTTP 400 via handleError() → parseApiError() which doesn't understand
   * OAuth2 error format {error, error_description} — the RFC 8628 fields are lost.
   */
  async pollDeviceToken(
    deviceCode: string
  ): Promise<
    | { status: "success"; data: DeviceTokenResponse }
    | { status: "pending" }
    | { status: "slow_down" }
    | { status: "expired" }
    | { status: "denied" }
    | { status: "transient_error" }
  > {
    try {
      const raw = await this.transport.requestRaw(
        "POST",
        `${this.baseUrl}${Endpoint.AUTH_DEVICE_TOKEN}`,
        {
          json: {
            device_code: deviceCode,
            grant_type: GrantType.DEVICE_CODE,
          },
          throwHttpErrors: false,
        },
        true // public client
      );

      if (raw.statusCode === 200) {
        const body: unknown = JSON.parse(raw.body.toString());
        return { status: "success", data: DeviceTokenResponseSchema.parse(body) };
      }

      if (raw.statusCode === 400) {
        const body: unknown = JSON.parse(raw.body.toString());
        const err = DeviceTokenErrorSchema.parse(body);
        if (err.error === "authorization_pending") return { status: "pending" };
        if (err.error === "slow_down") return { status: "slow_down" };
        if (err.error === "expired_token") return { status: "expired" };
        return { status: "denied" };
      }

      // 5xx (502 Bad Gateway, 503 Service Unavailable, etc.) — transient, retry
      if (raw.statusCode >= 500) {
        return { status: "transient_error" };
      }

      throw new APIError(
        `Unexpected status ${String(raw.statusCode)}`,
        "E_DEVICE_FLOW",
        raw.statusCode
      );
    } catch (error: unknown) {
      // Network errors (DNS, timeout, connection reset) — transient, retry
      if (error instanceof APIError) throw error; // re-throw our own errors
      return { status: "transient_error" };
    }
  }

  /**
   * Rotate or set the calling account's prompsit_secret (POST /v1/auth/secret).
   *
   * @param custom - User-supplied secret (6-72 UTF-8 bytes, printable, no
   *                 newlines, must NOT start with reserved 'pr_' prefix). If
   *                 omitted/undefined, the server generates a new pr_xxx value.
   * @returns ChangeSecretResponse with new secret + fresh JWT pair.
   * @throws APIError 401 missing/invalid JWT, 422 invalid format, 429 rate-limited.
   *
   * Side effects on success: ALL active refresh tokens are revoked and
   * token_version is bumped server-side, invalidating all previously-issued
   * access tokens. The fresh JWT pair returned here is the only valid session.
   */
  async changeSecret(custom?: string): Promise<ChangeSecretResponse> {
    const body = custom === undefined ? {} : { secret: custom };
    const data = await this.transport.request<unknown>(
      "POST",
      `${this.baseUrl}${Endpoint.AUTH_SECRET}`,
      { json: body }
    );
    return ChangeSecretResponseSchema.parse(data);
  }
}
