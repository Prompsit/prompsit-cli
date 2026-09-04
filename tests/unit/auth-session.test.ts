import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSession } from "../../src/api/auth-session.ts";
import { AuthenticationError, NetworkError } from "../../src/errors/contracts.ts";

vi.mock("../../src/config/credentials.ts", () => ({
  isAuthenticated: vi.fn(() => true),
  isTokenExpired: vi.fn(() => false),
  getRefreshToken: vi.fn(() => "mock-refresh-token"),
  getAccessToken: vi.fn(() => "mock-access-token"),
  getAccountId: vi.fn(() => "acc-test"),
  saveTokens: vi.fn(),
  clearTokens: vi.fn(),
  resetAuthCache: vi.fn(),
  withCredentialLock: vi.fn(async (operation: () => Promise<unknown>) => operation()),
}));

import * as creds from "../../src/config/credentials.ts";

const mockIsAuthenticated = vi.mocked(creds.isAuthenticated);
const mockIsTokenExpired = vi.mocked(creds.isTokenExpired);
const mockGetRefreshToken = vi.mocked(creds.getRefreshToken);
const mockGetAccessToken = vi.mocked(creds.getAccessToken);
const mockClearTokens = vi.mocked(creds.clearTokens);

function createMocks() {
  const transport = {
    request: vi.fn(),
    resetAuthClient: vi.fn(),
  };
  const authResource = {
    refreshToken: vi.fn(),
  };
  const session = new AuthSession(transport as any, authResource as any);
  return { transport, authResource, session };
}

describe("AuthSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(true);
    mockIsTokenExpired.mockReturnValue(false);
    mockGetRefreshToken.mockReturnValue("mock-refresh-token");
    mockGetAccessToken.mockReturnValue("mock-access-token");
  });

  it("unauthenticated requests use public transport (no auth header)", async () => {
    mockIsAuthenticated.mockReturnValue(false);
    const { session, transport } = createMocks();
    transport.request.mockResolvedValue({ data: "public" });

    const result = await session.request("GET", "/v1/engines");
    expect(result).toEqual({ data: "public" });
    // publicFlag=true means no Authorization header
    expect(transport.request).toHaveBeenCalledWith(
      "GET",
      "/v1/engines",
      {},
      true,
      undefined,
      undefined
    );
  });

  it("expired token triggers proactive refresh", async () => {
    mockIsTokenExpired.mockReturnValue(true);
    const { session, transport, authResource } = createMocks();

    authResource.refreshToken.mockResolvedValue({
      access_token: "new-token",
      refresh_token: "new-refresh",
      expires_in: 3600,
    });
    transport.request.mockResolvedValue({ data: "ok" });

    const result = await session.request("GET", "/v1/test");
    expect(result).toEqual({ data: "ok" });
    expect(authResource.refreshToken).toHaveBeenCalledOnce();
    expect(transport.request).toHaveBeenCalledOnce();
  });

  it("expired token with no refresh token clears auth", async () => {
    mockIsTokenExpired.mockReturnValue(true);
    mockGetRefreshToken.mockReturnValue(null);
    const { session } = createMocks();

    await expect(session.request("GET", "/v1/test")).rejects.toThrow(AuthenticationError);
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("reactive refresh retries once after authentication failure", async () => {
    const { session, transport, authResource } = createMocks();

    transport.request
      .mockRejectedValueOnce(new AuthenticationError("Authentication required"))
      .mockResolvedValueOnce({ data: "ok" });

    authResource.refreshToken.mockResolvedValue({
      access_token: "new-token",
      refresh_token: "new-refresh",
      expires_in: 3600,
    });

    const result = await session.request("GET", "/v1/test");
    expect(result).toEqual({ data: "ok" });
    expect(transport.request).toHaveBeenCalledTimes(2);
    expect(authResource.refreshToken).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent refresh calls within one process", async () => {
    const { session, authResource } = createMocks();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    authResource.refreshToken.mockImplementation(async () => {
      await gate;
      return {
        access_token: "new-token",
        refresh_token: "new-refresh",
        expires_in: 3600,
      };
    });

    const p1 = session.tryRefresh();
    const p2 = session.tryRefresh();
    const p3 = session.tryRefresh();

    release();
    const results = await Promise.all([p1, p2, p3]);

    expect(results).toEqual([true, true, true]);
    expect(authResource.refreshToken).toHaveBeenCalledTimes(1);
  });

  it("adopts credentials rotated while waiting for the cross-process lock", async () => {
    mockGetRefreshToken.mockReturnValueOnce("old-refresh").mockReturnValue("new-refresh");
    mockGetAccessToken.mockReturnValueOnce("old-access").mockReturnValue("new-access");
    const { session, authResource, transport } = createMocks();

    await expect(session.tryRefresh()).resolves.toBe(true);
    expect(authResource.refreshToken).not.toHaveBeenCalled();
    expect(transport.resetAuthClient).toHaveBeenCalledOnce();
  });

  it("preserves credentials when refresh fails for a network reason", async () => {
    const { session, authResource } = createMocks();
    authResource.refreshToken.mockRejectedValue(new NetworkError("offline"));

    await expect(session.tryRefresh()).rejects.toThrow(NetworkError);
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it("does not clear credentials replaced during a rejected refresh", async () => {
    mockGetRefreshToken
      .mockReturnValueOnce("old-refresh")
      .mockReturnValueOnce("old-refresh")
      .mockReturnValue("new-refresh");
    const { session, authResource } = createMocks();
    authResource.refreshToken.mockRejectedValue(new AuthenticationError("rejected"));

    await expect(session.tryRefresh()).resolves.toBe(false);
    expect(mockClearTokens).not.toHaveBeenCalled();
  });
});
