import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { HttpTransport } from "../../src/api/transport.ts";

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

describe("HttpTransport retry overrides", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => closeServer(server)));
  });

  it("does not retry semantic 400 responses when request retry limit is zero", async () => {
    let hits = 0;
    const server = createServer((_, response) => {
      hits += 1;
      response.statusCode = 400;
      response.setHeader("content-type", "application/json");
      response.setHeader("retry-after", "2");
      response.end(
        JSON.stringify({
          error: "authorization_pending",
          error_description: "The authorization request is still pending.",
        })
      );
    });
    servers.push(server);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected TCP server address");
    }

    const transport = new HttpTransport();
    const startedAt = Date.now();
    const response = await transport.requestRaw(
      "POST",
      `http://127.0.0.1:${String(address.port)}/device/token`,
      {
        json: {
          device_code: "device-code",
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        },
        throwHttpErrors: false,
        retry: { limit: 0 },
      },
      true
    );
    const durationMs = Date.now() - startedAt;

    expect(response.statusCode).toBe(400);
    expect(hits).toBe(1);
    expect(durationMs).toBeLessThan(500);
  });
});
