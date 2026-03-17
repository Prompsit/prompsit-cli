// See API-451: Auth Session with proactive + reactive token refresh
// Wraps HttpTransport with optimistic auth and automatic token lifecycle management.
// Pattern: public fallback -> proactive refresh -> request -> reactive 401 retry

import type { Method, Options as GotOptions } from "got";
import type { Progress } from "./transport.ts";
import type { HttpTransport, RawResponse } from "./transport.ts";

export type { Progress } from "./transport.ts";
import { AuthResource } from "./resources/auth.ts";
import { AuthenticationError, NetworkError, ServerError } from "./errors.ts";
import {
  getRefreshToken,
  getAccountId,
  saveTokens,
  clearTokens,
  isAuthenticated,
  isTokenExpired,
} from "../config/credentials.ts";

/**
 * Authenticated HTTP session with automatic token refresh.
 *
 * Wraps HttpTransport (composition, not inheritance) and adds:
 * 1. Public fallback: if not authenticated, sends request without auth header (API decides)
 * 2. Proactive refresh: refreshes token before request if expired
 * 3. Reactive refresh: on 401, refreshes once and retries
 *
 * Error differentiation (Agent Review finding):
 * - Auth errors (401/invalid_grant): clear tokens, throw AuthenticationError
 * - Network/server errors: preserve tokens, propagate retryable error
 */
export class AuthSession {
  private readonly transport: HttpTransport;
  private readonly authResource: AuthResource;
  // Process-local refresh mutex (single Node.js process). Cross-process coordination is out of scope.
  private refreshPromise: Promise<boolean> | null = null;

  constructor(transport: HttpTransport, authResource: AuthResource) {
    this.transport = transport;
    this.authResource = authResource;
  }

  /** Make authenticated JSON request with auto-refresh. */
  async request<T>(
    method: Method,
    url: string,
    options: Partial<GotOptions> = {},
    signal?: AbortSignal,
    onUploadProgress?: (progress: Progress) => void
  ): Promise<T> {
    return this.withAuth(
      (publicFlag, sig) =>
        this.transport.request<T>(method, url, options, publicFlag, sig, onUploadProgress),
      signal
    );
  }

  /** Make authenticated request returning raw buffer + headers. */
  async requestRaw(
    method: Method,
    url: string,
    options: Partial<GotOptions> = {},
    signal?: AbortSignal
  ): Promise<RawResponse> {
    return this.withAuth(
      (publicFlag, sig) => this.transport.requestRaw(method, url, options, publicFlag, sig),
      signal
    );
  }

  /** Stream authenticated response directly to file on disk. */
  async requestToFile(
    method: Method,
    url: string,
    outputPath: string,
    options: Partial<GotOptions> = {},
    signal?: AbortSignal,
    onDownloadProgress?: (progress: Progress) => void
  ): Promise<string> {
    return this.withAuth(
      (publicFlag, sig) =>
        this.transport.requestToFile(
          method,
          url,
          outputPath,
          options,
          publicFlag,
          sig,
          onDownloadProgress
        ),
      signal
    );
  }

  /**
   * Auth wrapper: public fallback -> proactive refresh -> execute -> reactive 401 retry.
   *
   * Generic over return type — works for JSON (request), buffer (requestRaw),
   * and file streaming (requestToFile).
   */
  private async withAuth<T>(
    fn: (publicFlag: boolean, signal?: AbortSignal) => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    // 1. No token — send without auth header; let API decide (public vs protected)
    if (!isAuthenticated()) {
      return await fn(true, signal);
    }

    // 2. Proactive refresh: if token expired, refresh before request
    if (isTokenExpired()) {
      const refreshed = await this.tryRefresh();
      if (!refreshed) {
        clearTokens();
        throw new AuthenticationError("Session expired.");
      }
    }

    // 3. Execute with auth
    try {
      return await fn(false, signal);
    } catch (error: unknown) {
      // 4. Reactive refresh: on 401, refresh once and retry
      if (error instanceof AuthenticationError) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          return await fn(false, signal);
        }
        clearTokens();
        throw new AuthenticationError("Authentication failed.");
      }
      throw error;
    }
  }

  /**
   * Attempt token refresh using refresh token.
   *
   * Uses Promise-based mutex: concurrent callers share the same in-flight
   * refresh Promise instead of racing. This prevents the second caller from
   * clearing tokens while the first is still refreshing.
   *
   * @returns true if refresh succeeded, false if auth failed
   * @throws NetworkError | ServerError if retryable error during refresh
   */
  tryRefresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this._doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async _doRefresh(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await this.authResource.refreshToken(refreshToken);

      // Save new tokens; preserve existing refresh token if server omits new one
      saveTokens({
        accessToken: response.access_token,
        refreshToken: response.refresh_token ?? refreshToken,
        accountId: getAccountId() ?? undefined,
        expiresIn: response.expires_in ?? undefined,
        plan: response.plan,
      });

      // Force new Bearer header on next request
      this.transport.resetAuthClient();

      return true;
    } catch (error: unknown) {
      // Auth errors (401/invalid_grant): refresh token expired
      if (error instanceof AuthenticationError) {
        return false;
      }
      // Network/server errors: preserve tokens, propagate retryable error
      if (error instanceof NetworkError || error instanceof ServerError) {
        throw error;
      }
      // Unknown error: treat as auth failure
      return false;
    }
  }
}
