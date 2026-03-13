// See API-502: REPL command execution - dispatch user input to Commander.js.
//
// program: lazy-cached dynamic import to avoid circular (index.ts → repl → program).

import { homedir } from "node:os";
import { join } from "node:path";
import { CommanderError } from "@commander-js/extra-typings";
import { APIError, CancelledError } from "../errors/contracts.ts";
import { classifyError } from "../errors/catalog.ts";
import { presentError } from "../commands/error-presenter.ts";
import { t } from "../i18n/index.ts";
import { terminal } from "../output/terminal.ts";
import { getLogger, traceStore } from "../logging/index.ts";
import { clearExitCode } from "../cli/exit.ts";
import { generateTraceId } from "../api/trace.ts";
import { validateArgOptionOrder } from "../cli/arg-order.ts";
import { showHelp } from "./help.ts";
import {
  getCmdMap,
  getTemplates,
  getCommandArgs,
  getAllBoolFlags,
  resolveHelpFilter,
  resolveSubcommandName,
  HELP_H_BLACKLIST,
} from "./registry.ts";
import { reset as resetAbort, getSignal } from "./core/abort.ts";
import type { ExecuteResult } from "./core/progress-types.ts";
import { runWithAbortSignal } from "../runtime/request-context.ts";
import { getRawCurl } from "./ui/curl-store.ts";
import { isCurlEnabled } from "../api/curl.ts";
import { setClipboardText, writeOsc52 } from "../runtime/clipboard.ts";

const log = getLogger(import.meta.url);

// Lazy-cached bool flags (sourced from registry -- single source of truth)
let _boolFlags: ReadonlySet<string> | null = null;
function getBoolFlags(): ReadonlySet<string> {
  _boolFlags ??= getAllBoolFlags();
  return _boolFlags;
}

// Lazy-cached program (deferred import to avoid circular: index.ts → repl → program)
let _program: typeof import("../program.ts") | null = null;
async function getProgram() {
  _program ??= await import("../program.ts");
  return _program.program;
}

// Lazy-cached command map
let _cmdMap: Map<string, string> | null = null;

function getMap(): Map<string, string> {
  _cmdMap ??= getCmdMap();
  return _cmdMap;
}

/**
 * Parse input string into tokens, respecting quotes.
 * Handles double-quoted strings and escaped characters.
 * @internal Exported for unit tests only.
 */
