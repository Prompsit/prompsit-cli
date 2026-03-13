// Port of tests/unit/test_sse.py — SSE event parsing verification
import { describe, it, expect } from "vitest";
import { parseSSEEvent } from "../../src/api/sse-models.ts";
import { SSEEventType, JobStatus } from "../../src/shared/constants.ts";

describe("parseSSEEvent", () => {
  it.each([
    {
      eventType: SSEEventType.CONNECTED,
      data: { job_id: "abc123", status: "running", percentage: 0 },
      checks: { job_id: "abc123", status: JobStatus.RUNNING, percentage: 0 },
    },
    {
      eventType: SSEEventType.PROGRESS,
      data: { percentage: 45, step: "translate", status: "running" },
      checks: { percentage: 45, step: "translate", status: JobStatus.RUNNING },
    },
    {
      eventType: SSEEventType.COMPLETE,
      data: { status: "completed", result_url: "/v1/jobs/abc123/result" },
      checks: { status: JobStatus.COMPLETED, result_url: "/v1/jobs/abc123/result" },
    },
    {
      eventType: SSEEventType.ERROR,
      data: { status: "failed", error_message: "Engine unavailable" },
      checks: { status: JobStatus.FAILED, error_message: "Engine unavailable" },
    },
    {
      eventType: SSEEventType.CANCELLED,
      data: { status: "cancelled" },
      checks: { status: JobStatus.CANCELLED },
    },
  ])("parses $eventType event", ({ eventType, data, checks }) => {
    const event = parseSSEEvent(eventType, data);
    expect(event).not.toBeNull();
    for (const [key, value] of Object.entries(checks)) {
      expect((event as any)[key]).toBe(value);
    }
  });

  it.each([
    { eventType: SSEEventType.PING, data: {} },
    { eventType: "unknown_event", data: { some: "data" } },
    { eventType: SSEEventType.PROGRESS, data: { bad: "shape" } },
  ])("returns null for $eventType with invalid/unknown data", ({ eventType, data }) => {
    expect(parseSSEEvent(eventType, data)).toBeNull();
  });
});
