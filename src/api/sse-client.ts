// See API-481: SSE Client with Reconnection
// Uses eventsource-client (MIT, async iterators, custom fetch) for SSE parsing.
// Custom fetch wrapper handles Bearer auth, 401 refresh, 404/503 fallback.
//
// Reconnection: exponential backoff (1s, 2s, 4s) + jitter, max 3 retries.
// Heartbeat timeout: 30s AbortController detects silent disconnections.
// Last-Event-ID: sent on reconnect for server-side event replay.

import {
  createEventSource,
  type EventSourceClient,
  type EventSourceMessage,
  type FetchLikeInit,
} from "eventsource-client";

import { getAccessToken, isTokenExpired } from "../config/credentials.ts";
import { getLogger } from "../logging/index.ts";
import { getSettings } from "../config/settings.ts";
import { sleep } from "../runtime/async-utils.ts";
import {
  BEARER_PREFIX,
  CONTENT_TYPE_SSE,
  Endpoint,
  HEADER_ACCEPT,
  HEADER_AUTHORIZATION,
  HttpStatus,
  SSE_BACKOFF_JITTER_MS,
  SSE_BACKOFF_MAX_MS,
  SSE_HEARTBEAT_TIMEOUT,
  SSE_RETRY_ATTEMPTS,
  SSEEventType,
} from "../shared/constants.ts";
import { type SSEEvent, parseSSEEvent } from "./sse-models.ts";

const log = getLogger(import.meta.url);

// --- Backoff ---

/**
 * Calculate backoff delay with jitter.
 * Base delays: 1s, 2s, 4s (exponential). Jitter: 0-500ms.
 */
function backoffDelay(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), SSE_BACKOFF_MAX_MS);
  const jitter = Math.random() * SSE_BACKOFF_JITTER_MS;
  return base + jitter;
}

// --- SSE Client ---

/**
 * SSE client with automatic reconnection and token refresh.
 *
 * Features:
 * - Bearer auth via custom fetch wrapper
 * - Exponential backoff reconnection (1s, 2s, 4s)
 * - Heartbeat timeout detection (30s via AbortController)
 * - Last-Event-ID reconnection protocol
 * - Proactive token refresh before connect + reactive refresh on 401
 */
export class SSEClient {
  private readonly baseUrl: string;
  private readonly tryRefresh: () => Promise<boolean>;
  private lastEventId = "";
  private reconnectionDelay = 0;

  constructor(baseUrl: string, tryRefresh: () => Promise<boolean>) {
    this.baseUrl = baseUrl;
    this.tryRefresh = tryRefresh;
  }

  /**
   * Stream SSE events for a job with automatic reconnection.
   *
   * @param jobId - Job ID to track
   * @param onEvent - Callback for connected/progress events
   * @param signal - External abort signal (e.g. Ctrl+C) for immediate cancellation
   * @returns Terminal event (complete/error/cancelled) or null for polling fallback
   */
  async streamJobEvents(
    jobId: string,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal
  ): Promise<SSEEvent | null> {
    const url = `${this.baseUrl}${Endpoint.JOB_SSE_EVENTS.replace("{job_id}", jobId)}`;

    for (let attempt = 0; attempt < SSE_RETRY_ATTEMPTS; attempt++) {
      // Fast-path: bail immediately if already aborted
      if (signal?.aborted) return null;

      log.debug("SSE connecting", { jobId, attempt: String(attempt) });

      // Apply server reconnection delay if set
      if (this.reconnectionDelay > 0) {
        await sleep(this.reconnectionDelay, signal).catch(() => {});
        this.reconnectionDelay = 0;
        if (signal?.aborted) return null;
      }

      try {
        const result = await this.connectOnce(url, onEvent, signal);
        if (result !== undefined) {
          return result;
        }
        // undefined = stream ended without terminal event, retry
      } catch {
        // All errors are retryable (404/503 fallback handled inside connectOnce via shouldFallback)
        log.debug("SSE error, retrying", { jobId, attempt: String(attempt) });
        await sleep(backoffDelay(attempt), signal).catch(() => {});
        continue;
      }
    }

    // All retries exhausted
    log.debug("SSE retries exhausted", { jobId });
    return null;
  }

