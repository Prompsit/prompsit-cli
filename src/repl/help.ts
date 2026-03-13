// See API-500: REPL help display — unified single-page help with optional per-command filtering.

import chalk from "chalk";
import type { StringKey } from "../i18n/catalog.ts";
import { t } from "../i18n/index.ts";
import { terminal } from "../output/terminal.ts";
import { COMMANDS, getHelpGroups, getAliasesFor, type HelpFilter } from "./registry.ts";

/** Max flag width for option alignment. */
const FLAG_PAD = 24;

/**
 * Show help page.
 *
 * Display modes:
 * - No filter → full help (all groups).
 * - `{ mode: "groups", groups }` → show only the listed groups (parent commands).
 * - `{ mode: "single", name }` → show one specific command entry.
 *
 * @param filter - Optional HelpFilter to restrict output.
 */
export function showHelp(filter?: HelpFilter): void {
  const byName = new Map(COMMANDS.map((c) => [c.name, c]));

  // Determine filter scope
  let allowedGroups: ReadonlySet<string> | null = null;
  let singleName: string | null = null;

  if (filter?.mode === "groups") {
    allowedGroups = new Set(filter.groups.map((k) => t(k)));
  } else if (filter?.mode === "single") {
    singleName = filter.name;
    const cmd = byName.get(filter.name);
    if (cmd) allowedGroups = new Set([t(cmd.group)]);
  }

  for (const [groupName, cmdNames] of getHelpGroups()) {
    if (allowedGroups && !allowedGroups.has(groupName)) continue;

    if (!singleName) {
      terminal.line("");
      terminal.line(chalk.yellow.bold(groupName));
    }

    for (const name of cmdNames) {
      if (singleName && name !== singleName) continue;

      const cmd = byName.get(name);
      if (!cmd) continue;

      const desc = t(cmd.descKey ?? (`repl.cmd.${cmd.name}` as StringKey));
      const argsStr = cmd.argsSyntax ? ` ${chalk.dim(cmd.argsSyntax)}` : "";
      terminal.line("");
      terminal.line(`  ${desc}`);
      terminal.line(`  ${chalk.cyan.bold(cmd.name)}${argsStr}`);

      // Aliases
      const aliases = getAliasesFor(cmd.name);
      if (aliases.length > 0) {
        terminal.line(`    ${chalk.dim(t("repl.help.label.aliases"))} ${aliases.join(", ")}`);
      }

      // Options
      if (cmd.options?.length) {
        terminal.line(`    ${chalk.yellow(t("repl.help.label.options"))}`);
        for (const opt of cmd.options) {
          terminal.line(`      ${chalk.dim(opt.flag.padEnd(FLAG_PAD))}${t(opt.descKey)}`);
        }
      }

      // Subcommands
      if (cmd.relatedCommands?.length) {
        terminal.line(`    ${chalk.yellow(t("repl.help.label.subcommands"))}`);
        for (const sub of cmd.relatedCommands) {
          terminal.line(`      ${chalk.cyan(sub.syntax)}`);
          terminal.line(`        ${t(sub.descKey)}`);
        }
      }

      // Examples (REPL first, then CLI)
      if (cmd.replExamples?.length) {
        terminal.line(`    ${chalk.yellow(t("repl.help.label.examples"))}`);
        for (const ex of cmd.replExamples) {
          terminal.line(`      ${chalk.dim(">")} ${ex}`);
        }
      } else if (cmd.cliExamples?.length) {
        terminal.line(`    ${chalk.yellow(t("repl.help.label.examples"))}`);
        for (const ex of cmd.cliExamples) {
          terminal.line(`      ${chalk.dim("$")} ${ex}`);
        }
      }
    }
  }

  // Footer hint when showing filtered view
  if (filter) {
    terminal.line("");
    terminal.line(chalk.dim(t("repl.help.hint.all_commands")));
  }

  terminal.line("");
}
