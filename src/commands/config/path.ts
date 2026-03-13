import { Command } from "@commander-js/extra-typings";
import { getConfigFile } from "../../config/index.ts";
import { terminal } from "../../output/index.ts";

export function registerConfigPath(configCommand: Command): void {
  configCommand
    .command("path")
    .description("Show path to configuration file")
    .action(() => {
      terminal.line(getConfigFile());
    });
}
