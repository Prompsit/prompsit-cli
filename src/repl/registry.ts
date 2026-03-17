// Central command registry -- single source of truth for REPL metadata.
//
// Every REPL-visible command is defined here exactly once. All consumers
// (welcome, help, completer, keybindings, executor) derive their data
// from this module.
//
// Leaf module -- no internal repl/ imports.

import type { StringKey } from "../i18n/catalog.ts";
import { t } from "../i18n/index.ts";

// ---------------------------------------------------------------------------
// Group constants (prevent typos in group assignment)
// ---------------------------------------------------------------------------
const G_BASICS = "repl.help.group.basics" as const satisfies StringKey;
const G_TEXT_TRANSLATION = "repl.help.group.text_translation" as const satisfies StringKey;
const G_EVALUATION = "repl.help.group.evaluation" as const satisfies StringKey;
const G_SCORE = "repl.help.group.score" as const satisfies StringKey;
const G_ANNOTATE = "repl.help.group.annotate" as const satisfies StringKey;
const G_CONFIG = "repl.help.group.config" as const satisfies StringKey;
const G_SYSTEM = "repl.help.group.system" as const satisfies StringKey;

/** Defines the display order of help groups. */
const GROUP_ORDER: readonly StringKey[] = [
  G_BASICS,
  G_TEXT_TRANSLATION,
  G_EVALUATION,
  G_SCORE,
  G_ANNOTATE,
  G_CONFIG,
  G_SYSTEM,
];

// ---------------------------------------------------------------------------
// Help filter (used by showHelp to select display mode)
// ---------------------------------------------------------------------------

/** Discriminated filter for help display mode. */
export type HelpFilter =
  | { readonly mode: "groups"; readonly groups: readonly StringKey[] }
  | { readonly mode: "single"; readonly name: string };

/** Parent commands that span multiple help groups. */
const PARENT_GROUPS: Readonly<Partial<Record<string, readonly StringKey[]>>> = {
  translate: [G_TEXT_TRANSLATION],
  evaluate: [G_EVALUATION],
  eval: [G_EVALUATION],
  score: [G_SCORE],
};

/** Commands where -h is NOT help (e.g. evaluate uses -h for --hypothesis). */
export const HELP_H_BLACKLIST: ReadonlySet<string> = new Set(["eval", "evaluate"]);

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

/** Single welcome-screen row: syntax (col 1) + example (col 3). */
export interface WelcomeRow {
  /** Short syntax for column 1 (appended to command name) */
  readonly syntax: string;
  /** Concrete example for column 3 */
  readonly example: string;
  /** Optional per-row hint override (takes precedence over WelcomeEntry.hintKey) */
  readonly hintKey?: StringKey;
}

/** Welcome-screen entry for a command (may span multiple rows). */
export interface WelcomeEntry {
  /** i18n key for description column (shown only on first row) */
  readonly hintKey: StringKey;
  /** One or more rows with distinct syntax + example */
  readonly rows: readonly WelcomeRow[];
}

/** Tab-completion template segment: [prefix, placeholder | null]. */
export type TemplateSegment = readonly [string, string | null];

/** Subcommand shown in detailed help for a parent command. */
export interface RelatedCommand {
  /** Full syntax: 'eval "file" [-m "metrics"]' */
  readonly syntax: string;
  /** i18n key for description */
  readonly descKey: StringKey;
}

/** Option description for help display. */
export interface OptionEntry {
  /** Flag syntax: '-s, --source "lang"', "--qe", '--out "dir"' */
  readonly flag: string;
  /** i18n key for option description */
  readonly descKey: StringKey;
}

