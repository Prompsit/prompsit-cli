import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranslationResource } from "../../src/api/resources/translation.ts";

function createMockSession() {
  return {
    request: vi.fn().mockResolvedValue({
      translations: [{ translated_text: "hola", latency_ms: 10, quality_score: null, tag_alignment_method: null }],
      source_lang: "en",
      target_lang: "es",
      engine: "generic",
      total_latency_ms: 10,
    }),
  };
}

describe("TranslationResource.translate() boundary mapping", () => {
  let session: ReturnType<typeof createMockSession>;
  let resource: TranslationResource;

  beforeEach(() => {
    session = createMockSession();
    resource = new TranslationResource(session as any, "https://api.test");
  });

  it("maps camelCase params to snake_case body + query params", async () => {
    await resource.translate({
      texts: ["hello"],
      sourceLang: "en",
      targetLang: "es",
      enableQe: true,
    });

    const [method, url, options] = session.request.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toContain("/v1/translation");

    // Body must use snake_case keys for the API
    expect(options.json).toEqual({
      texts: ["hello"],
      source_lang: "en",
      target_lang: "es",
    });

    // enableQe must go as query param, not body
    expect(options.searchParams).toEqual({ enable_qe: "true" });
    expect(options.json).not.toHaveProperty("enable_qe");
    expect(options.json).not.toHaveProperty("enableQe");
  });

  it("omits enable_qe from query when enableQe is false/undefined", async () => {
    await resource.translate({
      texts: ["hello"],
      sourceLang: "en",
      targetLang: "es",
    });

    const options = session.request.mock.calls[0][2];
    expect(options.searchParams).toEqual({});
  });
});
