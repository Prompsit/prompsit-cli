// Application-level warmup retry for ML engine cold starts.
//
// Two-tier retry strategy (Azure Retry Pattern):
// - Tier 1 (transport): got retries 3x with short backoff (~10s) for transient faults
// - Tier 2 (application): this module retries with longer backoff (~120s) for engine warmup
//
// Only ServerError (5xx) triggers warmup retry. Auth, validation, and network errors propagate immediately.

import { getSettings } from "../config/index.ts";
import { CancelledError, ServerError } from "../errors/contracts.ts";
import { getLogger } from "../logging/index.ts";
import { sleep } from "../runtime/async-utils.ts";

const log = getLogger(import.meta.url);

const INITIAL_DELAY_MS = 3000;
const MAX_DELAY_MS = 15_000;
const BACKOFF_FACTOR = 2;

interface WarmupRetryOptions {
  signal?: AbortSignal;
  /** Status callback for user feedback (e.g. terminal.dim). Keeps API layer free of presentation imports. */
  onStatus?: (message: string) => void;
}

/**
 * Wrap an async API call with warmup-aware retry.
 *
 * On first call success, returns immediately (zero overhead).
 * On ServerError (5xx), retries with exponential backoff until warmup_timeout.
 * Non-ServerError exceptions propagate immediately (no retry).
 */
export async function withWarmupRetry<T>(
  fn: () => Promise<T>,
  opts: WarmupRetryOptions = {}
): Promise<T> {
  const timeoutMs = getSettings().api.warmup_timeout * 1000;

  // warmup_timeout=0 disables warmup retry
  if (timeoutMs <= 0) return fn();

  try {
    return await fn();
  } catch (error) {
    if (!(error instanceof ServerError)) throw error;

    // Enter warmup retry loop
    const start = Date.now();
    let delay = INITIAL_DELAY_MS;
    let lastError: ServerError = error;
    let attempt = 0;

    opts.onStatus?.("Waiting for engine to start...");

    while (Date.now() - start + delay < timeoutMs) {
      attempt++;
      const elapsed = Math.round((Date.now() - start) / 1000);

      log.info("Warmup retry", {
        attempt: String(attempt),
        elapsed_s: String(elapsed),
        delay_ms: String(delay),
      });

      try {
        await sleep(delay, opts.signal);
      } catch {
        throw new CancelledError();
      }

      try {
        const result = await fn();
        log.info("Warmup retry succeeded", {
          attempt: String(attempt),
          total_elapsed_s: String(Math.round((Date.now() - start) / 1000)),
        });
        return result;
      } catch (retryError) {
        if (!(retryError instanceof ServerError)) throw retryError;
        lastError = retryError;

        const retryElapsed = Math.round((Date.now() - start) / 1000);
        opts.onStatus?.(`Engine not ready, retrying... (${String(retryElapsed)}s)`);
      }

      delay = Math.min(delay * BACKOFF_FACTOR, MAX_DELAY_MS);
    }

    // Timeout expired — log as error (Azure best practice) and rethrow
    log.error("Warmup timeout exceeded", lastError, {
      total_elapsed_s: String(Math.round((Date.now() - start) / 1000)),
      timeout_s: String(getSettings().api.warmup_timeout),
    });
    throw lastError;
  }
}
