/**
 * CI gate: forbid direct process.stdout/stderr writes and console.* calls in src/.
 *
 * Allowlist (only these files may contain raw I/O):
 *   - src/output/terminal.ts  (CliTerminal low-level adapter)
 *   - src/logging/console-handler.ts  (isolated logging channel)
 *
 * Exit code 1 if any violation found.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "src");

const ALLOWLIST = new Set([
  "src/output/terminal.ts",
  "src/logging/console-handler.ts",
  "src/logging/setup.ts",
  "src/repl/controller.ts",
  "src/runtime/clipboard.ts",
  "src/cli/prompts.ts",
]);

const FORBIDDEN = [
  "process.stdout.write(",
  "process.stderr.write(",
  "console.log(",
  "console.error(",
  "console.warn(",
  "console.info(",
];

function* walkTs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTs(full);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      yield full;
    }
  }
}

let violations = 0;

for (const filePath of walkTs(SRC)) {
  const rel = relative(ROOT, filePath).replace(/\\/g, "/");
  if (ALLOWLIST.has(rel)) continue;

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip single-line comments
    if (line.trimStart().startsWith("//")) continue;

    for (const pattern of FORBIDDEN) {
      if (line.includes(pattern)) {
        console.error(`VIOLATION  ${rel}:${i + 1}  — ${pattern}`);
        violations++;
      }
    }
  }
}

if (violations === 0) {
  console.log("check:terminal-io  OK — no direct I/O calls outside allowlist");
  process.exit(0);
} else {
  console.error(`\ncheck:terminal-io  FAILED — ${violations} violation(s) found`);
  console.error("Route all output through terminal.* (src/output/terminal.ts)");
  process.exit(1);
}
