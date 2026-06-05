import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResource } from "../../src/api/resources/auth.ts";

const mocks = vi.hoisted(() => ({
  sleep: vi.fn(),
  openBrowser: vi.fn(),
  terminal: {
    info: vi.fn(),
    warn: vi.fn(),
    dim: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  spinner: {
    succeed: vi.fn(),
    fail: vi.fn(),
    stop: vi.fn(),
    isSpinning: false,
  },
}));

vi.mock("../../src/runtime/async-utils.ts", () => ({
  sleep: mocks.sleep,
}));

vi.mock("../../src/runtime/browser.ts", () => ({
  openBrowser: mocks.openBrowser,
}));

vi.mock("../../src/output/index.ts", () => ({
  terminal: mocks.terminal,
}));

vi.mock("../../src/i18n/index.ts", () => ({
  t: (key: string, params?: Record<string, string>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

vi.mock("../../src/logging/index.ts", () => ({
  getLogger: () => mocks.logger,
}));

vi.mock("../../src/api/client.ts", () => ({
  getApiClient: () => ({ baseUrl: "https://api.test" }),
}));

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => mocks.spinner),
  })),
}));

import { runDeviceFlow } from "../../src/commands/device-flow.ts";

describe("runDeviceFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sleep.mockImplementation(async () => {});
    mocks.openBrowser.mockResolvedValue(true);
    mocks.spinner.isSpinning = false;
  });

  it("increases only the app-level polling interval after slow_down", async () => {
    const authResource = {
      requestDeviceCode: vi.fn().mockResolvedValue({
        device_code: "device-code",
        user_code: "ABCD-1234",
        verification_uri: "/v1/auth/device/page",
        verification_uri_complete: "/v1/auth/device/page?user_code=ABCD-1234",
        expires_in: 600,
        interval: 2,
      }),
      pollDeviceToken: vi
        .fn()
        .mockResolvedValueOnce({ status: "slow_down" })
        .mockResolvedValueOnce({
          status: "success",
          data: {
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 3600,
            plan: "free",
            email: "user@example.com",
            account_id: "acc-1",
          },
        }),
    };

    await runDeviceFlow(authResource as unknown as AuthResource);

    expect(mocks.sleep.mock.calls[0]?.[0]).toBe(2000);
    expect(mocks.sleep.mock.calls[1]?.[0]).toBe(7000);
    expect(authResource.pollDeviceToken).toHaveBeenCalledTimes(2);
  });
});
