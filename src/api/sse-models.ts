// See API-478: SSE Event Models (Zod Schemas)
// Schema-first design: Zod schemas define runtime validation + TypeScript types.
//
// Pattern: z.object() (lenient) because server may add fields.
// Discriminated parse: SSEEventType string selects correct schema at runtime.

import { z } from "zod";

import { JobStatus, SSEEventType } from "../shared/constants.ts";

// --- SSE Event Schemas ---

/**
 * Initial connection event with current job state.
 * Sent once when SSE stream opens.
 */
export const SSEConnectedEventSchema = z.object({
  job_id: z.string(),
  status: z.string(),
  percentage: z.int().min(0).max(100).default(0),
  step: z.string().nullable().optional(),
});

/**
 * Progress update event during job execution.
 * Sent periodically as job progresses.
 */
export const SSEProgressEventSchema = z.object({
  percentage: z.int().min(0).max(100),
  step: z.string().nullable().optional(),
  status: z.string().default(JobStatus.RUNNING),
});

/**
 * Job completed successfully.
 * Sent once when job finishes with results.
 */
export const SSECompleteEventSchema = z.object({
  status: z.string().default(JobStatus.COMPLETED),
  result_url: z.string().min(1),
});

/**
 * Job failed with an error.
 * Sent once on unrecoverable failure.
 */
export const SSEErrorEventSchema = z.object({
  status: z.string().default(JobStatus.FAILED),
  error_message: z
    .string()
    .nullish()
    .transform((v) => v ?? "Unknown error"),
});

/**
 * Job was cancelled by user or system.
 * Sent once on cancellation.
 */
export const SSECancelledEventSchema = z.object({
  status: z.string().default(JobStatus.CANCELLED),
});

// --- Inferred TypeScript types (single source of truth) ---

export type SSEConnectedEvent = z.infer<typeof SSEConnectedEventSchema>;
export type SSEProgressEvent = z.infer<typeof SSEProgressEventSchema>;
export type SSECompleteEvent = z.infer<typeof SSECompleteEventSchema>;
export type SSEErrorEvent = z.infer<typeof SSEErrorEventSchema>;
export type SSECancelledEvent = z.infer<typeof SSECancelledEventSchema>;

/** Union of all SSE event types for type-safe handling. */
export type SSEEvent =
  | SSEConnectedEvent
  | SSEProgressEvent
  | SSECompleteEvent
  | SSEErrorEvent
  | SSECancelledEvent;

// --- Schema lookup by event type ---

const EVENT_SCHEMA_MAP: Partial<Record<string, z.ZodType>> = {
  [SSEEventType.CONNECTED]: SSEConnectedEventSchema,
  [SSEEventType.PROGRESS]: SSEProgressEventSchema,
  [SSEEventType.COMPLETE]: SSECompleteEventSchema,
  [SSEEventType.ERROR]: SSEErrorEventSchema,
  [SSEEventType.CANCELLED]: SSECancelledEventSchema,
};

/**
 * Parse an SSE event payload using the appropriate schema for the event type.
 *
 * @param eventType - SSE event type string (e.g. "progress", "complete")
 * @param data - Raw event data (parsed JSON)
 * @returns Validated SSE event or null if unknown type / validation failure
 */
export function parseSSEEvent(eventType: string, data: unknown): SSEEvent | null {
  const schema = EVENT_SCHEMA_MAP[eventType];
  if (!schema) {
    return null;
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    return null;
  }

  return result.data as SSEEvent;
}
