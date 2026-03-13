// See API-502: Cross-platform clipboard access.
//
// Leaf module -- no internal repl/ imports.
// Windows: koffi FFI for instant read/write (~0ms).
// WSL: clip.exe (write) + powershell.exe Get-Clipboard (read).
// macOS: pbpaste / pbcopy.
// Linux: wl-paste / wl-copy (Wayland) → xclip → xsel (X11).
// OSC 52: terminal escape for remote/VM/SSH clipboard (fire-and-forget).

import { spawn } from "node:child_process";
import { getRuntimePlatform, isWindowsPlatform, isWSL, RuntimePlatform } from "./platform.ts";

const CLIPBOARD_TIMEOUT_MS = 2000;

async function runClipboardCommand(
  binary: string,
  args: string[],
  input?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, CLIPBOARD_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(new Error(`Clipboard command timed out: ${binary}`));
        return;
      }
      if (code !== 0) {
        reject(
          new Error(stderr.trim() || `Clipboard command failed: ${binary} (code ${code ?? -1})`)
        );
        return;
      }

      resolve(stdout.trim());
    });

    if (input !== undefined) {
      child.stdin.end(input, "utf8");
      return;
    }

    child.stdin.end();
  });
}

/** Read clipboard on Linux: Wayland → xclip → xsel. */
async function linuxGetClipboard(): Promise<string> {
  if (process.env.WAYLAND_DISPLAY) {
    try {
      return await runClipboardCommand("wl-paste", ["--no-newline"]);
    } catch {
      /* fall through to X11 */
    }
  }
  try {
    return await runClipboardCommand("xclip", ["-selection", "clipboard", "-o"]);
  } catch {
    return await runClipboardCommand("xsel", ["--clipboard", "--output"]);
  }
}

/** Write clipboard on Linux: Wayland → xclip → xsel. */
async function linuxSetClipboard(text: string): Promise<void> {
  if (process.env.WAYLAND_DISPLAY) {
    try {
      await runClipboardCommand("wl-copy", [], text);
      return;
    } catch {
      /* fall through to X11 */
    }
  }
  try {
    await runClipboardCommand("xclip", ["-selection", "clipboard"], text);
  } catch {
    await runClipboardCommand("xsel", ["--clipboard", "--input"], text);
  }
}

/**
 * Write text to terminal clipboard via OSC 52 escape sequence.
 * Fire-and-forget — no way to verify terminal accepted it.
 * Handles tmux passthrough wrapping automatically.
 */
export function writeOsc52(text: string): void {
  const b64 = Buffer.from(text, "utf8").toString("base64");
  const osc52 = `\u001B]52;c;${b64}\u0007`;
  const seq = process.env.TMUX ? `\u001BPtmux;\u001B${osc52}\u001B\\` : osc52;
  process.stdout.write(seq);
}

/** Probe result: available, or unavailable with reason. */
export type ClipboardProbeResult =
  | { available: true }
  | { available: false; reason: "no-display" | "no-tools" };

/**
 * Probe whether system clipboard commands are likely to work.
 * Win/macOS: always available. Linux: checks display env + backend-compatible tools.
 * Candidates filtered per Neovim pattern: Wayland tools ↔ $WAYLAND_DISPLAY, X11 tools ↔ $DISPLAY.
 */
export async function probeSystemClipboard(): Promise<ClipboardProbeResult> {
  if (isWindowsPlatform()) return { available: true };
  if (getRuntimePlatform() === RuntimePlatform.MACOS) return { available: true };
  if (isWSL()) {
    try {
      await runClipboardCommand("which", ["clip.exe"]);
      return { available: true };
    } catch {
      return { available: false, reason: "no-tools" };
    }
  }

  const hasWayland = Boolean(process.env.WAYLAND_DISPLAY);
  const hasX11 = Boolean(process.env.DISPLAY);
  if (!hasWayland && !hasX11) return { available: false, reason: "no-display" };

  // Backend-compatible candidates only (Wayland tools need $WAYLAND_DISPLAY, X11 tools need $DISPLAY)
  const candidates: string[] = [];
  if (hasWayland) candidates.push("wl-copy");
  if (hasX11) candidates.push("xclip", "xsel");

  for (const bin of candidates) {
    try {
      await runClipboardCommand("which", [bin]);
      return { available: true };
    } catch {
      /* try next */
    }
  }
  return { available: false, reason: "no-tools" };
}

/**
 * Get text from system clipboard.
 * Returns clipboard text on success, null on system failure.
 * Empty string means clipboard is accessible but empty.
 */
export async function getClipboardText(): Promise<string | null> {
  try {
    if (isWindowsPlatform()) {
      const { readClipboardNative } = await import("./clipboard-win32.ts");
      return readClipboardNative() ?? "";
    }
    if (isWSL()) {
      return await runClipboardCommand("powershell.exe", ["-NoProfile", "-c", "Get-Clipboard"]);
    }

    const currentPlatform = getRuntimePlatform();

    if (currentPlatform === RuntimePlatform.MACOS) {
      return await runClipboardCommand("pbpaste", []);
    }
    return await linuxGetClipboard();
  } catch {
    return null;
  }
}

/**
 * Copy text to system clipboard.
 * Returns true on success, false on failure.
 */
export async function setClipboardText(text: string): Promise<boolean> {
  try {
    if (isWindowsPlatform()) {
      const { writeClipboardNative } = await import("./clipboard-win32.ts");
      return writeClipboardNative(text) ?? false;
    }
    if (isWSL()) {
      await runClipboardCommand("clip.exe", [], text);
      return true;
    }

    const currentPlatform = getRuntimePlatform();

    if (currentPlatform === RuntimePlatform.MACOS) {
      await runClipboardCommand("pbcopy", [], text);
      return true;
    }
    await linuxSetClipboard(text);
    return true;
  } catch {
    return false;
  }
}
