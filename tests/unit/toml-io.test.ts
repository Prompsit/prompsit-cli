import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readConfigToml, writeConfigToml } from "../../src/config/toml-io.ts";
import { SettingsSchema } from "../../src/config/schemas.ts";

let dataDir: string | null = null;

afterEach(async () => {
  Reflect.deleteProperty(process.env, "PROMPSIT_DATA_DIR");
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  dataDir = null;
});

describe("TOML configuration boundary", () => {
  it("reports malformed configuration instead of silently returning defaults", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "prompsit-config-"));
    process.env.PROMPSIT_DATA_DIR = dataDir;
    await writeFile(join(dataDir, "config.toml"), "[api\nbase_url = broken", "utf8");

    expect(() => readConfigToml()).toThrow(/Unable to load/iu);
  });

  it("validates before replacing an existing configuration file", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "prompsit-config-"));
    process.env.PROMPSIT_DATA_DIR = dataDir;
    const configPath = join(dataDir, "config.toml");
    await writeFile(configPath, "# retained\n", "utf8");
    const invalid = SettingsSchema.parse({});
    invalid.api.base_url = "http://remote.example";

    expect(() => writeConfigToml(invalid)).toThrow();
    expect(await readFile(configPath, "utf8")).toBe("# retained\n");
  });
});
