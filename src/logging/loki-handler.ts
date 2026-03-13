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
  private _inFlight = 0;
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
    if (this._inFlight >= this.maxInFlight) return;
    this._inFlight++;

    // Fire-and-forget: never await, never throw
    requestJsonOrNull(this.pushUrl, {
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
        this._inFlight--;
      });
  }
}
