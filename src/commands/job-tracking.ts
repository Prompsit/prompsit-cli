// See API-482: Job Tracking Module (Strategy Pattern)
//
// Strategy pattern: JobTracker interface -> SSETracker (real-time) / PollingTracker (fallback)
// Facade: trackJob() hides strategy selection. SSE-first with transparent polling fallback.
// Display: delegated to ProgressSink (createProgressSink auto-detects CLI/REPL).

import { SSEClient } from "../api/sse-client.ts";
import type { SSEEvent } from "../api/sse-models.ts";
import { CancelledError, JobError, RateLimitError } from "../errors/contracts.ts";
import type { JobStatusResponse } from "../api/models.ts";
import type { APIClient } from "../api/client.ts";
import { t } from "../i18n/index.ts";
import { terminal } from "../output/terminal.ts";
import { createProgressSink } from "../output/progress-display.ts";
import {
  DEFAULT_POLL_INTERVAL,
  Endpoint,
  JobStatus,
  MAX_POLL_INTERVAL,
} from "../shared/constants.ts";
import { getCurrentAbortSignal } from "../runtime/request-context.ts";
import { getLogger } from "../logging/index.ts";
import { ProgressAnimator } from "./progress-animator.ts";
import { getSettings } from "../config/index.ts";
import { sleep } from "../runtime/async-utils.ts";

const log = getLogger(import.meta.url);

// --- Types ---

/** Terminal result from job tracking. */
export interface JobResult {
  readonly success: boolean;
  readonly kind: "success" | "failed" | "cancelled";
  readonly resultUrl?: string;
  readonly error?: string;
}

import type { OnProgress } from "./progress-animator.ts";
export type { OnProgress } from "./progress-animator.ts";

/** Strategy interface for job tracking implementations. */
export interface JobTracker {
  track(jobId: string, onProgress: OnProgress, signal?: AbortSignal): Promise<JobResult | null>;
}

// --- SSETracker ---

/**
 * Track job via SSE streaming (real-time updates).
 * Returns null if SSE is unavailable (signals fallback to polling).
 */
export class SSETracker implements JobTracker {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  async track(
    jobId: string,
    onProgress: OnProgress,
    signal?: AbortSignal
  ): Promise<JobResult | null> {
    const sseClient = new SSEClient(this.client.baseUrl, () => this.client.session.tryRefresh());

    const onEvent = (event: SSEEvent): void => {
      // Connected and Progress events have percentage/step
      if ("percentage" in event) {
        onProgress(event.percentage, event.step ?? null);
      }
    };

    let result: SSEEvent | null;
    try {
      result = await sseClient.streamJobEvents(jobId, onEvent, signal);
    } catch (error: unknown) {
      if (error instanceof RateLimitError) {
        return null; // Fallback to polling
      }
      throw error;
    }

    if (result === null) {
      return null; // SSE unavailable, fallback
    }

    // Map terminal events to JobResult
    if ("result_url" in result) {
      return { success: true, kind: "success", resultUrl: result.result_url };
    }
    if ("error_message" in result) {
      return { success: false, kind: "failed", error: result.error_message || "Unknown error" };
    }
    // Cancelled event
    return { success: false, kind: "cancelled", error: t("job_tracking.cancelled") };
  }
}

// --- PollingTracker ---

/**
 * Track job via HTTP polling with exponential backoff.
 * Falls back when SSE is unavailable.
 */
export class PollingTracker implements JobTracker {
  private readonly client: APIClient;
  private readonly pollInterval: number;

  constructor(client: APIClient, pollInterval: number = DEFAULT_POLL_INTERVAL) {
    this.client = client;
    this.pollInterval = pollInterval;
  }

  async track(
    jobId: string,
    onProgress: OnProgress,
    signal?: AbortSignal
  ): Promise<JobResult | null> {
    let interval = this.pollInterval;
    const jobUrl = `${this.client.baseUrl}${Endpoint.JOB.replace("{job_id}", jobId)}`;

    for (;;) {
      if (signal?.aborted) return null;

      let jobStatus: JobStatusResponse;
      try {
        jobStatus = await this.client.session.request<JobStatusResponse>("GET", jobUrl);
      } catch (error: unknown) {
        if (error instanceof RateLimitError) {
          const wait = error.retryAfter ?? interval * 2;
          await sleep(wait * 1000, signal).catch(() => {});
          interval = Math.min(interval * 2, MAX_POLL_INTERVAL);
          if (signal?.aborted) return null;
          continue;
        }
        throw error;
      }

      log.debug("Polling status", {
        jobId,
        status: jobStatus.status,
        percentage: String(jobStatus.progress_percentage),
        step: jobStatus.current_step ?? "",
      });
      onProgress(jobStatus.progress_percentage, jobStatus.current_step);

      // Terminal states
      if (jobStatus.status === JobStatus.COMPLETED) {
        return { success: true, kind: "success", resultUrl: jobStatus.result_url ?? undefined };
      }
      if (jobStatus.status === JobStatus.FAILED) {
        return {
          success: false,
          kind: "failed",
          error: jobStatus.error_message ?? "Unknown error",
        };
      }
      if (jobStatus.status === JobStatus.CANCELLED) {
        return { success: false, kind: "cancelled", error: t("job_tracking.cancelled") };
      }
      if (jobStatus.status === JobStatus.DLQ) {
        return { success: false, kind: "failed", error: t("job_tracking.dlq") };
      }
      // Fail-safe: unknown status → treat as failure (don't loop forever)
      if (
        jobStatus.status !== JobStatus.PENDING &&
        jobStatus.status !== JobStatus.RUNNING &&
        jobStatus.status !== JobStatus.PROCESSING
      ) {
        return {
          success: false,
          kind: "failed",
          error: t("job_tracking.unknown_status", { status: jobStatus.status }),
        };
      }

      await sleep(interval * 1000, signal).catch(() => {});
      if (signal?.aborted) return null;
      interval = Math.min(interval * 2, MAX_POLL_INTERVAL);
    }
  }
}

