// Port of tests/unit/test_credentials.py - token expiry buffer verification
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CredentialStore } from "../../src/config/credentials.ts";

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => "{}"),
  chmodSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock file system and paths to prevent disk I/O
vi.mock("node:fs", () => ({
  default: {
    existsSync: fsMocks.existsSync,
    readFileSync: fsMocks.readFileSync,
    chmodSync: fsMocks.chmodSync,
    unlinkSync: fsMocks.unlinkSync,
  },
}));
vi.mock("../../src/config/file-utils.ts", () => ({
  atomicWriteFile: vi.fn(),
}));
vi.mock("../../src/config/paths.ts", () => ({
  getCredsFile: vi.fn(() => "/tmp/test-credentials.json"),
}));
vi.mock("../../src/logging/index.ts", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("CredentialStore.isTokenExpired", () => {
  let store: CredentialStore;

  beforeEach(() => {
    store = new CredentialStore();
    fsMocks.existsSync.mockReset();
    fsMocks.readFileSync.mockReset();
    fsMocks.chmodSync.mockReset();
    fsMocks.unlinkSync.mockReset();
    fsMocks.existsSync.mockReturnValue(false);
    fsMocks.readFileSync.mockReturnValue("{}");
  });

  it("expired within buffer (30s token + 60s buffer = expired)", () => {
    // Token expires in 30s, but buffer is 60s -> should be considered expired
    store.saveTokens({ accessToken: "test-token", expiresIn: 30 });
    expect(store.isTokenExpired(60)).toBe(true);
  });

  it("not expired outside buffer (120s token + 60s buffer = valid)", () => {
    // Token expires in 120s, buffer is 60s -> still valid (60s remaining after buffer)
    store.saveTokens({ accessToken: "test-token", expiresIn: 120 });
    expect(store.isTokenExpired(60)).toBe(false);
  });

  it("unknown expiry (no expiresIn) returns true", () => {
    // No expiresIn -> expiresAtMono is null -> expired (triggers proactive refresh)
    store.saveTokens({ accessToken: "test-token" });
    expect(store.isTokenExpired(60)).toBe(true);
  });

  it("restores monotonic expiry from persisted expires_at (future token stays valid)", () => {
    const futureExpiresAt = Math.floor((Date.now() + 120_000) / 1000);
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(
      JSON.stringify({
        access_token: "disk-token",
        refresh_token: "disk-refresh",
        expires_at: futureExpiresAt,
      })
    );

    expect(store.getAccessToken()).toBe("disk-token");
    expect(store.isTokenExpired(30)).toBe(false);
  });

  it("restores expired state from persisted expires_at in the past", () => {
    const pastExpiresAt = Math.floor((Date.now() - 5000) / 1000);
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(
      JSON.stringify({
        access_token: "disk-token",
        refresh_token: "disk-refresh",
        expires_at: pastExpiresAt,
      })
    );

    expect(store.getAccessToken()).toBe("disk-token");
    expect(store.isTokenExpired(0)).toBe(true);
  });
});