  /**
   * Connect to SSE stream once and process events.
   *
   * Uses AbortController for heartbeat timeout: if no message arrives within
   * SSE_HEARTBEAT_TIMEOUT seconds, the connection is aborted and the method
   * resolves with undefined (triggering retry in the outer loop).
   *
   * @param signal - External abort signal for immediate cancellation
   * @returns SSEEvent for terminal events, null for fallback, undefined for retry
   */
  private connectOnce(
    url: string,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal
  ): Promise<SSEEvent | null | undefined> {
    return new Promise<SSEEvent | null | undefined>((resolve) => {
      let settled = false;
      let client: EventSourceClient | null = null;

      // Heartbeat: abort if no message within timeout
      const heartbeatMs = SSE_HEARTBEAT_TIMEOUT * 1000;
      let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

      const resetHeartbeat = () => {
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        heartbeatTimer = setTimeout(() => {
          log.debug("SSE heartbeat timeout");
          settle();
        }, heartbeatMs);
      };

      const settle = (value?: SSEEvent | null) => {
        if (settled) return;
        settled = true;
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        client?.close();
        resolve(value);
      };

      // External abort: settle immediately on Ctrl+C
      if (signal) {
        if (signal.aborted) {
          resolve(null);
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            settle(null);
          },
          { once: true }
        );
      }

      // Track whether we should fallback (set by custom fetch on 404/503)
      let shouldFallback = false;

      // Custom fetch: Bearer auth, 401 refresh, 404/503 detection
      const sseAuthFetch = async (
        fetchUrl: string | URL,
        init?: FetchLikeInit
      ): Promise<Response> => {
        // Proactive: refresh expired token before connecting
        if (isTokenExpired()) {
          await this.tryRefresh();
        }

        const settings = getSettings();
        const headers: Record<string, string> = {
          [HEADER_ACCEPT]: CONTENT_TYPE_SSE,
          [HEADER_AUTHORIZATION]: `${BEARER_PREFIX} ${getAccessToken()}`,
          ...init?.headers,
        };

        const controller = new AbortController();
        const connectTimeout = globalThis.setTimeout(() => {
          controller.abort();
        }, settings.api.connect_timeout * 1000);

        // Compose: external signal + connect timeout + library's init.signal
        const signals = [controller.signal];
        if (signal) signals.push(signal);
        if (init?.signal) signals.push(init.signal as AbortSignal);
        const composedSignal = AbortSignal.any(signals);

        try {
          const response = await fetch(fetchUrl, {
            ...init,
            headers,
            signal: composedSignal,
          });

          clearTimeout(connectTimeout);

          const sc = response.status;

          // 404/503: SSE not available, signal polling fallback
          if (sc === HttpStatus.NOT_FOUND || sc === HttpStatus.SERVICE_UNAVAILABLE) {
            shouldFallback = true;
            return response;
          }

          // 401: reactive token refresh
          if (sc === HttpStatus.UNAUTHORIZED) {
            const refreshed = await this.tryRefresh();
            if (!refreshed) {
              shouldFallback = true;
              return response;
            }
            // Retry with fresh token
            return await fetch(fetchUrl, {
              ...init,
              headers: {
                ...headers,
                [HEADER_AUTHORIZATION]: `${BEARER_PREFIX} ${getAccessToken()}`,
              },
              signal: composedSignal,
            });
          }

          return response;
        } catch (error) {
          clearTimeout(connectTimeout);
          throw error;
        }
      };

      client = createEventSource({
        url,
        fetch: sseAuthFetch,
        initialLastEventId: this.lastEventId || undefined,
        headers: {}, // Headers managed by custom fetch
        onMessage: (msg: EventSourceMessage) => {
          if (settled) return;
          resetHeartbeat();

          const result = this.dispatchEvent(msg, onEvent);
          if (result !== undefined) {
            settle(result);
          }
        },
        onScheduleReconnect: ({ delay }) => {
          // Honor server retry: directive in our external retry loop
          this.reconnectionDelay = delay;
          // Prevent library's internal reconnect — we manage retries ourselves
          client?.close();
        },
        onDisconnect: () => {
          if (settled) return;
          if (shouldFallback) {
            settle(null);
          } else {
            // Stream ended without terminal event — retry
            settle();
          }
        },
      });

      // Start heartbeat timer
      resetHeartbeat();
    });
  }

  /**
   * Dispatch a parsed SSE event to callback or return terminal event.
   *
   * @returns SSEEvent for terminal, null for fallback, undefined to continue
   */
  private dispatchEvent(
    msg: EventSourceMessage,
    onEvent: (event: SSEEvent) => void
  ): SSEEvent | null | undefined {
    // Track Last-Event-ID for reconnection
    if (msg.id) {
      this.lastEventId = msg.id;
    }

    const eventType = msg.event ?? "";

    // Skip ping/heartbeat and empty data
    if (eventType === SSEEventType.PING || !msg.data) {
      log.debug("SSE ping/heartbeat");
      return undefined;
    }

    let data: unknown;
    try {
      data = JSON.parse(msg.data);
    } catch {
      log.debug("SSE malformed JSON", { event: eventType, data: msg.data });
      return undefined;
    }

    const event = parseSSEEvent(eventType, data);
    if (event === null) {
      log.debug("SSE parse failed", { event: eventType, data: msg.data });
      return undefined;
    }

    // Terminal events: complete, error, cancelled
    if (
      eventType === SSEEventType.COMPLETE ||
      eventType === SSEEventType.ERROR ||
      eventType === SSEEventType.CANCELLED
    ) {
      log.debug("SSE terminal", { event: eventType });
      return event;
    }

    // Connected/Progress events: dispatch to callback
    log.debug("SSE event", { event: eventType, data: msg.data });
    onEvent(event);
    return undefined;
  }
}
