#!/usr/bin/env node
// See API-456, API-480, API-486, API-491, API-498: Signal handling, exit codes, and exitOverride
//
// Entry point only — program definition lives in program.ts to avoid ESM TLA deadlock.
// When REPL is running, this module has a pending top-level await (runRepl never resolves),
// so dynamic import("./index.ts") would hang. Keeping program in a separate sync module
// lets executor.ts import it without deadlock.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CommanderError } from "@commander-js/extra-typings";
import { setupSignalHandlers } from "./cli/signals.ts";
import { setupLogging, shutdownLogging } from "./logging/setup.ts";
import { t } from "./i18n/index.ts";
import { fmtCmd } from "./runtime/execution-mode.ts";
import { program } from "./program.ts";
import { terminal } from "./output/terminal.ts";
import { setExitCode } from "./cli/exit.ts";

// Only parse when run as entry point (not when imported by tests)
const stripExt = (p: string) => p.replace(/\.(ts|js)$/, "");
const isEntryPoint =
  stripExt(fileURLToPath(import.meta.url)) === stripExt(realpathSync(process.argv[1] ?? ""));
if (isEntryPoint) {
  setupSignalHandlers();

  // Pre-scan argv for --verbose before logging init (captures ALL startup logs)
  const userArgs = process.argv.slice(2);
  const isVerbose = userArgs.includes("--verbose") || userArgs.includes("-v");
  setupLogging(isVerbose ? "debug" : undefined);
  process.on("exit", shutdownLogging);

  // Skill sync: deploy AI agent skills on launch (skip --help/--version quick-exit paths)
  const isQuickExit = process.argv.some(
    (a) => a === "--help" || a === "-h" || a === "--version" || a === "-V"
  );
  if (!isQuickExit) {
    try {
      const { runSkillSync } = await import("./cli/skill-sync.ts");
      await runSkillSync();
    } catch {
      /* skill sync is non-critical — never block startup */
    }
  }

  // See API-503: No-args detection — enter REPL mode when no command specified
  // Quick-exit flags (--help, --version) must go through Commander.js, not REPL.
  // Other flags (--verbose) alone should not prevent REPL entry.
  const hasCommand = isQuickExit || userArgs.some((a) => !a.startsWith("-"));

  if (hasCommand) {
    // Wrap in trace context: single trace_id for entire CLI command execution
    const { traceStore } = await import("./logging/index.ts");
    const { generateTraceId } = await import("./api/trace.ts");
    const traceId = generateTraceId();
    await traceStore.run(traceId, async () => {
      try {
        await program.parseAsync(process.argv);
      } catch (error: unknown) {
        // CommanderError from exitOverride — already handled (exitCode set)
        // --help and --version throw with exitCode 0
        if (error instanceof CommanderError) {
          if (error.exitCode === 0) {
            setExitCode(0);
          } else {
            terminal.warn(t("cli.usage_error.hint", { cmd: fmtCmd("--help") }));
          }
        } else {
          throw error;
        }
      }
    });
  } else {
    const { runRepl } = await import("./repl/index.ts");
    await runRepl();
  }
}

export { program } from "./program.ts";
