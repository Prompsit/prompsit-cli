import { describe, expect, it, vi } from "vitest";
import { JobsResource } from "../../src/api/resources/jobs.ts";

describe("JobsResource.status", () => {
  it("owns signal propagation and response validation", async () => {
    const signal = new AbortController().signal;
    const request = vi.fn().mockResolvedValue({ status: "invalid", progress_percentage: 0 });
    const jobs = new JobsResource({ request } as any, "https://api.example");

    await expect(jobs.status("job-1", signal)).rejects.toThrow();
    expect(request).toHaveBeenCalledWith("GET", "https://api.example/v1/jobs/job-1", {}, signal);
  });
});
