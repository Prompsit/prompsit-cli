// Terminal output port (Ports & Adapters).
//
// Port:     Terminal interface — contract for all user-facing output.
// Adapters: CliTerminal  — real stdout/stderr for CLI mode.
//           ReplTerminal — routes via OutputBridge to pi-mono TUI.
//
// Singleton proxy `terminal` forwards to the current backing implementation.
// CLI mode (default): CliTerminal.
// REPL mode:          setTerminal(new ReplTerminal(outputBridge)) in loop.ts.

import chalk, { chalkStderr } from "chalk";
import { renderTable, type TableModel } from "./tables/index.ts";
import type { OutputSinkItem } from "./output-events.ts";

// Minimal interface for the output bridge (avoids cross-layer import cycle).
interface WritableBridge {
  write(content: OutputSinkItem): void;
}

// ─── Port ────────────────────────────────────────────────────────────────────

export interface Terminal {
  // stdout — useful command result
  line(text: string): void;
  table(model: TableModel): void;

  // stderr — diagnostics / status / progress / hints
  info(message: string): void;
  dim(message: string): void;
  warn(message: string): void;
  success(message: string): void;
  error(code: string, message: string, hint?: string): void;
  prompt(text: string): void; // no trailing \n (interactive prompt)
}

// ─── CLI Adapter ─────────────────────────────────────────────────────────────

export class CliTerminal implements Terminal {
  line(text: string): void {
    process.stdout.write(text + "\n");
  }

  table(model: TableModel): void {
    process.stdout.write(renderTable(model) + "\n");
  }

  info(message: string): void {
    process.stderr.write(message + "\n");
  }

  dim(message: string): void {
    process.stderr.write(chalkStderr.dim(message) + "\n");
  }

  warn(message: string): void {
    process.stderr.write(chalkStderr.yellow(message) + "\n");
  }

  success(message: string): void {
    process.stderr.write(chalkStderr.green(message) + "\n");
  }

  error(_code: string, message: string, hint?: string): void {
    process.stderr.write(chalkStderr.red(`Error: ${message}\n`));
    if (hint) {
      process.stderr.write(chalkStderr.yellow(`Hint: ${hint}\n`));
    }
  }

  prompt(text: string): void {
    process.stderr.write(text); // no newline — caller controls flow
  }
}

// ─── REPL Adapter ─────────────────────────────────────────────────────────────

export class ReplTerminal implements Terminal {
  private readonly bridge: WritableBridge;

  constructor(bridge: WritableBridge) {
    this.bridge = bridge;
  }

  line(text: string): void {
    this.bridge.write({
      kind: "text",
      timestamp: Date.now(),
      text,
      stream: "stdout",
      level: "info",
    });
  }

  table(model: TableModel): void {
    this.bridge.write({
      kind: "table",
      timestamp: Date.now(),
      table: model,
      stream: "stdout",
      level: "info",
    });
  }

  info(message: string): void {
    this.bridge.write({
      kind: "system",
      timestamp: Date.now(),
      text: message,
      stream: "stderr",
      level: "info",
    });
  }

  dim(message: string): void {
    this.bridge.write({
      kind: "system",
      timestamp: Date.now(),
      text: chalk.dim(message),
      stream: "stderr",
      level: "info",
    });
  }

  warn(message: string): void {
    this.bridge.write({
      kind: "system",
      timestamp: Date.now(),
      text: chalk.yellow(message),
      stream: "stderr",
      level: "info",
    });
  }

  success(message: string): void {
    this.bridge.write({
      kind: "system",
      timestamp: Date.now(),
      text: chalk.green(message),
      stream: "stderr",
      level: "success",
    });
  }

  error(_code: string, message: string, hint?: string): void {
    const text =
      chalk.red(`Error: ${message}`) + (hint ? "\n" + chalk.yellow(`Hint: ${hint}`) : "");
    this.bridge.write({
      kind: "system",
      timestamp: Date.now(),
      text,
      stream: "stderr",
      level: "error",
    });
  }

  prompt(text: string): never {
    throw new Error(`terminal.prompt("${text}") called in REPL mode`);
  }
}

// ─── Singleton proxy ──────────────────────────────────────────────────────────

let _impl: Terminal = new CliTerminal();

export const terminal: Terminal = {
  line: (t) => {
    _impl.line(t);
  },
  table: (m) => {
    _impl.table(m);
  },
  info: (m) => {
    _impl.info(m);
  },
  dim: (m) => {
    _impl.dim(m);
  },
  warn: (m) => {
    _impl.warn(m);
  },
  success: (m) => {
    _impl.success(m);
  },
  error: (c, m, h) => {
    _impl.error(c, m, h);
  },
  prompt: (t) => {
    _impl.prompt(t);
  },
};

export function setTerminal(t: Terminal): void {
  _impl = t;
}

export function clearTerminal(): void {
  _impl = new CliTerminal();
}
