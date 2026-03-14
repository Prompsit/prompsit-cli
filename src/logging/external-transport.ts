import { getLogger } from "./index.ts";
import { toErrorMessage } from "../errors/contracts.ts";

const log = getLogger(import.meta.url);

export interface ExternalTransportOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  jitterMs?: number;
  retryOnStatuses?: number[];
}

const DEFAULT_RETRY_STATUSES = [408, 413, 429, 500, 502, 503, 504];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number, allowed: number[]): boolean {
  return allowed.includes(status);
}

function toJsonBody(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined;
  return JSON.stringify(body);
}

async function sendRequest(url: string, opts: ExternalTransportOptions): Promise<Response> {
  const { method = "GET", headers = {}, body, timeoutMs = 3000 } = opts;

  const requestHeaders: Record<string, string> = { ...headers };
  const payload = toJsonBody(body);
  if (payload !== undefined && !("Content-Type" in requestHeaders)) {
    requestHeaders["Content-Type"] = "application/json";
  }

  return fetch(url, {
    method,
    headers: requestHeaders,
    body: payload,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function requestJsonOrNull<T>(
  url: string,
  opts: ExternalTransportOptions = {}
): Promise<T | null> {
  const {
    retries = 0,
    retryDelayMs = 250,
    jitterMs = 75,
    retryOnStatuses = DEFAULT_RETRY_STATUSES,
  } = opts;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await sendRequest(url, opts);
      if (!response.ok) {
        if (attempt < retries && shouldRetryStatus(response.status, retryOnStatuses)) {
          const jitter = Math.floor(Math.random() * jitterMs);
          await sleep(retryDelayMs * (attempt + 1) + jitter);
          continue;
        }
        log.debug("HTTP request failed", { url, status: String(response.status) });
        return null;
      }

      return (await response.json()) as T;
    } catch (error: unknown) {
      if (attempt >= retries) {
        log.debug("HTTP request error", {
          url,
          error: toErrorMessage(error),
        });
        return null;
      }
      const jitter = Math.floor(Math.random() * jitterMs);
      await sleep(retryDelayMs * (attempt + 1) + jitter);
    }
  }

  return null;
}