/** Single REPL command definition. */
export interface ReplCommand {
  /** REPL command name: "eval", "t" */
  readonly name: string;
  /** Commander.js dispatch path or null for builtins */
  readonly commanderPath: string | null;
  /** Display syntax: '-s "src" -h "hyp" -r "ref"' */
  readonly argsSyntax: string;
  /** Group constant, e.g. G_EVALUATION */
  readonly group: StringKey;
  /** i18n key override; default: "repl.cmd.{name}" */
  readonly descKey?: StringKey;
  /** Tab-completion template segments */
  readonly template?: readonly TemplateSegment[];
  /** Welcome screen entry */
  readonly welcome?: WelcomeEntry;
  /** CLI usage examples (shown in `prompsit <cmd> --help` epilogs) */
  readonly cliExamples?: readonly string[];
  /** REPL usage examples (shown on help page without "prompsit" prefix) */
  readonly replExamples?: readonly string[];
  /** Option descriptions shown in unified help */
  readonly options?: readonly OptionEntry[];
  /** Hidden from overview help (aliases) */
  readonly hidden?: boolean;
  /** Parent command name this is an alias of */
  readonly aliasOf?: string;
  /** Subcommands shown in detailed help */
  readonly relatedCommands?: readonly RelatedCommand[];
  /** Boolean flags that don't consume the next token as a value (e.g. --qe, --force) */
  readonly boolFlags?: readonly string[];
}

