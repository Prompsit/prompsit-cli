// Port of tests/unit/test_settings.py — type coercion verification
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock TOML reader and logger to avoid disk I/O
vi.mock("../../src/config/toml-io.ts", () => ({
  readConfigToml: vi.fn(() => ({})),
  writeConfigToml: vi.fn(),
}));
vi.mock("../../src/logging/index.ts", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { getConfigValue, setConfigValue, reloadSettings } from "../../src/config/settings.ts";
import * as tomlIo from "../../src/config/toml-io.ts";

const mockWriteConfigToml = vi.mocked(tomlIo.writeConfigToml);

describe("setConfigValue type coercion", () => {
  beforeEach(() => {
    mockWriteConfigToml.mockReset();
    reloadSettings();
  });

  it("boolean: 'true' -> true (not string)", () => {
    // telemetry-enabled defaults to false (boolean), so "true" should coerce to true
    setConfigValue("telemetry-enabled", "true");
    const value = getConfigValue("telemetry-enabled");
    expect(value).toBe(true);
    expect(typeof value).toBe("boolean");
  });

  it("boolean: 'false' -> false", () => {
    setConfigValue("telemetry-enabled", "false");
    expect(getConfigValue("telemetry-enabled")).toBe(false);
  });

  it("number (int): '100' -> 100", () => {
    // batch-size defaults to a number
    setConfigValue("batch-size", "100");
    const value = getConfigValue("batch-size");
    expect(value).toBe(100);
    expect(typeof value).toBe("number");
  });

  it("number (float): '7.5' -> 7.5", () => {
    // connect-timeout defaults to a number
    setConfigValue("api-connect-timeout", "7.5");
    const value = getConfigValue("api-connect-timeout");
    expect(value).toBe(7.5);
    expect(typeof value).toBe("number");
  });

  it("rejects values outside the schema without mutating the cache", () => {
    expect(() => setConfigValue("file-concurrency", "11")).toThrow();
    expect(getConfigValue("file-concurrency")).toBe(3);
    expect(() => setConfigValue("telemetry-enabled", "yes")).toThrow();
    expect(getConfigValue("telemetry-enabled")).toBe(false);
  });

  it("rejects cleartext remote API URLs and accepts loopback HTTP", () => {
    expect(() => setConfigValue("api-base-url", "http://example.com")).toThrow();
    setConfigValue("api-base-url", "http://127.0.0.1:8080");
    expect(getConfigValue("api-base-url")).toBe("http://127.0.0.1:8080");
  });

  it("keeps the cached value when persistence fails", () => {
    mockWriteConfigToml.mockImplementationOnce(() => {
      throw new Error("disk full");
    });

    expect(() => setConfigValue("batch-size", "75")).toThrow("disk full");
    expect(getConfigValue("batch-size")).toBe(50);
  });
});
