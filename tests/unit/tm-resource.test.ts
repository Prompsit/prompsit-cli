// See API-535: Unit tests for TMResource — boundary mapping tests.
// Pattern: same as translation-resource.test.ts — mock session, verify camelCase→snake_case mapping.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    openAsBlob: vi.fn().mockResolvedValue(new Blob(["<tmx>mock</tmx>"])),
  };
});

import { TMResource } from "../../src/api/resources/tm.ts";

function createMockSession() {
  return {
    request: vi.fn(),
  };
}

describe("TMResource boundary mapping", () => {
  let session: ReturnType<typeof createMockSession>;
  let resource: TMResource;

  beforeEach(() => {
    session = createMockSession();
    resource = new TMResource(session as never, "https://api.test");
  });

  // ---------------------------------------------------------------------------
  // list()
  // ---------------------------------------------------------------------------

  describe("list()", () => {
    it("maps camelCase params to snake_case searchParams", async () => {
      session.request.mockResolvedValue({
        items: [
          {
            id: "tm-1",
            profile_id: "p-1",
            source_lang: "en",
            target_lang: "es",
            segment_count: 100,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        total: 1,
      });

      await resource.list({
        profileId: "p-1",
        sourceLang: "en",
        targetLang: "es",
      });

      const [method, url, options] = session.request.mock.calls[0];
      expect(method).toBe("GET");
      expect(url).toContain("/v1/translation/memory");
      expect(options.searchParams).toEqual({
        profile_id: "p-1",
        source_lang: "en",
        target_lang: "es",
      });
    });

    it("omits optional params when undefined", async () => {
      session.request.mockResolvedValue({ items: [], total: 0 });

      await resource.list();

      const options = session.request.mock.calls[0][2];
      expect(options.searchParams).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // listSegments()
  // ---------------------------------------------------------------------------

  describe("listSegments()", () => {
    it("sends correct endpoint and maps params", async () => {
      session.request.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        page_size: 50,
      });

      await resource.listSegments({
        sourceLang: "en",
        targetLang: "es",
        page: 2,
        pageSize: 50,
      });

      const [method, url, options] = session.request.mock.calls[0];
      expect(method).toBe("GET");
      expect(url).toContain("/v1/translation/memory/segments");
      expect(options.searchParams).toMatchObject({
        source_lang: "en",
        target_lang: "es",
        page: 2,
        page_size: 50,
      });
    });

    it("omits optional profileId when undefined", async () => {
      session.request.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 50,
      });

      await resource.listSegments({
        sourceLang: "en",
        targetLang: "es",
      });

      const options = session.request.mock.calls[0][2];
      expect(options.searchParams).not.toHaveProperty("profile_id");
    });
  });

  // ---------------------------------------------------------------------------
  // importTmx() — F1: profile_id as query param, NOT form field
  // ---------------------------------------------------------------------------

  describe("importTmx()", () => {
    it("sends profile_id as searchParam, not in FormData (F1)", async () => {
      session.request.mockResolvedValue({
        tm_id: "tm-1",
        segment_count: 50,
        language_pairs: [["en", "es"]],
      });

      await resource.importTmx("/tmp/test.tmx", "p-1");

      const [method, url, options] = session.request.mock.calls[0];
      expect(method).toBe("POST");
      expect(url).toContain("/v1/translation/memory/import");

      // F1: profile_id in searchParams
      expect(options.searchParams).toEqual({ profile_id: "p-1" });

      // F1: FormData body should only have "file", not "profile_id"
      expect(options.body).toBeInstanceOf(FormData);
      const formData = options.body as FormData;
      expect(formData.has("file")).toBe(true);
      expect(formData.has("profile_id")).toBe(false);
    });

    it("omits profile_id from searchParams when undefined", async () => {
      session.request.mockResolvedValue({
        tm_id: "tm-1",
        segment_count: 10,
        language_pairs: [["en", "de"]],
      });

      await resource.importTmx("/tmp/test.tmx");

      const options = session.request.mock.calls[0][2];
      expect(options.searchParams).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // search()
  // ---------------------------------------------------------------------------

  describe("search()", () => {
    it("maps camelCase to snake_case body with hardcoded threshold", async () => {
      session.request.mockResolvedValue({
        hits: [
          {
            source_text: "Hello",
            target_text: "Hola",
            similarity: 0.95,
            match_type: "fuzzy",
          },
        ],
        total_count: 1,
      });

      await resource.search({
        query: "Hello",
        sourceLang: "en",
        targetLang: "es",
        limit: 5,
        profileId: "p-1",
      });

      const [method, url, options] = session.request.mock.calls[0];
      expect(method).toBe("POST");
      expect(url).toContain("/v1/translation/memory/search");
      expect(options.json).toEqual({
        query: "Hello",
        source_lang: "en",
        target_lang: "es",
        threshold: 0.7,
        limit: 5,
        profile_id: "p-1",
      });
    });

    it("omits profileId and limit when undefined", async () => {
      session.request.mockResolvedValue({
        hits: [],
        total_count: 0,
      });

      await resource.search({
        query: "Test",
        sourceLang: "en",
        targetLang: "de",
      });

      const options = session.request.mock.calls[0][2];
      expect(options.json).toEqual({
        query: "Test",
        source_lang: "en",
        target_lang: "de",
        threshold: 0.7,
      });
      expect(options.json).not.toHaveProperty("profile_id");
      expect(options.json).not.toHaveProperty("limit");
    });
  });
});