// ---------------------------------------------------------------------------
// COMMANDS -- the single source of truth
// ---------------------------------------------------------------------------
export const COMMANDS: readonly ReplCommand[] = [
  // -- Basics --------------------------------------------------------------
  {
    name: "login",
    commanderPath: "login",
    argsSyntax: '--account "EMAIL" --secret "SECRET"',
    group: G_BASICS,
    template: [
      ['-a "', "EMAIL"],
      ['" -s "', "SECRET"],
      ['"', null],
    ],
    welcome: {
      hintKey: "repl.welcome.login_hint",
      rows: [{ syntax: '-a "EMAIL" -s "SECRET"', example: 'login -a "EMAIL" -s "SECRET"' }],
    },
    options: [
      { flag: '-a, --account "EMAIL"', descKey: "repl.opt.account" },
      { flag: '-s, --secret "SECRET"', descKey: "repl.opt.secret" },
    ],
    cliExamples: [
      "prompsit login                     # Open contact page",
      'prompsit login -a "EMAIL" -s "SECRET"   # Login with credentials',
    ],
    replExamples: ['login -a "EMAIL" -s "SECRET"'],
  },
  {
    name: "logout",
    commanderPath: "logout",
    argsSyntax: "",
    group: G_BASICS,
  },
  {
    name: "exit",
    commanderPath: null,
    argsSyntax: "",
    group: G_BASICS,
  },
  {
    name: "quit",
    commanderPath: null,
    argsSyntax: "",
    group: G_BASICS,
    hidden: true,
    aliasOf: "exit",
  },
  {
    name: "q",
    commanderPath: null,
    argsSyntax: "",
    group: G_BASICS,
    hidden: true,
    aliasOf: "exit",
    descKey: "repl.cmd.q",
  },
  {
    name: "help",
    commanderPath: null,
    argsSyntax: "[command]",
    group: G_BASICS,
  },
  {
    name: "?",
    commanderPath: null,
    argsSyntax: "[command]",
    group: G_BASICS,
    hidden: true,
    aliasOf: "help",
    descKey: "repl.cmd.help_alias",
  },

  // -- Config --------------------------------------------------------------
  {
    name: "config",
    commanderPath: "config",
    argsSyntax: "[subcommand|key] [value]",
    group: G_CONFIG,
    boolFlags: ["--force"],
    relatedCommands: [
      { syntax: "config", descKey: "repl.cmd.config_tui" },
      { syntax: "config show", descKey: "repl.cmd.config_show" },
      { syntax: 'config "key"', descKey: "repl.cmd.config_get" },
      { syntax: 'config "key" "value"', descKey: "repl.cmd.config_set" },
      { syntax: 'config api-url ["preset_or_url"]', descKey: "repl.cmd.config_api_url" },
      { syntax: "config reset [--force]", descKey: "repl.cmd.config_reset" },
      { syntax: "config path", descKey: "repl.cmd.config_path" },
    ],
    cliExamples: [
      "prompsit config show",
      'prompsit config "api-base-url"',
      'prompsit config "api-base-url" "https://my-server.com"',
      'prompsit config api-url "test"',
    ],
    replExamples: [
      "config show",
      'config "api-base-url"',
      'config "api-base-url" "https://my-server.com"',
      'config api-url "test"',
    ],
  },
  {
    name: "language",
    commanderPath: "config language",
    argsSyntax: "[code]",
    group: G_CONFIG,
    cliExamples: ['prompsit language "es"', 'prompsit language "en"', "prompsit config language"],
    replExamples: ['language "es"'],
  },

  // -- Text Translation ----------------------------------------------------
  {
    name: "translate",
    commanderPath: "translate",
    argsSyntax: '"text"|@"file" -s "lang" -t "lang" [--qe] [--formats] [--languages]',
    group: G_TEXT_TRANSLATION,
    template: [
      ['"', "text"],
      ['" -s "', "src"],
      ['" -t "', "tgt"],
      ['"', null],
    ],
    welcome: {
      hintKey: "repl.welcome.translate_hint",
      rows: [
        { syntax: '"text" -s "en" -t "es"', example: 'translate "Hello" -s "en" -t "es"' },
        {
          syntax: '@"file" -s "en" -t "es"',
          example: '@"~/.prompsit/examples/translate/sample.txt" -s "en" -t "es"',
          hintKey: "repl.welcome.translate_file_hint",
        },
      ],
    },
    boolFlags: ["--qe", "--languages", "-l", "--formats"],
    options: [
      { flag: '-s, --source "lang"', descKey: "repl.opt.source" },
      { flag: '-t, --target "lang"', descKey: "repl.opt.target" },
      { flag: "--qe", descKey: "repl.opt.qe" },
      { flag: "-l, --languages", descKey: "repl.opt.languages" },
      { flag: '--out "dir"', descKey: "repl.opt.output" },
      { flag: '--output-format "fmt"', descKey: "repl.opt.output_format" },
      { flag: "--formats", descKey: "repl.opt.formats" },
    ],
    cliExamples: [
      'prompsit translate "Hello world" -s "en" -t "es"',
      'prompsit translate "Hello" "World" -s "en" -t "es"',
      'prompsit translate "Hello" -s "en" -t "es" --qe',
      "prompsit translate --languages",
      'prompsit translate --languages -s "en"',
      'prompsit translate @"~/.prompsit/examples/translate/sample.txt" -s "en" -t "es"',
      'prompsit translate @"~/.prompsit/examples/translate/" -s "en" -t "es" --out "./translated/"',
      "prompsit translate --formats",
    ],
    replExamples: [
      '"Hello world" -s "en" -t "es"',
      '"Hello" "Good morning" "Thank you" -s "en" -t "es"',
      't "Hello" -s "en" -t "es" --qe',
      'translate @"~/.prompsit/examples/translate/sample.txt" -s "en" -t "es"',
      'translate @"~/.prompsit/examples/translate/" -s "en" -t "es" --out "./translated/"',
      "translate --languages",
      "translate --formats",
    ],
  },
  {
    name: "t",
    commanderPath: "translate",
    argsSyntax: '"text"|@"file" -s "lang" -t "lang" [--qe] [--formats] [--languages]',
    group: G_TEXT_TRANSLATION,
    hidden: true,
    aliasOf: "translate",
    template: [
      ['"', "text"],
      ['" -s "', "src"],
      ['" -t "', "tgt"],
      ['"', null],
    ],
  },
  // -- Evaluation ----------------------------------------------------------
  {
    name: "eval",
    commanderPath: "evaluate",
    argsSyntax: '-s "src" -h "hyp" -r "ref" | "file.tsv" | @"file" [-m "metrics"] [--formats]',
    group: G_EVALUATION,
    template: [
      ['@"', "file"],
      ['" -m "', "metrics"],
      ['"', null],
    ],
    welcome: {
      hintKey: "repl.welcome.eval_hint",
      rows: [
        {
          syntax: '-s "src" -h "hyp" -r "ref"',
          example: 'eval -s "Hello" -h "Hola" -r "Hola"',
        },
        {
          syntax: '@"file"',
          example: 'eval @"~/.prompsit/examples/evaluate/sample.tmx" -m "bleu,chrf"',
          hintKey: "repl.welcome.eval_file_hint",
        },
      ],
    },
    boolFlags: ["--formats"],
    options: [
      { flag: '-s, --source "src"', descKey: "repl.opt.source_text" },
      { flag: '-h, --hypothesis "hyp"', descKey: "repl.opt.hypothesis" },
      { flag: '-r, --reference "ref"', descKey: "repl.opt.reference" },
      { flag: '-m, --metrics "metrics"', descKey: "repl.opt.metrics" },
      { flag: '--out "dir"', descKey: "repl.opt.output" },
      { flag: '--output-format "fmt"', descKey: "repl.opt.output_format" },
      { flag: "--formats", descKey: "repl.opt.formats" },
    ],
    cliExamples: [
      'prompsit eval -s "Hello" -h "Hola" -r "Hola"',
      'prompsit eval -s "Hello" -h "Hola" -r "Hola" -m "bleu,chrf,metricx,comet"',
      'prompsit eval @"~/.prompsit/examples/evaluate/sample.tmx" -m "bleu,chrf"',
      'prompsit eval @"~/.prompsit/examples/evaluate/" -m "bleu,chrf" --out "./results/"',
      "prompsit eval --formats",
    ],
    replExamples: [
      'eval -s "Hello" -h "Hola" -r "Hola"',
      'eval -s "Hello" -h "Hola" -r "Hola" -m "bleu,chrf,metricx,comet"',
      'eval @"~/.prompsit/examples/evaluate/sample.tmx" -m "bleu,chrf"',
      'eval @"~/.prompsit/examples/evaluate/" -m "bleu,chrf" --out "./results/"',
      "eval --formats",
    ],
  },
  {
    name: "evaluate",
    commanderPath: "evaluate",
    argsSyntax: '-s "src" -h "hyp" -r "ref" | "file.tsv" | @"file" [-m "metrics"] [--formats]',
    group: G_EVALUATION,
    hidden: true,
    aliasOf: "eval",
  },

  // -- Score ---------------------------------------------------------------
  {
    name: "score",
    commanderPath: "score",
    argsSyntax:
      '@"files/dir..." [-s "lang"] [--target "path/dir"] [--output-format "fmt"] [--out "dir"] [--formats] [--languages]',
    group: G_SCORE,
    boolFlags: ["--formats", "--languages", "-l"],
    template: [
      ['@"', "file"],
      ['"', null],
    ],
    welcome: {
      hintKey: "repl.welcome.score_hint",
      rows: [
        {
          syntax: '@"file"',
          example: 'score @"~/.prompsit/examples/score/sample.tmx"',
        },
      ],
    },
    options: [
      { flag: '-s, --source-lang "lang"', descKey: "repl.opt.source_lang" },
      { flag: '-t, --target "path/dir"', descKey: "repl.opt.target" },
      { flag: '--output-format "fmt"', descKey: "repl.opt.output_format" },
      { flag: '--out "dir"', descKey: "repl.opt.output" },
      { flag: "--formats", descKey: "repl.opt.formats" },
      { flag: "-l, --languages", descKey: "repl.opt.languages" },
    ],
    cliExamples: [
      'prompsit score @"~/.prompsit/examples/score/sample.tmx"',
      'prompsit score @"~/.prompsit/examples/score/sample.tmx" -s "en"',
      'prompsit score @"./source_dir/" -t @"./target_dir/" -s "en"',
      'prompsit score @"~/.prompsit/examples/score/sample.tmx" --output-format "tsv"',
      'prompsit score @"~/.prompsit/examples/score/sample.tmx" --out "./scored/"',
      "prompsit score --formats",
      "prompsit score --languages",
    ],
    replExamples: [
      'score @"~/.prompsit/examples/score/sample.tmx"',
      'score @"~/.prompsit/examples/score/sample.tmx" -s "en"',
      'score @"./source_dir/" -t @"./target_dir/" -s "en"',
      'score @"~/.prompsit/examples/score/sample.tmx" --output-format "tsv"',
      "score --formats",
      "score --languages",
    ],
  },

  // -- Annotate ------------------------------------------------------------
  {
    name: "annotate",
    commanderPath: "annotate",
    argsSyntax: '@"files/dir..." -l "code" [--metadata "options"] [--out "dir"] [--formats]',
    group: G_ANNOTATE,
    boolFlags: ["--formats", "--metadata"],
    template: [
      ['@"', "file"],
      ['" -l "', "lang"],
      ['"', null],
    ],
    welcome: {
      hintKey: "repl.welcome.annotate_hint",
      rows: [
        {
          syntax: '@"file" -l "lang"',
          example: 'annotate @"~/.prompsit/examples/annotate/sample.jsonl" -l "en"',
        },
      ],
    },
    options: [
      { flag: '-l, --lang "code"', descKey: "repl.opt.source" },
      { flag: '--metadata "options"', descKey: "repl.opt.metadata" },
      { flag: '--out "dir"', descKey: "repl.opt.output" },
      { flag: "--formats", descKey: "repl.opt.formats" },
    ],
    cliExamples: [
      'prompsit annotate @"~/.prompsit/examples/annotate/sample.jsonl" -l "en"',
      'prompsit annotate @"~/.prompsit/examples/annotate/sample.jsonl" -l "en" --metadata "lid,docscorer"',
      'prompsit annotate @"~/.prompsit/examples/annotate/sample.jsonl" -l "en" --out "./annotated/"',
      "prompsit annotate --formats",
      "prompsit annotate --metadata",
    ],
    replExamples: [
      'annotate @"~/.prompsit/examples/annotate/sample.jsonl" -l "en"',
      'annotate @"~/.prompsit/examples/annotate/sample.jsonl" -l "en" --metadata "lid,docscorer"',
      'annotate @"~/.prompsit/examples/annotate/sample.jsonl" -l "en" --out "./annotated/"',
      "annotate --formats",
      "annotate --metadata",
    ],
  },

  // -- System --------------------------------------------------------------
  {
    name: "health",
    commanderPath: "health",
    argsSyntax: "",
    group: G_SYSTEM,
  },
  {
    name: "usage",
    commanderPath: "usage",
    argsSyntax: "",
    group: G_SYSTEM,
  },
  {
    name: "copy-curl",
    commanderPath: null,
    argsSyntax: "",
    group: G_SYSTEM,
    hidden: true,
  },
  {
    name: "clear",
    commanderPath: null,
    argsSyntax: "",
    group: G_SYSTEM,
  },
] as const;

