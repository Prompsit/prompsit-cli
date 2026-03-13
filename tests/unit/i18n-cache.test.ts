import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn<(path: string) => boolean>(),
  readFileSync: vi.fn<(path: string, enc: string) => string>(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  readFileSync: mocks.readFileSync,
  mkdirSync: mocks.mkdirSync,
}));

vi.mock("../../src/config/paths.ts", () => ({
  getConfigDir: () => "/tmp/prompsit-test",
}));

const { loadCache } = await import("../../src/i18n/cache.ts");

describe("i18n cache (hash-only invalidation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existsSync.mockReturnValue(true);
  });

  it("returns miss when cache file does not exist", () => {
    mocks.existsSync.mockReturnValue(false);
    const result = loadCache("es", "hash1");
    expect(result.hit).toBe(false);
    expect(result.translations).toBeNull();
  });

  it("returns hit when catalog hash matches", () => {
    mocks.readFileSync.mockReturnValue(
      JSON.stringify({
        _meta: { catalog_hash: "hash1" },
        "config.set_success": "Configurado",
      })
    );

    const result = loadCache("es", "hash1");
    expect(result.hit).toBe(true);
    expect(result.translations?.["config.set_success"]).toBe("Configurado");
  });

  it("returns miss with stale translations when catalog hash differs", () => {
    mocks.readFileSync.mockReturnValue(
      JSON.stringify({
        _meta: { catalog_hash: "old_hash" },
        "config.set_success": "Configurado",
      })
    );

    const result = loadCache("es", "new_hash");
    expect(result.hit).toBe(false);
    expect(result.translations).toEqual({ "config.set_success": "Configurado" });
  });

  it("returns miss when cache file has no translations", () => {
    mocks.readFileSync.mockReturnValue(
      JSON.stringify({
        _meta: { catalog_hash: "hash1" },
      })
    );

    const result = loadCache("es", "hash1");
    expect(result.hit).toBe(false);
    expect(result.translations).toBeNull();
  });

  it("returns miss when cache file is corrupt JSON", () => {
    mocks.readFileSync.mockReturnValue("not json{{{");

    const result = loadCache("es", "hash1");
    expect(result.hit).toBe(false);
    expect(result.translations).toBeNull();
  });
});
