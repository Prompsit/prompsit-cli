import { createInterface } from "node:readline";
import { SelectList, type SelectItem, type SelectListTheme } from "@mariozechner/pi-tui";
import { chalkStderr } from "chalk";
import { terminal } from "../output/index.ts";

/** Guard: interactive readline input is unavailable while REPL owns raw stdin. */
function assertInteractiveInputAllowed(): void {
  if (process.stdin.isRaw) {
    throw new Error("Interactive input not available in REPL. Use flags: login -a EMAIL -s SECRET");
  }
}

/**
 * Prompt user for visible text input via readline.
 */
export function promptInput(prompt: string): Promise<string> {
  assertInteractiveInputAllowed();

  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.on("SIGINT", () => {
      rl.close();
      reject(new Error("Cancelled"));
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt user for hidden input (secret/password).
 * Uses raw mode to suppress echo on TTY and falls back to visible input for non-TTY.
 */
export function promptHidden(prompt: string): Promise<string> {
  assertInteractiveInputAllowed();

  if (!process.stdin.isTTY) {
    return promptInput(prompt);
  }

  return new Promise((resolve, reject) => {
    terminal.prompt(prompt);

    const savedRawMode = process.stdin.isRaw;
    let input = "";

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (char: string) => {
      if (char === "\u0003") {
        cleanup();
        reject(new Error("Cancelled"));
        return;
      }

      if (char === "\r" || char === "\n") {
        cleanup();
        terminal.info("");
        resolve(input);
        return;
      }

      if (char === "\u007F" || char === "\b") {
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
        return;
      }

      input += char;
    };

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(savedRawMode);
      process.stdin.pause();
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Prompt user for yes/no confirmation.
 * Returns true only for y/yes (case-insensitive).
 */
export function promptConfirm(message: string): Promise<boolean> {
  assertInteractiveInputAllowed();

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.on("SIGINT", () => {
      rl.close();
      resolve(false);
    });

    rl.question(message, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });
}

// ─── Interactive Select ──────────────────────────────────────────────────────

export interface SelectConfig {
  title: string;
  message: string;
  options: { label: string; value: string; description?: string }[];
}

const SELECT_THEME: SelectListTheme = {
  selectedPrefix: (t) => chalkStderr.bold.cyan(t),
  selectedText: (t) => chalkStderr.bold.cyan(t),
  description: (t) => chalkStderr.dim(t),
  scrollInfo: (t) => chalkStderr.dim(t),
  noMatch: (t) => chalkStderr.dim(t),
};

/**
 * Interactive select prompt using pi-tui SelectList.
 * Renders inline to stderr with arrow-key navigation.
 * Returns selected value or null if cancelled (Esc/Ctrl+C).
 */
export function promptSelect(config: SelectConfig): Promise<string | null> {
  assertInteractiveInputAllowed();

  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const items: SelectItem[] = config.options.map((o) => ({
      value: o.value,
      label: o.label,
      description: o.description,
    }));

    const selectList = new SelectList(items, items.length, SELECT_THEME);
    const width = process.stderr.columns || 80;
    let resolved = false;

    // Header: title + message (written once, never redrawn)
    const header = [
      "",
      chalkStderr.bold.yellow(`  ${config.title}`),
      "",
      ...config.message.split("\n").map((l) => chalkStderr.dim(`  ${l}`)),
      "",
    ];
    process.stderr.write(header.join("\n") + "\n");

    // Render select list + hint; returns line count written
    const hint = chalkStderr.dim("  \u2191\u2193 navigate \u00B7 Enter select \u00B7 Esc cancel");
    let lastLines = 0;

    const render = (): void => {
      if (lastLines > 0) {
        process.stderr.write(`\u001B[${lastLines}A`);
      }
      const lines = selectList.render(width);
      const output = [...lines, "", hint];
      for (const line of output) {
        process.stderr.write(`\u001B[2K${line}\n`);
      }
      lastLines = output.length;
    };

    selectList.onSelect = (item) => {
      resolved = true;
      cleanup();
      process.stderr.write("\n");
      resolve(item.value);
    };

    selectList.onCancel = () => {
      resolved = true;
      cleanup();
      process.stderr.write("\n");
      resolve(null);
    };

    // Raw mode (same pattern as promptHidden)
    const savedRawMode = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (data: string): void => {
      if (data === "\u0003") {
        resolved = true;
        cleanup();
        process.stderr.write("\n");
        resolve(null);
        return;
      }
      selectList.handleInput(data);
      if (!resolved) render();
    };

    const cleanup = (): void => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(savedRawMode);
      process.stdin.pause();
    };

    process.stdin.on("data", onData);
    render();
  });
}
