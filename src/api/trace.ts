// See API-444: Trace ID generation for X-Request-ID header
// Provides correlation between CLI and API logs.
// Format: 8-char hex (matches prompsit-api RequestIDMiddleware validation).

import { randomUUID } from "node:crypto";

/**
 * Generate 8-char hex trace ID for X-Request-ID header.
 *
 * Uses crypto.randomUUID() (Node.js built-in, cryptographically secure).
 * Returns first 8 hex chars (32 bits of entropy).
 *
 * Example: "a3f5c8d2"
 */
export function generateTraceId(): string {
  return randomUUID().replaceAll("-", "").slice(0, 8);
}
