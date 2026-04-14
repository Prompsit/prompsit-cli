// See API-535: TM parent command with subcommand wiring.
// Pattern: same as config/command.ts — parent delegates to default subcommand.

import { Command } from "@commander-js/extra-typings";
import { registerTmShow } from "./show.ts";
import { registerTmImport } from "./import.ts";
import { registerTmSearch } from "./search.ts";

export const tmCommand = new Command("tm")
  .description("Manage translation memories")
  .helpCommand(false)
  .action(async () => {
    // Default to tm show (list TMs)
    const showCmd = tmCommand.commands.find((c) => c.name() === "show");
    if (showCmd) showCmd.parse([], { from: "user" });
  });

registerTmShow(tmCommand);
registerTmImport(tmCommand);
registerTmSearch(tmCommand);
