import { Command } from "@commander-js/extra-typings";
import {
  buildCliKeyMap,
  getConfigValue,
  getEnvOverridesSnapshot,
  getValidConfigKeys,
} from "../../config/index.ts";
import { terminal } from "../../output/index.ts";
import { detectSource } from "./shared.ts";
import { readRawToml } from "../../config/index.ts";

export function registerConfigShow(configCommand: Command): void {
  configCommand
    .command("show")
    .description("Display all configuration values with sources")
    .action(() => {
      const keys = getValidConfigKeys();
      const keyMap = buildCliKeyMap();
      const tomlData = readRawToml();
      const envData = getEnvOverridesSnapshot();

      terminal.table({
        columns: [
          { key: "key", header: "Key", minWidth: 16, required: true, priority: 0 },
          { key: "value", header: "Value", minWidth: 20, required: true, priority: 0 },
          { key: "source", header: "Source", width: 10, priority: 2 },
        ],
        rows: keys.map((key) => {
          const value = getConfigValue(key);
          const [section, field] = keyMap[key];
          return {
            key,
            value: String(value),
            source: detectSource(section, field, tomlData, envData),
          };
        }),
        compactOrder: ["key", "value", "source"],
      });
    });
}
