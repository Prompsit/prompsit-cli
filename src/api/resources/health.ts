// See API-448: Health resource - GET /health with Zod validation
// Uses public transport (no auth required).

import type { HttpTransport } from "../transport.ts";
import { HealthResponseSchema, type HealthResponse } from "../models.ts";
import { Endpoint } from "../../shared/constants.ts";

/**
 * Health API resource.
 *
 * Calls GET /health via public transport (no auth).
 * Validates response with Zod schema at boundary.
 */
export class HealthResource {
  private readonly transport: HttpTransport;
  private readonly baseUrl: string;

  constructor(transport: HttpTransport, baseUrl: string) {
    this.transport = transport;
    this.baseUrl = baseUrl;
  }

  /**
   * Check API health status.
   *
   * @returns Validated HealthResponse
   * @throws NetworkError if API unreachable
   * @throws ZodError if response schema mismatch
   */
  async check(): Promise<HealthResponse> {
    const baseUrl = this.baseUrl;
    const data = await this.transport.request<unknown>(
      "GET",
      `${baseUrl}${Endpoint.HEALTH}`,
      {},
      true
    );
    return HealthResponseSchema.parse(data);
  }
}