// ---------------------------------------------------------------------------
// Indexes (computed once at import time)
// ---------------------------------------------------------------------------
const _byName = new Map<string, ReplCommand>(COMMANDS.map((c) => [c.name, c]));

if (_byName.size !== COMMANDS.length) {
  const seen = new Set<string>();
  for (const c of COMMANDS) {
    if (seen.has(c.name)) throw new Error(`Duplicate REPL command: "${c.name}"`);
    seen.add(c.name);
  }
}

// ---------------------------------------------------------------------------
// Accessor functions
// ---------------------------------------------------------------------------

/** name -> commanderPath for routable commands (replaces CMD_MAP). */
export function getCmdMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of COMMANDS) {
    if (c.commanderPath) map.set(c.name, c.commanderPath);
  }
  return map;
}

/** name -> argsSyntax for all commands. */
export function getCommandArgs(): Map<string, string> {
  return new Map(COMMANDS.map((c) => [c.name, c.argsSyntax]));
}

/** name -> tab-completion template. */
export function getTemplates(): Map<string, readonly TemplateSegment[]> {
  const map = new Map<string, readonly TemplateSegment[]>();
  for (const c of COMMANDS) {
    if (c.template) map.set(c.name, c.template);
  }
  return map;
}

/** name -> translatedDescription for fuzzy dropdown (excludes hidden aliases). */
export function getDropdownCommands(): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of COMMANDS) {
    if (!c.hidden) {
      map.set(c.name, t(c.descKey ?? (`repl.cmd.${c.name}` as StringKey)));
    }
  }
  return map;
}

