/**
 * Lightweight Loki push handler for remote error telemetry.
 *
 * Node.js idiomatic approach: fire-and-forget fetch() calls.
 * No threads, no queues — async fetch with AbortSignal.timeout().
 * All errors are silently suppressed (telemetry must never break CLI).
 *
 * Loki push format: https://grafana.com/docs/loki/latest/reference/loki-http-api/#push-log-entries-to-loki
 */

import { createRequire } from "node:module";
import * as os from "node:os";
import { z } from "zod";
import { requestJsonOrNull } from "./external-transport.ts";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

const LokiPushValueSchema = z.tuple([z.string(), z.string(), z.record(z.string(), z.string())]);
const LokiPushBodySchema = z.object({
  streams: z.array(
    z.object({
      stream: z.record(z.string(), z.string()),
      values: z.array(LokiPushValueSchema).min(1),
    })
  ),
});

export class LokiHandler {
  private readonly pushUrl: string;
  private readonly lokiKey: string;
  private readonly labels: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly inFlight = new Set<Promise<unknown>>();
  private readonly maxInFlight = 10;

  constructor(
    lokiUrl: string,
    lokiKey: string,
    labels: Record<string, string> = {},
    timeoutMs = 3000
  ) {
    this.pushUrl = lokiUrl.replace(/\/{1,100}$/, "") + "/loki/api/v1/push";
    this.lokiKey = lokiKey;
    this.labels = {
      service: "prompsit-cli",
      os: os.platform(),
      ...labels,
    };
    this.timeoutMs = timeoutMs;
  }

  /**
   * Push a log entry to Loki (fire-and-forget).
   *
   * Never throws, never blocks. Network errors are silently dropped.
   *
   * @param level - Log level (warn, error)
   * @param message - Log message
   * @param metadata - Structured metadata (trace_id, error_type, etc.)
   */
  emit(level: string, message: string, metadata: Record<string, string> = {}): void {
    const timestampNs = `${Date.now()}000000`;

    const enrichedMeta: Record<string, string> = {
      version,
      ...metadata,
    };

    const body = {
      streams: [
        {
          stream: { ...this.labels, level },
          values: [[timestampNs, message, enrichedMeta]],
        },
      ],
    };

    if (!LokiPushBodySchema.safeParse(body).success) {
      return;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.lokiKey) {
      headers["X-Telemetry-Key"] = this.lokiKey;
    }

    // Backpressure: drop entries when too many in-flight requests
    if (this.inFlight.size >= this.maxInFlight) return;

    // Fire-and-forget: never await, never throw. Tracked so flush() can drain on shutdown.
    const request = requestJsonOrNull(this.pushUrl, {
      method: "POST",
      headers,
      body,
      timeoutMs: this.timeoutMs,
      retries: 1,
      retryDelayMs: 150,
    })
      .catch(() => {
        // Telemetry is best-effort only.
      })
      .finally(() => {
        this.inFlight.delete(request);
      });
    this.inFlight.add(request);
  }

  /**
   * Await all in-flight pushes, bounded by timeoutMs. Best-effort; never throws.
   *
   * Used on forced shutdown (signal handlers) so the WARN/ERROR telemetry this handler
   * exists to capture is not dropped when the short-lived CLI process exits.
   */
  async flush(timeoutMs: number = this.timeoutMs): Promise<void> {
    if (this.inFlight.size === 0) return;
    const drained = Promise.allSettled(this.inFlight).then(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    const capped = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
      timer.unref();
    });
    try {
      await Promise.race([drained, capped]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
