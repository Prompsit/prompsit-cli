import { beforeEach, describe, expect, it, vi } from "vitest";
import { CancelledError, JobError } from "../../src/errors/contracts.ts";

// --- Module mocks (hoist-safe) ---

vi.mock("ora", () => {
  const instance = {
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    text: "",
    isSpinning: false,
  };
  return { default: vi.fn(() => instance) };
});

vi.mock("../../src/commands/progress-animator.ts", () => ({
  ProgressAnimator: class {
    setTarget = vi.fn();
    stop = vi.fn();
    complete = vi.fn();
  },
}));

vi.mock("../../src/api/sse-client.ts", () => ({
  SSEClient: vi.fn(),
}));

vi.mock("../../src/config/index.ts", () => ({
  getSettings: () => ({
    cli: { job_tracking_strategy: "polling", file_concurrency: 2, job_timeout: 0 },
  }),
}));

vi.mock("../../src/runtime/progress-context.ts", () => ({
  getProgressContext: () => null,
}));

vi.mock("../../src/runtime/request-context.ts", () => ({
  getCurrentAbortSignal: (): undefined => {},
}));

vi.mock("../../src/logging/index.ts", () => ({
  getLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../src/i18n/index.ts", () => ({
  t: (key: string) => key,
}));

vi.mock("../../src/output/terminal.ts", () => ({
  terminal: { dim: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../src/runtime/async-utils.ts", () => ({
  sleep: vi.fn().mockResolvedValue(),
}));

import { trackJob } from "../../src/commands/job-tracking.ts";

describe("trackJob abort propagation (P1 regression)", () => {
  let cancelMock: ReturnType<typeof vi.fn>;
  let downloadMock: ReturnType<typeof vi.fn>;
  let client: { baseUrl: string; session: unknown; jobs: unknown };

  beforeEach(() => {
    vi.clearAllMocks();
    cancelMock = vi.fn().mockResolvedValue();
    downloadMock = vi.fn().mockResolvedValue("/tmp/result.txt");
    client = {
      baseUrl: "http://localhost:8080",
      session: { tryRefresh: vi.fn(), request: vi.fn() },
      jobs: { cancel: cancelMock, download: downloadMock },
    };
  });

  it("throws CancelledError when signal is aborted and does not allow download", async () => {
    const controller = new AbortController();
    controller.abort();

    // trackJob must reject — preventing any subsequent download call
    await expect(
      trackJob(client as any, "job-abort-test", {
        strategy: "polling",
        signal: controller.signal,
      })
    ).rejects.toThrow(CancelledError);

    // Best-effort server cancel should fire (catch block cleanup)
    expect(cancelMock).toHaveBeenCalledWith("job-abort-test");

    // Proves the P1 fix: if trackJob throws, caller cannot reach download
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("throws JobError when job status is 'dlq' (dead-letter queue)", async () => {
    (client.session as any).request = vi.fn().mockResolvedValue({
      status: "dlq",
      progress_percentage: 80,
      current_step: null,
      error_message: null,
      result_url: null,
    });

    await expect(
      trackJob(client as any, "job-dlq-test", { strategy: "polling" })
    ).rejects.toThrow(JobError);

    expect(cancelMock).toHaveBeenCalledWith("job-dlq-test");
  });

  it("throws JobError on unknown status (fail-safe)", async () => {
    (client.session as any).request = vi.fn().mockResolvedValue({
      status: "some_future_status",
      progress_percentage: 0,
      current_step: null,
      error_message: null,
      result_url: null,
    });

    await expect(
      trackJob(client as any, "job-unknown-test", { strategy: "polling" })
    ).rejects.toThrow(JobError);

    expect(cancelMock).toHaveBeenCalledWith("job-unknown-test");
  });

  it("throws JobError (not CancelledError) on job timeout", async () => {
    // Simulate an already-fired timeout signal (avoids OOM from busy-loop with mocked sleep)
    const controller = new AbortController();
    controller.abort(new DOMException("signal timed out", "TimeoutError"));

    await expect(
      trackJob(client as any, "job-timeout-test", {
        strategy: "polling",
        signal: controller.signal,
        timeout: 0, // disable internal AbortSignal.timeout — we provide the pre-aborted signal
      })
    ).rejects.toThrow(JobError);

    expect(cancelMock).toHaveBeenCalledWith("job-timeout-test");
  });
});