/** [cmdStr, translatedHint, example] for welcome screen. Multi-row entries are flattened. */
export function getWelcomeRows(): [string, string, string][] {
  const rows: [string, string, string][] = [];
  for (const c of COMMANDS) {
    if (c.welcome) {
      const defaultDesc = t(c.welcome.hintKey);
      for (const row of c.welcome.rows) {
        const cmdStr = `${c.name} ${row.syntax}`.trim();
        rows.push([cmdStr, row.hintKey ? t(row.hintKey) : defaultDesc, row.example]);
      }
    }
  }
  return rows;
}

/**
 * Grouped commands for help overview.
 * Groups in defined order, commands sorted alphabetically within each group.
 * Hidden commands (aliases) are excluded.
 */
export function getHelpGroups(): Map<string, string[]> {
  const grouped = Map.groupBy(
    COMMANDS.filter((c) => !c.hidden),
    (c) => c.group
  );
  // Output in defined group order, commands sorted alphabetically
  const result = new Map<string, string[]>();
  for (const groupKey of GROUP_ORDER) {
    const cmds = grouped.get(groupKey);
    if (cmds) {
      result.set(
        t(groupKey),
        cmds.map((c) => c.name).toSorted((a, b) => a.localeCompare(b))
      );
    }
  }
  return result;
}

