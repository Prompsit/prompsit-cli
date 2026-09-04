import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEnvOverrides } from "../../src/config/env-parser.ts";

// Control the TOML "file" layer deterministically (no disk read) so precedence is hermetic.
vi.mock("../../src/config/toml-io.ts", async () => {
  const { SettingsSchema } = await import("../../src/config/schemas.ts");
  return {
    readConfigToml: vi.fn(() =>
      SettingsSchema.parse({ api: { base_url: "https://toml.example/" }, cli: { batch_size: 11 } })
    ),
    writeConfigToml: vi.fn(),
  };
});

import {
  assertNetworkConfiguration,
  getSettings,
  reloadSettings,
} from "../../src/config/settings.ts";

// Snapshot + strip ALL ambient PROMPSIT_* before each test so a developer's or CI's real
// environment can't leak into precedence assertions; restore the original env afterward.
let envSnapshot: Record<string, string> = {};

beforeEach(() => {
  envSnapshot = {};
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("PROMPSIT_")) {
      envSnapshot[key] = process.env[key] as string;
      Reflect.deleteProperty(process.env, key);
    }
  }
  reloadSettings();
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("PROMPSIT_")) Reflect.deleteProperty(process.env, key);
  }
  Object.assign(process.env, envSnapshot);
  reloadSettings();
});

describe("parseEnvOverrides", () => {
  it("maps the __ delimiter to a nested object (PROMPSIT_API__BASE_URL)", () => {
    process.env.PROMPSIT_API__BASE_URL = "http://custom:8080";
    const result = parseEnvOverrides("PROMPSIT_", "__") as { api?: { base_url?: unknown } };
    expect(result.api?.base_url).toBe("http://custom:8080");
  });

  it("coerces booleans and numbers, leaves other strings as-is", () => {
    process.env.PROMPSIT_TELEMETRY__ENABLED = "true";
    process.env.PROMPSIT_CLI__BATCH_SIZE = "10";
    process.env.PROMPSIT_CLI__LANGUAGE = "es";
    const r = parseEnvOverrides("PROMPSIT_", "__") as {
      telemetry?: { enabled?: unknown };
      cli?: { batch_size?: unknown; language?: unknown };
    };
    expect(r.telemetry?.enabled).toBe(true);
    expect(r.cli?.batch_size).toBe(10);
    expect(r.cli?.language).toBe("es");
  });

  it("ignores prototype-pollution segments (prototype, constructor)", () => {
    process.env.PROMPSIT_PROTOTYPE = "evil";
    process.env.PROMPSIT_CONSTRUCTOR__X = "evil";
    const result = parseEnvOverrides("PROMPSIT_", "__") as Record<string, unknown>;
    expect(Object.hasOwn(result, "prototype")).toBe(false);
    expect(Object.hasOwn(result, "constructor")).toBe(false);
  });
});

describe("config precedence: env > TOML > defaults", () => {
  it("TOML overrides the schema default when no env var is set", () => {
    expect(getSettings().api.base_url).toBe("https://toml.example/");
    expect(getSettings().cli.batch_size).toBe(11);
  });

  it("env overrides TOML (and the schema default)", () => {
    process.env.PROMPSIT_API__BASE_URL = "https://env.example/";
    process.env.PROMPSIT_CLI__BATCH_SIZE = "99";
    reloadSettings();
    expect(getSettings().api.base_url).toBe("https://env.example/");
    expect(getSettings().cli.batch_size).toBe(99);
  });

  it("blocks network use instead of silently routing after an invalid override", () => {
    process.env.PROMPSIT_API__BASE_URL = "http://remote.example/";
    reloadSettings();

    expect(getSettings().api.base_url).toBe("https://toml.example/");
    expect(() => assertNetworkConfiguration()).toThrow(/network access is disabled/iu);
  });
});
