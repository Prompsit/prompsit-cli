// Shared document job pipeline for score / annotate / translate.
//
// All three commands run the same 3-phase flow with the same progress bands:
//   Phase 1 Upload   →   0-5%   (varies per command: the actual upload call + warmup-retry policy)
//   Phase 2 Track    →   5-95%  (identical)
//   Phase 3 Download →   95-100% (identical)
//
// Only Phase 1 varies, so the caller supplies it as an `upload` closure; the pipeline owns
// the track/download phases and the progress-band math (single source of truth).

import type { APIClient } from "../api/client.ts";
import { trackJob } from "./job-tracking.ts";

export interface JobPipelineParams {
  client: APIClient;
  /**
   * Performs Phase 1 (upload) and returns the created job. Receives an upload-progress
   * reporter taking a 0..1 fraction, which the pipeline maps onto the 0-5% band.
   */
  upload: (reportUpload: (fraction: number) => void) => Promise<{ job_id: string }>;
  /** Progress/label description (typically the source file basename). */
  description: string;
  /** Local path to write the downloaded result to. */
  outputPath: string;
  /** Abort signal (Ctrl+C / job timeout). */
  signal?: AbortSignal;
  /** Aggregate progress callback (0-100) for the owning batch/display. */
  onProgress: (percent: number) => void;
}

/**
 * Run the standard upload → track → download job pipeline and return the written output path.
 *
 * @returns The local path of the downloaded result (from `client.jobs.download`).
 */
export async function runJobPipeline(params: JobPipelineParams): Promise<string> {
  const { client, upload, description, outputPath, signal, onProgress } = params;

  // Phase 1: Upload (0-5%)
  const resp = await upload((fraction) => {
    onProgress(Math.round(fraction * 5));
  });

  // Phase 2: Server processing (5-95%)
  const resultUrl = await trackJob(client, resp.job_id, {
    description,
    silent: true,
    signal,
    onProgress: (pct) => {
      onProgress(5 + Math.round(pct * 0.9));
    },
  });

  // Phase 3: Download (95-100%)
  return client.jobs.download(resultUrl, outputPath, signal, (p) => {
    onProgress(95 + Math.round(p.percent * 5));
  });
}