/** Get alias names for a command (commands where aliasOf === name). */
export function getAliasesFor(name: string): string[] {
  const aliases: string[] = [];
  for (const c of COMMANDS) {
    if (c.aliasOf === name) aliases.push(c.name);
  }
  return aliases;
}

/**
 * Resolve user-typed command to a help filter.
 * Parent keywords → multi-group display. Aliases resolve through canonical.
 * Known command → single-command display. Unknown → undefined (show all).
 */
export function resolveHelpFilter(input: string): HelpFilter | undefined {
  const pg = PARENT_GROUPS[input];
  if (pg) return { mode: "groups", groups: pg };
  const cmd = _byName.get(input);
  if (!cmd) return undefined;
  const canonical = cmd.aliasOf ?? cmd.name;
  // Alias may resolve to a parent: t → translate → groups
  const cpg = PARENT_GROUPS[canonical];
  if (cpg) return { mode: "groups", groups: cpg };
  return { mode: "single", name: canonical };
}

/**
 * Resolve explicit two-word subcommand to its REPL command name.
 * Resolve explicit two-word command to its REPL command name.
 */
export function resolveSubcommandName(fullCmd: string): string | undefined {
  if (_byName.has(fullCmd)) return fullCmd;
  for (const c of COMMANDS) {
    if (c.commanderPath === fullCmd) return c.name;
  }
  return undefined;
}

/** Collect all boolean flags declared across REPL commands. */
export function getAllBoolFlags(): ReadonlySet<string> {
  const flags = new Set<string>();
  for (const c of COMMANDS) {
    if (c.boolFlags) {
      for (const f of c.boolFlags) flags.add(f);
    }
  }
  return flags;
}

/** Build epilog with CLI examples by Commander.js command path (e.g. "translate"). */
export function buildEpilogByCommanderPath(cmdPath: string): string | null {
  const cmd = COMMANDS.find((c) => c.commanderPath === cmdPath);
  if (!cmd?.cliExamples?.length) return null;
  const lines = ["", t("repl.help.label.examples")];
  for (const ex of cmd.cliExamples) {
    lines.push(`  ${ex}`);
  }
  return lines.join("\n");
}
