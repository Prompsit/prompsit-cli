// See API-444: Curl command output for API requests
// Shows API requests as curl commands for --debug flag and show_curl setting.
// Layer: Infrastructure. Output is injected via setCurlOutputFn() callback.

import type { Options as GotOptions } from "got";

// Module-level curl display state
let curlEnabled = false;

// Injectable output callback: (sanitized, raw) => void
// CLI mode displays sanitized only; REPL stores both for panel + clipboard.
let outputFn: ((sanitized: string, raw: string) => void) | null = null;

/**
 * Set the output function for curl display.
 * Callback receives sanitized curl (for display) and raw curl (for clipboard copy).
 */
export function setCurlOutputFn(fn: ((sanitized: string, raw: string) => void) | null): void {
  outputFn = fn;
}

/**
 * Check if curl display is enabled.
 */
export function isCurlEnabled(): boolean {
  return curlEnabled;
}

/**
 * Enable or disable curl display.
 */
export function setCurlEnabled(enabled: boolean): void {
  curlEnabled = enabled;
}

// Headers to skip in curl output (standard HTTP headers added by got/Node)
const SKIP_HEADERS = new Set([
  "host",
  "user-agent",
  "accept",
  "accept-encoding",
  "connection",
  "content-length",
  "transfer-encoding",
]);

/**
 * Convert got request options to a curl command string.
 *
 * Includes method, URL, headers (except SKIP_HEADERS), and body.
 * Pretty-formats JSON body for readability.
 */
export function buildCurl(options: GotOptions): string {
  const method = options.method;
  const url = typeof options.url === "string" ? options.url : (options.url?.toString() ?? "");

  const parts: string[] = [`curl -X ${method} '${url}'`];

  // Add headers (skip standard ones)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- got types say headers is defined, but runtime can be undefined
  const headers = options.headers ?? {};
  for (const [key, value] of Object.entries(headers)) {
    if (SKIP_HEADERS.has(key.toLowerCase())) {
      continue;
    }
    const headerValue = Array.isArray(value) ? value.join(", ") : (value ?? "");
    parts.push(`  -H '${key}: ${headerValue}'`);
  }

  // Add body
  if (options.json) {
    const body = JSON.stringify(options.json);
    parts.push(`  -d '${body}'`);
  } else if (options.form) {
    const formData = new URLSearchParams(options.form as Record<string, string>).toString();
    parts.push(`  -H 'Content-Type: application/x-www-form-urlencoded'`, `  -d '${formData}'`);
  } else if (options.body) {
    const body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    // Try to pretty-format JSON
    try {
      const parsed: unknown = JSON.parse(body);
      const formatted = JSON.stringify(parsed);
      parts.push(`  -d '${formatted}'`);
    } catch {
      parts.push(`  -d '${body}'`);
    }
  }

  return parts.join("\n");
}

/**
 * Remove sensitive data from curl string for display.
 *
 * - Replaces Bearer tokens with [token]
 * - Hides password/secret/refresh_token/access_token values
 */
export function sanitizeCurl(curl: string): string {
  // Replace Bearer tokens
  let result = curl.replaceAll(/(Bearer )\S+/g, "$1[token]");

  // Hide sensitive query params and form data
  result = result.replaceAll(
    /((?:refresh_token|password|access_token|secret)=)[^&'\s]{1,1000}/g,
    "$1[hidden]"
  );

  // Hide sensitive JSON body fields: "key": "value" or "key":"value"
  result = result.replaceAll(
    /("(?:password|secret|token|(?:access_|refresh_)token)":\s{0,100}")[^"]{0,10000}"/g,
    '$1[hidden]"'
  );

  return result;
}

/**
 * Log curl for got request (called from got hooks).
 *
 * Builds both raw and sanitized curl, passes both to outputFn.
 * Raw version contains real tokens (for clipboard), sanitized has [token] (for display).
 */
/** URL paths to exclude from curl output (internal/service requests). */
const SKIP_URLS = ["/v1/auth/token", "/v1/jobs/"];

export function logCurl(options: GotOptions): void {
  if (!curlEnabled || !outputFn) {
    return;
  }

  const url = typeof options.url === "string" ? options.url : (options.url?.toString() ?? "");
  if (SKIP_URLS.some((path) => url.includes(path))) return;

  // Skip file uploads — FormData body produces non-reproducible curl
  if (options.body instanceof FormData) return;

  const raw = buildCurl(options);
  const sanitized = sanitizeCurl(raw);
  outputFn(sanitized, raw);
}
