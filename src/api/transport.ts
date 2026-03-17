// See API-445: HTTP Transport with Got Retry & Resilience
// Provides: retry config, Retry-After handling, error classification, curl hooks.
// Three request methods: request<T> (JSON), requestRaw (buffer+headers), requestToFile (streaming).

import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

import got, {
  type Got,
  type Method,
  type Options as GotOptions,
  type Progress,
  type Response,
  type RetryObject,
  HTTPError,
  RequestError,
  type BeforeRequestHook,
  type AfterResponseHook,
  type BeforeErrorHook,
  type BeforeRetryHook,
} from "got";

export type { Progress } from "got";
import { getSettings } from "../config/settings.ts";
import { getAccessToken } from "../config/credentials.ts";
import { generateTraceId } from "./trace.ts";
import { getTraceId } from "../logging/index.ts";
import { logCurl, isCurlEnabled } from "./curl.ts";
import {
  HEADER_AUTHORIZATION,
  BEARER_PREFIX,
  RETRYABLE_STATUS_CODES,
  HttpStatus,
} from "../shared/constants.ts";
import { ErrorCode } from "../errors/codes.ts";
import { APIError, CancelledError, NetworkError, RateLimitError, parseApiError } from "./errors.ts";
import { getLogger } from "../logging/index.ts";
import { getCurrentAbortSignal } from "../runtime/request-context.ts";

const log = getLogger(import.meta.url);

/**
 * Create retry delay calculator that respects Retry-After header with cap.
 */
function createRetryDelayCalculator(maxRetryAfterMs: number) {
  return ({ computedValue, retryAfter }: RetryObject): number => {
    // AC2: Prefer Retry-After over exponential backoff, but enforce maxRetryAfter cap
    if (retryAfter !== undefined) {
      if (retryAfter > maxRetryAfterMs) {
        // Retry-After exceeds cap — return 0 to signal got to stop retrying
        return 0;
      }
      return retryAfter;
    }
    return computedValue;
  };
}

/**
 * Parse Retry-After header to seconds.
 * Supports both delta-seconds and HTTP-date formats.
 */
function parseRetryAfterSeconds(headerValue: string | string[] | undefined): number | null {
  if (!headerValue) return null;
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!value) return null;

  const numeric = Number.parseInt(value, 10);
  if (!Number.isNaN(numeric) && numeric >= 0) {
    return numeric;
  }

  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) return null;

  const seconds = Math.ceil((dateMs - Date.now()) / 1000);
  return Math.max(seconds, 0);
}

/**
 * Create got hooks for request tracing and curl diagnostics.
 */
function createGotHooks() {
  const beforeRequest: BeforeRequestHook = (options) => {
    // Inject X-Request-ID header — reuse trace_id from AsyncLocalStorage context,
    // fallback to fresh ID if called outside trace context (e.g. startup health check)
    options.headers["X-Request-ID"] = getTraceId() || generateTraceId();
  };

  const afterResponse: AfterResponseHook = (response) => {
    // Curl output for successful responses
    if (isCurlEnabled()) {
      logCurl(response.request.options);
    }
    return response;
  };

  const beforeError: BeforeErrorHook = (error) => {
    // Curl diagnostics for failed requests (DNS, timeout, connection errors)
    if (isCurlEnabled() && error.request?.options) {
      logCurl(error.request.options);
    }
    return error;
  };

  const beforeRetry: BeforeRetryHook = (error: RequestError) => {
    const url = error.request?.options.url?.toString() ?? "unknown";
    const attempt = error.request?.retryCount ?? "?";
    log.warn("HTTP retry", { url, attempt: String(attempt), reason: error.message });
    // Curl diagnostics during retry loops
    if (isCurlEnabled() && error.request?.options) {
      logCurl(error.request.options);
      // Note: logCurl already sanitizes tokens via sanitizeCurl()
    }
  };

  return {
    beforeRequest: [beforeRequest],
    afterResponse: [afterResponse],
    beforeError: [beforeError],
    beforeRetry: [beforeRetry],
  };
}

/** Raw HTTP response (binary body + headers). Used for file evaluation and binary API responses. */
export interface RawResponse {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
}