export function parseInput(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let escaped = false;

  for (const ch of text) {
    if (escaped) {
      // Inside quotes: only \" and \\ are special; everything else keeps the backslash
      if (ch !== '"' && ch !== "\\") current += "\\";
      current += ch;
      escaped = false;
    } else if (ch === "\\" && inQuote) {
      escaped = true;
    } else if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if (!inQuote && (ch === " " || ch === "\t")) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

/**
 * Check if a token is properly quoted.
 * Accepts: "value", @"value" (file prefix).
 */
function isQuotedToken(p: string): boolean {
  if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) return true;
  return p.startsWith('@"') && p.endsWith('"') && p.length >= 3;
}

/**
 * Find first unquoted value in parsed tokens.
 * Checks both positional args and option values (-x "val").
 * Returns the unquoted token or null if all valid.
 */
function findUnquotedValue(
  parts: readonly string[],
  skip: number,
  boolFlags: ReadonlySet<string>
): string | null {
  let expectValue = false;
  for (let i = skip; i < parts.length; i++) {
    const p = parts[i];
    if (expectValue) {
      if (!isQuotedToken(p)) return p;
      expectValue = false;
      continue;
    }
    if (p.startsWith("-")) {
      if (!boolFlags.has(p)) expectValue = true;
      continue;
    }
    // Positional arg — must be quoted (standard or @-prefixed)
    if (!isQuotedToken(p)) return p;
  }
  return null;
}

/**
 * Strip surrounding quotes from a token.
 * Handles standard "value" and prefixed @"value".
 */
function unquote(token: string): string {
  if (token.length >= 2 && token.startsWith('"') && token.endsWith('"')) {
    return token.slice(1, -1);
  }
  // @"path" → @path (strip quotes, preserve prefix)
  if (token.startsWith('@"') && token.endsWith('"') && token.length >= 3) {
    return "@" + token.slice(2, -1);
  }
  return token;
}

/**
 * Expand leading tilde (~) to user home directory.
 * @internal Exported for unit tests only.
 */
export function expandTilde(arg: string): string {
  // Strip @ file prefix before checking tilde (e.g. @~/file → @/home/user/file)
  const hasFilePrefix = arg.startsWith("@") && arg.length > 1;
  const toExpand = hasFilePrefix ? arg.slice(1) : arg;

  if (toExpand.startsWith("~/") || toExpand.startsWith("~\\")) {
    const expanded = join(homedir(), toExpand.slice(2));
    return hasFilePrefix ? "@" + expanded : expanded;
  }
  if (toExpand === "~") return hasFilePrefix ? "@" + homedir() : homedir();
  return arg;
}

// --- Command resolution ---

interface ResolvedReplCommand {
  fullArgs: string[];
  fullCmd: string;
  textTokenSkip: number;
}

/**
 * Resolve REPL input to Commander.js command path.
 * Handles alias mapping and implicit translate (quoted text → translate).
 * @ prefix is preserved in args — flat commands handle mode detection internally.
 * Returns ExecuteResult for built-in/unknown input (caller already handled).
 */
function resolveReplCommand(
  cmd: string,
  args: string[],
  parts: string[],
  text: string
): ResolvedReplCommand | ExecuteResult {
  const cmdMap = getMap();
  let fullArgs: string[];
  let fullCmd: string | undefined;
  let textTokenSkip = -1;

  fullCmd = cmdMap.get(cmd);
  if (fullCmd !== undefined) {
    // Known command — preserve @ in args for action handler's mode detection
    fullArgs = [...fullCmd.split(/\s+/), ...args.map(unquote)];
    if (fullCmd === "translate") textTokenSkip = 1;
  } else if (/^@?"/u.test(text.trimStart())) {
    // Implicit translate: "text" or @"file" — @ preserved for action handler
    fullArgs = ["translate", ...parts.map(unquote)];
    fullCmd = "translate";
    textTokenSkip = 0;
  } else {
    // Unknown command — check for help, else warn
    if (args.includes("--help") || args.includes("-h")) {
      const filter = resolveHelpFilter(cmd);
      if (filter) {
        showHelp(filter);
        return { outcome: "continue" };
      }
    }
    terminal.warn(`${t("repl.unknown_command")} ${cmd}`);
    terminal.dim(t("repl.help_tip", { cmd: "help" }));
    return { outcome: "continue" };
  }

  return { fullArgs, fullCmd, textTokenSkip };
}

/**
 * Execute a REPL command.
 * Returns ExecuteResult discriminated union to distinguish continue/exit/cancelled.
 */
export async function executeCommand(text: string): Promise<ExecuteResult> {
  const parts = parseInput(text);
  if (parts.length === 0) return { outcome: "continue" };

  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Built-in REPL commands (no Commander.js dispatch)
  if (cmd === "exit" || cmd === "quit" || cmd === "q") {
    return { outcome: "exit" };
  }

  if (cmd === "help" || cmd === "?") {
    if (args.length >= 2) {
      const twoWord = `${args[0].toLowerCase()} ${args[1].toLowerCase()}`;
      const replName = resolveSubcommandName(twoWord);
      showHelp(
        replName ? { mode: "single", name: replName } : resolveHelpFilter(args[0].toLowerCase())
      );
    } else if (args.length === 1) {
      showHelp(resolveHelpFilter(args[0].toLowerCase()));
    } else {
      showHelp();
    }
    return { outcome: "continue" };
  }

  if (cmd === "copy-curl") {
    const raw = isCurlEnabled() ? getRawCurl() : null;
    if (!raw) {
      terminal.dim(t("repl.curl_panel.no_curl"));
      return { outcome: "continue" };
    }
    const ok = await setClipboardText(raw);
    if (!ok) writeOsc52(raw);
    terminal.line(ok ? t("repl.curl_panel.copied") : t("repl.clipboard.sent_osc52"));
    return { outcome: "continue" };
  }

  if (cmd === "clear") {
    return { outcome: "cleared" };
  }

  // Bare "config" → open interactive settings overlay
  if (cmd === "config" && args.length === 0) {
    return { outcome: "settings" };
  }

  // Resolve REPL command to Commander.js path
  const resolved = resolveReplCommand(cmd, args, parts, text);
  if ("outcome" in resolved) return resolved;

  const { fullCmd } = resolved;
  let { fullArgs } = resolved;
  const { textTokenSkip } = resolved;

  // Validate that all values are quoted for templated commands
  const templates = getTemplates();
  if (templates.has(cmd)) {
    const skipIdx = textTokenSkip >= 0 ? textTokenSkip : 1;
    const unquoted = findUnquotedValue(parts, skipIdx, getBoolFlags());
    if (unquoted) {
      const syntax = getCommandArgs().get(cmd) ?? "";
      terminal.error(
        "VALIDATION",
        `"${unquoted}" -- ${t("repl.error.unquoted_value")}`,
        `Usage: ${cmd} ${syntax}`
      );
      return { outcome: "continue" };
    }
  }

  // Validate arg/option order for translate text mode (POSIX: positional args before options)
  // Skip in file mode: any arg starting with @ indicates file inputs
  if (fullCmd === "translate" && !fullArgs.some((a) => a.startsWith("@"))) {
    const violation = validateArgOptionOrder(fullArgs.slice(1), getBoolFlags());
    if (violation) {
      terminal.error(
        "ARG_ORDER",
        `"${violation}" -- ${t("repl.error.arg_order")}`,
        'Usage: translate "text1" "text2" -s lang -t lang'
      );
      return { outcome: "continue" };
    }
  }

  // Expand ~ only in @-prefixed file args and option values (not positional text)
  fullArgs = fullArgs.map((arg, i) => {
    if (arg.startsWith("@")) return expandTilde(arg);
    if (i > 0 && fullArgs[i - 1].startsWith("-")) return expandTilde(arg);
    return arg;
  });

  // Intercept --help / -h to show REPL-appropriate help.
  // -h is NOT intercepted for evaluate (uses -h for --hypothesis).
  const hasHelpFlag =
    fullArgs.includes("--help") || (!HELP_H_BLACKLIST.has(cmd) && fullArgs.includes("-h"));

  if (hasHelpFlag && fullCmd) {
    showHelp(resolveHelpFilter(cmd));
    return { outcome: "continue" };
  }

  // Dispatch to Commander.js — wrapped in trace context for correlation
  let cancelled = false;
  const traceId = generateTraceId();
  resetAbort();
  await traceStore.run(traceId, async () =>
    runWithAbortSignal(getSignal(), async () => {
      const program = await getProgram();

      // REPL context: strip "prompsit" prefix from error/usage messages
      program.name("");

      // Safety net: intercept process.exit so Commander can never kill the REPL.
      // See: https://github.com/tj/commander.js#override-exit-and-output-handling
      // > "Commander expects the callback to terminate the normal program flow,
      // >  and will call process.exit if the callback returns."
      // eslint-disable-next-line @typescript-eslint/unbound-method -- intentional: save reference to override
      const origExit = process.exit;
      process.exit = ((code?: number) => {
        throw new CommanderError(code ?? 0, "commander.exit", "");
      }) as typeof process.exit;

      try {
        log.debug("REPL dispatch", { command: fullArgs.join(" ") });
        log.debug("Commander parseAsync start");
        await program.parseAsync(["node", "", ...fullArgs]);
        log.debug("Commander parseAsync done");
      } catch (error: unknown) {
        if (error instanceof CommanderError) {
          // Commander already output the error via outputError/writeErr — nothing to print.
          // --help and --version throw with exitCode 0 (handled above via writeOut).
        } else if (error instanceof CancelledError) {
          cancelled = true;
        } else if (error instanceof APIError) {
          const presented = presentError(classifyError(error), t);
          terminal.error(presented.code, presented.message, presented.hint ?? undefined);
        } else if (error instanceof Error) {
          terminal.error("RUNTIME", error.message);
        }
        // Reset exitCode so REPL continues
        clearExitCode();
      } finally {
        process.exit = origExit;
        program.name("prompsit");
      }
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- set inside traceStore.run callback
  return cancelled ? { outcome: "cancelled" } : { outcome: "continue" };
}
