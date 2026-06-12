import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResource } from "../../src/api/resources/auth.ts";

const originalStdoutIsTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

const mocks = vi.hoisted(() => ({
  sleep: vi.fn(),
  openBrowser: vi.fn(),
  setClipboardText: vi.fn(),
  writeOsc52: vi.fn(),
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

vi.mock("../../src/runtime/clipboard.ts", () => ({
  setClipboardText: mocks.setClipboardText,
  writeOsc52: mocks.writeOsc52,
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

function setStdoutTTY(value: boolean): void {
  Object.defineProperty(process.stdout, "isTTY", { value, configurable: true });
}

function restoreStdoutTTY(): void {
  if (originalStdoutIsTTY) {
    Object.defineProperty(process.stdout, "isTTY", originalStdoutIsTTY);
    return;
  }
  delete (process.stdout as { isTTY?: boolean }).isTTY;
}

function createSuccessfulAuthResource(
  deviceAuth: Record<string, unknown> = {}
): Pick<AuthResource, "requestDeviceCode" | "pollDeviceToken"> {
  return {
    requestDeviceCode: vi.fn().mockResolvedValue({
      device_code: "device-code",
      user_code: "ABCD-1234",
      verification_uri: "/v1/auth/device/page",
      verification_uri_complete: "/v1/auth/device/page?user_code=ABCD-1234",
      expires_in: 600,
      interval: 2,
      ...deviceAuth,
    }),
    pollDeviceToken: vi.fn().mockResolvedValue({
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
}

describe("runDeviceFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sleep.mockImplementation(async () => {});
    mocks.openBrowser.mockResolvedValue(true);
    mocks.setClipboardText.mockResolvedValue(true);
    mocks.spinner.isSpinning = false;
    setStdoutTTY(false);
  });

  afterEach(() => {
    restoreStdoutTTY();
  });

  it("copies the complete sign-in URL when present", async () => {
    const authResource = createSuccessfulAuthResource();

    await runDeviceFlow(authResource as unknown as AuthResource);

    const expectedUrl = "https://api.test/v1/auth/device/page?user_code=ABCD-1234";
    expect(mocks.setClipboardText).toHaveBeenCalledWith(expectedUrl);
    expect(mocks.openBrowser).toHaveBeenCalledWith(expectedUrl);
    expect(mocks.terminal.dim).toHaveBeenCalledWith("auth.device.url_copied");
  });

  it("copies the resolved verification URI when the complete URL is absent", async () => {
    const authResource = createSuccessfulAuthResource({
      verification_uri_complete: undefined,
    });

    await runDeviceFlow(authResource as unknown as AuthResource);

    const expectedUrl = "https://api.test/v1/auth/device/page";
    expect(mocks.setClipboardText).toHaveBeenCalledWith(expectedUrl);
    expect(mocks.openBrowser).toHaveBeenCalledWith(expectedUrl);
  });

  it("falls back to OSC 52 when system clipboard copy fails in a TTY", async () => {
    mocks.setClipboardText.mockResolvedValue(false);
    setStdoutTTY(true);
    const authResource = createSuccessfulAuthResource();

    await runDeviceFlow(authResource as unknown as AuthResource);

    const expectedUrl = "https://api.test/v1/auth/device/page?user_code=ABCD-1234";
    expect(mocks.writeOsc52).toHaveBeenCalledWith(expectedUrl);
    expect(mocks.terminal.dim).toHaveBeenCalledWith("auth.device.url_sent_osc52");
  });

  it("does not block login when clipboard copy throws", async () => {
    mocks.setClipboardText.mockRejectedValue(new Error("clipboard failed"));
    const authResource = createSuccessfulAuthResource();

    await expect(runDeviceFlow(authResource as unknown as AuthResource)).resolves.toMatchObject({
      accessToken: "access",
      refreshToken: "refresh",
      email: "user@example.com",
    });
    expect(mocks.writeOsc52).not.toHaveBeenCalled();
    expect(mocks.terminal.dim).toHaveBeenCalledWith("auth.device.url_copy_unavailable");
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