/**
 * HTTP Transport with got retry, Retry-After handling, and error classification.
 *
 * Pattern: Lazy-init got instances (client = auth, publicClient = no auth).
 * Retry config: exponential backoff + jitter, respects Retry-After header.
 * Hooks: beforeRequest (X-Request-ID), afterResponse/beforeError/beforeRetry (curl).
 *
 * Three request methods:
 * - request<T>(): JSON response (most API calls)
 * - requestRaw(): Buffer + headers (evaluateFile — needs X-Corpus-Scores header)
 * - requestToFile(): Streaming to disk (download — files up to 10GB)
 */
export class HttpTransport {
  private _client: Got | null = null;
  private _publicClient: Got | null = null;

  /**
   * Get authenticated got client (lazy-init).
   * Use for endpoints requiring Authorization header.
   */
  private get client(): Got {
    this._client ??= this.createGotInstance(true);
    return this._client;
  }

  /**
   * Get public got client (lazy-init).
   * Use for endpoints NOT requiring Authorization (e.g., /token, /health).
   */
  private get publicClient(): Got {
    this._publicClient ??= this.createGotInstance(false);
    return this._publicClient;
  }

  /**
   * Create got instance with retry, timeout, and hooks.
   *
   * @param withAuth - If true, add Authorization header (requires token from credential store)
   */
  private createGotInstance(withAuth: boolean): Got {
    const settings = getSettings();
    const maxRetryAfterMs = settings.api.rate_limit_max_wait * 1000;

    const instance = got.extend({
      // Retry config
      retry: {
        limit: settings.api.retry_attempts,
        methods: ["GET", "POST", "PUT", "DELETE"], // POST added explicitly (got default: GET only)
        statusCodes: [...RETRYABLE_STATUS_CODES],
        backoffLimit: settings.api.retry_max * 1000, // Convert seconds to ms
        noise: 100, // Jitter in ms (prevents thundering herd)
        maxRetryAfter: maxRetryAfterMs, // Retry-After cap (RFC 7231)
        calculateDelay: createRetryDelayCalculator(maxRetryAfterMs),
      },

      // Timeout config (from settings)
      // Only connect is always on (detect unreachable hosts).
      // response/send disabled by default (0) — server controls limits.
      timeout: {
        connect: settings.api.connect_timeout * 1000,
        ...(settings.api.timeout > 0 && { response: settings.api.timeout * 1000 }),
        ...(settings.api.write_timeout > 0 && { send: settings.api.write_timeout * 1000 }),
      },

      // Hooks
      hooks: createGotHooks(),
    });

    if (withAuth) {
      // Inject Bearer header per-request via hook (reads token at request time,
      // so token refresh takes effect immediately without recreating the client)
      return instance.extend({
        hooks: {
          beforeRequest: [
            (options) => {
              const token = getAccessToken();
              if (token) {
                options.headers[HEADER_AUTHORIZATION] = `${BEARER_PREFIX} ${token}`;
              }
            },
          ],
        },
      });
    }

    return instance;
  }

