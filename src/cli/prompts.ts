import { createInterface } from "node:readline";
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
