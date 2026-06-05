import { describe, expect, it, vi } from "vitest";
import { AuthResource } from "../../src/api/resources/auth.ts";
import type { HttpTransport } from "../../src/api/transport.ts";

const rawResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  body: Buffer.from(JSON.stringify(body)),
  headers: {},
});

function createResource() {
  const transport = {
    request: vi.fn(),
    requestRaw: vi.fn(),
  };
  const resource = new AuthResource(transport as unknown as HttpTransport, "https://api.test");
  return { resource, transport };
}

describe("AuthResource.pollDeviceToken", () => {
  it("returns pending immediately for authorization_pending without transport retry", async () => {
    const { resource, transport } = createResource();
    transport.requestRaw.mockResolvedValue(
      rawResponse(400, {
        error: "authorization_pending",
        error_description: "Authorization pending",
      })
    );

    const result = await resource.pollDeviceToken("device-code");

    expect(result).toEqual({ status: "pending" });
    expect(transport.requestRaw).toHaveBeenCalledOnce();
    expect(transport.requestRaw).toHaveBeenCalledWith(
      "POST",
      "https://api.test/v1/auth/device/token",
      expect.objectContaining({
        throwHttpErrors: false,
        retry: { limit: 0 },
      }),
      true
    );
  });

  it("maps slow_down to app-level polling logic", async () => {
    const { resource, transport } = createResource();
    transport.requestRaw.mockResolvedValue(
      rawResponse(400, {
        error: "slow_down",
        error_description: "Slow down",
      })
    );

    const result = await resource.pollDeviceToken("device-code");

    expect(result).toEqual({ status: "slow_down" });
    expect(transport.requestRaw).toHaveBeenCalledOnce();
  });
});