  /**
   * Make HTTP request with error classification.
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param options - Got request options
   * @param publicFlag - If true, use publicClient (no auth). Default: false (auth client)
   * @returns Response body (JSON parsed by got)
   */
  async request<T>(
    method: Method,
    url: string,
    options: Partial<GotOptions> = {},
    publicFlag = false,
    signal?: AbortSignal,
    onUploadProgress?: (progress: Progress) => void
  ): Promise<T> {
    const gotInstance = publicFlag ? this.publicClient : this.client;

    try {
      const effectiveSignal = signal ?? getCurrentAbortSignal();
      const mergedOptions: GotOptions = {
        ...options,
        method,
        responseType: "json",
        ...(effectiveSignal ? { signal: effectiveSignal } : {}),
      } as GotOptions;

      const request = gotInstance(url, mergedOptions);
      // got's CancelableRequest has conflicting .on() overloads (PCancelable + RequestEvents);
      // narrow via type assertion to resolve the union.
      if (onUploadProgress)
        (request as { on(e: "uploadProgress", l: (p: Progress) => void): unknown }).on(
          "uploadProgress",
          onUploadProgress
        );
      const response = (await request) as Response<T>;

      return response.body;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  /**
   * Make HTTP request returning raw buffer + headers.
   *
   * Use for binary API responses where headers are needed (e.g., evaluateFile X-Corpus-Scores).
   * For large file downloads, use requestToFile() instead.
   */
  async requestRaw(
    method: Method,
    url: string,
    options: Partial<GotOptions> = {},
    publicFlag = false,
    signal?: AbortSignal
  ): Promise<RawResponse> {
    const gotInstance = publicFlag ? this.publicClient : this.client;

    try {
      const effectiveSignal = signal ?? getCurrentAbortSignal();
      const mergedOptions: GotOptions = {
        ...options,
        method,
        responseType: "buffer",
        ...(effectiveSignal ? { signal: effectiveSignal } : {}),
      } as GotOptions;

      const response = (await gotInstance(url, mergedOptions)) as Response<Buffer>;

      return {
        body: response.body,
        headers: response.headers,
        statusCode: response.statusCode,
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  /**
   * Stream HTTP response directly to file on disk.
   *
   * Use for large file downloads (up to 10GB for annotation jobs).
   * Uses got.stream() through the configured instance (retry, timeout, hooks, auth).
   *
   * @returns The output file path
   */
  async requestToFile(
    method: Method,
    url: string,
    outputPath: string,
    options: Partial<GotOptions> = {},
    publicFlag = false,
    signal?: AbortSignal,
    onDownloadProgress?: (progress: Progress) => void
  ): Promise<string> {
    const gotInstance = publicFlag ? this.publicClient : this.client;

    try {
      const effectiveSignal = signal ?? getCurrentAbortSignal();
      const stream = gotInstance.stream(url, {
        ...options,
        method,
        ...(effectiveSignal ? { signal: effectiveSignal } : {}),
      } as GotOptions & { isStream: true });

      if (onDownloadProgress) stream.on("downloadProgress", onDownloadProgress);

      const fileStream = createWriteStream(outputPath);
      await pipeline(stream, fileStream, ...(effectiveSignal ? [{ signal: effectiveSignal }] : []));

      return outputPath;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  /**
   * Classify HTTP errors into typed exceptions.
   *
   * Pattern: HTTPError (4xx/5xx) -> parseApiError (RFC 9457 + status-based).
   * RequestError (DNS/timeout/connection) -> NetworkError.
   */
  private handleError(error: unknown): Error {
    let errorType: "http" | "network" | "unknown" = "unknown";
    if (error instanceof HTTPError) errorType = "http";
    else if (error instanceof RequestError) errorType = "network";
    log.debug("Error classified", { error_type: errorType });

    if (error instanceof HTTPError) {
      // HTTP response errors (4xx/5xx)
      const statusCode = error.response.statusCode;
      const body: unknown = error.response.body;
      const retryAfterSeconds =
        statusCode === HttpStatus.RATE_LIMITED
          ? parseRetryAfterSeconds(error.response.headers["retry-after"])
          : null;

      // Parse body as ProblemDetail (RFC 9457) or fallback.
      // Buffer bodies come from requestRaw() (responseType: "buffer") — decode to JSON.
      let problemDetail: unknown = null;
      if (Buffer.isBuffer(body)) {
        try {
          problemDetail = JSON.parse(body.toString()) as unknown;
        } catch {
          /* not JSON */
        }
      } else if (typeof body === "string") {
        try {
          problemDetail = JSON.parse(body) as unknown;
        } catch {
          /* not JSON */
        }
      } else if (typeof body === "object" && body !== null) {
        problemDetail = body;
      }

      const parsedError = parseApiError(problemDetail, statusCode);
      if (parsedError instanceof RateLimitError) {
        return new RateLimitError(parsedError.message, retryAfterSeconds);
      }

      return parsedError;
    }

    if (error instanceof RequestError) {
      // Abort (Ctrl+C in REPL) — got throws RequestError with code ERR_ABORTED
      const code = error.code; // Node.js error code (ENOTFOUND, ETIMEDOUT, ERR_ABORTED, etc.)
      if (code === "ERR_ABORTED") {
        return new CancelledError();
      }
      // Network errors: DNS, timeout, connection refused
      const message = code ? `${error.message} (${code})` : error.message;
      return new NetworkError(message);
    }

    // Unknown error — wrap as generic APIError
    if (error instanceof Error) {
      return new APIError(error.message, ErrorCode.JOB_FAILED, null);
    }

    return new APIError("Unknown error", ErrorCode.JOB_FAILED, null);
  }

  /**
   * Reset auth client (close and discard).
   * Call after token refresh to force new Authorization header on next request.
   */
  resetAuthClient(): void {
    if (this._client) {
      // Got instances don't have explicit close() — just discard reference
      this._client = null;
    }
  }

  /**
   * Close both clients (cleanup).
   * Call on app shutdown.
   */
  close(): void {
    this._client = null;
    this._publicClient = null;
  }
}
