// Commander.js program definition — extracted from index.ts to avoid ESM TLA deadlock.
//
// This module is 100% synchronous (no top-level await), so it can be safely
// imported by both the entry point (index.ts) and the REPL dispatcher (executor.ts).

import { styleText } from "node:util";
import { Command, CommanderError } from "@commander-js/extra-typings";
import { init as initI18n } from "./i18n/index.ts";
import { setUsageErrorExit } from "./cli/exit.ts";
import { healthCommand } from "./commands/health.ts";
import { loginCommand, logoutCommand } from "./commands/auth.ts";
import { translateCommand } from "./commands/translate.ts";
import { evaluateCommand } from "./commands/evaluate.ts";
import { configCommand } from "./commands/config/command.ts";
import { scoreCommand } from "./commands/score.ts";
import { annotateCommand } from "./commands/annotate.ts";
import { usageCommand } from "./commands/usage.ts";
import { getVersion } from "./shared/version.ts";
import { terminal } from "./output/terminal.ts";
import { getSettings } from "./config/index.ts";
import { buildEpilogByCommanderPath } from "./repl/registry.ts";

const settings = getSettings();
initI18n(settings.cli.language);

export const program = new Command()
  .name("prompsit")
  .description("Translate, evaluate, and process text with the Prompsit API")
  .helpCommand(false);

// Help styling: bold titles, cyan commands and options
program.configureHelp({
  sortSubcommands: false,
  sortOptions: false,
  styleTitle: (str) => styleText("bold", str),
  styleCommandText: (str) => styleText("cyan", str),
  styleOptionText: (str) => styleText("cyan", str),
});

program.helpOption("-h, --help", "Show this help");
program.version(getVersion(), "-V, --version", "Show version number");
program.option("-v, --verbose", "Enable debug logging to stderr");

// --- Grouped commands ---

program.commandsGroup("Basics:");
program.addCommand(loginCommand);
program.addCommand(logoutCommand);

program.commandsGroup("Translation:");
program.addCommand(translateCommand);

program.commandsGroup("Evaluation:");
program.addCommand(evaluateCommand);

program.commandsGroup("Data:");
program.addCommand(scoreCommand);
program.addCommand(annotateCommand);

program.commandsGroup("Configuration:");
program.addCommand(configCommand);

program.commandsGroup("System:");
program.addCommand(healthCommand);
program.addCommand(usageCommand);

// Copy-paste examples in main help footer
program.addHelpText(
  "after",
  `
Examples:
  $ prompsit login
  $ prompsit translate "Hello world" -s en -t es
  $ prompsit translate @report.docx -s en -t de
  $ prompsit translate --formats
  $ prompsit translate --languages -s en
  $ prompsit eval -s "Hello" -h "Hola" -r "Hola"
  $ prompsit eval @scores.csv -m bleu,chrf
  $ prompsit eval --formats
  $ prompsit score @corpus.tmx
  $ prompsit annotate @corpus.jsonl -l en --metadata "lid,docscorer"
  $ prompsit usage
  $ prompsit                                            # Interactive REPL

Run 'prompsit <command> --help' for detailed usage and examples.`
);

// exitOverride: catch Commander.js parse errors and map to exit code 2
program.exitOverride((err: CommanderError) => {
  if (err.exitCode !== 0) {
    setUsageErrorExit();
  }
  throw err;
});

// Redirect Commander output through terminal adapter used by CLI and REPL.
// Commander's writeOut includes trailing \n; console.log adds its own -> trim to avoid double newline.
program.configureOutput({
  writeOut: (str) => {
    terminal.line(str.endsWith("\n") ? str.slice(0, -1) : str);
  },
  writeErr: (str) => {
    terminal.warn(str.trimEnd());
  },
  // Commander calls outputError(str, writeErr) for parse errors (excess args, missing options).
  // Override to route through terminal.error (red) instead of writeErr (yellow warning).
  outputError: (str) => {
    terminal.error("COMMAND", str.trimEnd());
  },
});

// addCommand() doesn't copy inherited settings (Commander.js by design).
// Only the fluent .command() API calls copyInheritedSettings() automatically.
// See: https://github.com/tj/commander.js#commands
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Commander generic variance
function propagateSettings(parent: Command<any, any, any>): void {
  for (const cmd of parent.commands) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Commander generic variance
    cmd.copyInheritedSettings(parent);
    propagateSettings(cmd);
  }
}
propagateSettings(program);

// Attach CLI examples as epilogs to leaf commands (from REPL registry)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Commander generic variance
function attachEpilogs(parent: Command<any, any, any>, parentPath: string): void {
  for (const cmd of parent.commands) {
    const cmdPath = parentPath ? `${parentPath} ${cmd.name()}` : cmd.name();
    const epilog = buildEpilogByCommanderPath(cmdPath);
    if (epilog) cmd.addHelpText("after", epilog);
    attachEpilogs(cmd, cmdPath);
  }
}
attachEpilogs(program, "");