// --- Facade ---

/** Options for trackJob() facade. */
export interface TrackJobOptions {
  /** Base description text for progress display. */
  description?: string;
  /** Tracking strategy: auto (SSE with fallback), sse-only, or polling-only. */
  strategy?: "auto" | "sse" | "polling";
  /** Initial polling interval in seconds (default: 5). */
  pollInterval?: number;
  /** External abort signal (falls back to AsyncLocalStorage context if not provided). */
  signal?: AbortSignal;
  /** Suppress progress display (for parallel mode where caller manages aggregate display). */
  silent?: boolean;
  /** External progress callback (for aggregate display in parallel mode). */
  onProgress?: OnProgress;
  /** Job timeout in seconds (0 = disabled). Default: from config cli.job_timeout. */
  timeout?: number;
}

/**
 * Track job with SSE-first, polling fallback. Manages progress display via ProgressSink.
 *
 * @param client - API client instance
 * @param jobId - Job ID to track
 * @param options - Tracking configuration
 * @returns Server-provided result URL (HATEOAS) for downloading the result
 * @throws JobError if job failed or was cancelled
 * @throws CancelledError if aborted via AbortSignal (Ctrl+C)
 */
export async function trackJob(
  client: APIClient,
  jobId: string,
  options: TrackJobOptions = {}
): Promise<string> {
  const {
    description = "Processing",
    strategy = getSettings().cli.job_tracking_strategy,
    pollInterval = DEFAULT_POLL_INTERVAL,
    signal: externalSignal,
    silent = false,
    onProgress: externalOnProgress,
    timeout = getSettings().cli.job_timeout,
  } = options;

  // Signal: Ctrl+C (explicit > AsyncLocalStorage) + job timeout (if enabled)
  const ctrlCSignal = externalSignal ?? getCurrentAbortSignal();
  const signals: AbortSignal[] = [];
  if (ctrlCSignal) signals.push(ctrlCSignal);
  if (timeout > 0) signals.push(AbortSignal.timeout(timeout * 1000));
  const signal = signals.length > 0 ? AbortSignal.any(signals) : undefined;

  // Progress display: silent mode skips (batch processor owns aggregate display)
  const sink = silent ? null : createProgressSink(description);

  log.debug("trackJob start", { jobId, strategy, hasSink: String(sink !== null) });

  // Downstream display callback (ProgressSink or external callback)
  const downstream: OnProgress = (percentage, step) => {
    const stepText = step ? ` (${step})` : "";
    sink?.update(percentage, `${description}${stepText}`);
    externalOnProgress?.(percentage, step);
  };

  // Trickle animator: smooth interpolation between sparse API updates
  const animator = new ProgressAnimator(downstream);

  const onProgress: OnProgress = (percentage, step) => {
    log.debug("Progress update", { jobId, percentage: String(percentage), step: step ?? "" });
    animator.setTarget(percentage, step);
  };

  let result: JobResult | null = null;

  try {
    // Strategy dispatch
    if (strategy === "sse") {
      result = await new SSETracker(client).track(jobId, onProgress, signal);
      if (signal?.aborted) {
        throw new CancelledError();
      }
      if (result === null) {
        throw new JobError(t("job_tracking.sse_unavailable"));
      }
    } else if (strategy === "auto") {
      result = await new SSETracker(client).track(jobId, onProgress, signal);
      if (signal?.aborted) {
        throw new CancelledError();
      }
      if (result === null) {
        log.debug("SSE fallback to polling", { jobId });
        terminal.dim(t("job_tracking.sse_unavailable"));
      }
    }

    if (strategy === "polling" || result === null) {
      result = await new PollingTracker(client, pollInterval).track(jobId, onProgress, signal);
    }

    // User cancel (Ctrl+C): catch block handles cleanup + server cancel
    if (signal?.aborted || result === null) {
      throw new CancelledError();
    }

    log.debug("trackJob complete", { jobId, success: String(result.success) });

    // Handle terminal result
    if (result.success) {
      animator.complete();
      sink?.succeed("Complete");
      if (!result.resultUrl) {
        throw new JobError("Server did not provide result_url (HATEOAS contract violated)");
      }
      return result.resultUrl;
    }
    animator.stop();
    sink?.fail();
    throw new JobError(result.error ?? "Unknown error");
  } catch (error: unknown) {
    // Cleanup animator + sink on any error (including SIGINT / KeyboardInterrupt)
    animator.stop();
    sink?.stop();
    // Best-effort cancel on server (fire-and-forget, don't block shutdown)
    client.jobs.cancel(jobId).catch(() => {});
    // Timeout: convert CancelledError → JobError (Ctrl+C passes through unchanged)
    if (
      error instanceof CancelledError &&
      signal?.reason instanceof Error &&
      signal.reason.name === "TimeoutError"
    ) {
      throw new JobError(t("job_tracking.timeout", { seconds: String(timeout) }));
    }
    throw error;
  }
}
