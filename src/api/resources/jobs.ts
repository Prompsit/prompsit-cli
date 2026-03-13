// Jobs resource - status, cancel, download with Zod validation
// Used by translate file and data commands for job lifecycle.
// All methods go through AuthSession for auth, retry, hooks, and error classification.

import type { AuthSession } from "../auth-session.ts";
import { JobStatusResponseSchema, type JobStatusResponse } from "../models.ts";
import { Endpoint } from "../../shared/constants.ts";

/**
 * Jobs API resource.
 *
 * Provides status, cancel, and download operations.
 * Used by translate file and data commands for job lifecycle management.
 */
export class JobsResource {
  private readonly session: AuthSession;
  private readonly baseUrl: string;

  constructor(session: AuthSession, baseUrl: string) {
    this.session = session;
    this.baseUrl = baseUrl;
  }

  /**
   * Get detailed status of a specific job (used by PollingTracker).
   */
  async status(jobId: string): Promise<JobStatusResponse> {
    const baseUrl = this.baseUrl;
    const url = `${baseUrl}${Endpoint.JOB.replace("{job_id}", jobId)}`;

    const data = await this.session.request<unknown>("GET", url);

    return JobStatusResponseSchema.parse(data);
  }

  /**
   * Cancel a pending or running job (best-effort, fire-and-forget safe).
   */
  async cancel(jobId: string): Promise<void> {
    const baseUrl = this.baseUrl;
    const url = `${baseUrl}${Endpoint.JOB.replace("{job_id}", jobId)}`;

    await this.session.request<unknown>("DELETE", url);
  }

  /**
   * Download job result to file via streaming (HATEOAS).
   *
   * Uses requestToFile() for memory-safe streaming (annotation jobs can be up to 10GB).
   * Client owns output filenames — no Content-Disposition parsing.
   *
   * @param resultUrl - Server-provided relative URL path (e.g. "/v1/jobs/{id}/result")
   * @param outputPath - Output file path (computed by resolveOutputPaths)
   * @param signal - Optional abort signal for cancellation
   * @returns The output path
   */
  async download(resultUrl: string, outputPath: string, signal?: AbortSignal): Promise<string> {
    const url = `${this.baseUrl}${resultUrl}`;

    return this.session.requestToFile("GET", url, outputPath, {}, signal);
  }
}
