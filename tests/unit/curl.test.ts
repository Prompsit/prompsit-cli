// Curl module tests — token sanitization verification
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeCurl, buildCurl, logCurl, setCurlOutputFn, setCurlEnabled } from "../../src/api/curl.ts";

describe("sanitizeCurl", () => {
  it("replaces Bearer token with [token]", () => {
    const curl =
      "curl -X GET 'https://api.example.com/v1/test'\n  -H 'Authorization: Bearer super-secret-abc123'";
    const result = sanitizeCurl(curl);
    expect(result).not.toContain("super-secret-abc123");
    expect(result).toContain("Bearer [token]");
  });

  it("hides refresh_token value", () => {
    const curl =
      "curl -X POST 'https://api.example.com/v1/auth/token'\n  -d 'refresh_token=my-secret-refresh&grant_type=refresh_token'";
    const result = sanitizeCurl(curl);
    expect(result).not.toContain("my-secret-refresh");
    expect(result).toContain("refresh_token=[hidden]");
  });

  it("hides password and secret values", () => {
    const curl = "password=hunter2&secret=abc123";
    const result = sanitizeCurl(curl);
    expect(result).not.toContain("hunter2");
    expect(result).not.toContain("abc123");
    expect(result).toContain("password=[hidden]");
    expect(result).toContain("secret=[hidden]");
  });
});

describe("buildCurl", () => {
  it("includes custom headers (skips standard)", () => {
    const curl = buildCurl({
      method: "POST",
      url: new URL("https://api.example.com/v1/test"),
      headers: {
        Authorization: "Bearer token123",
        "Content-Type": "application/json",
        "user-agent": "got", // should be skipped
        "accept-encoding": "gzip", // should be skipped
      },
    } as any);
    expect(curl).toContain("Authorization: Bearer token123");
    expect(curl).toContain("Content-Type: application/json");
    expect(curl).not.toContain("user-agent");
    expect(curl).not.toContain("accept-encoding");
  });
});

describe("logCurl", () => {
  beforeEach(() => {
    setCurlEnabled(false);
    setCurlOutputFn(null);
  });

  it("does not call outputFn when curl display is disabled", () => {
    const fn = vi.fn();
    setCurlOutputFn(fn);
    setCurlEnabled(false);
    logCurl({ method: "GET", url: new URL("https://api.example.com") } as any);
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls outputFn with (sanitized, raw) when curl display is enabled", () => {
    const fn = vi.fn();
    setCurlOutputFn(fn);
    setCurlEnabled(true);
    logCurl({
      method: "GET",
      url: new URL("https://api.example.com"),
      headers: { Authorization: "Bearer real-token" },
    } as any);
    expect(fn).toHaveBeenCalledOnce();
    const [sanitized, raw] = fn.mock.calls[0] as [string, string];
    // Sanitized version hides token
    expect(sanitized).not.toContain("real-token");
    expect(sanitized).toContain("[token]");
    // Raw version preserves real token (for clipboard)
    expect(raw).toContain("real-token");
    expect(raw).toContain("Bearer real-token");
  });

  it("skips curl output for FormData body (file uploads)", () => {
    const fn = vi.fn();
    setCurlOutputFn(fn);
    setCurlEnabled(true);

    logCurl({
      method: "POST",
      url: new URL("https://api.example.com/v1/data/annotate"),
      headers: {},
      body: new FormData(),
    } as any);

    expect(fn).not.toHaveBeenCalled();
  });
});
