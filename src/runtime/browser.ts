// Cross-platform browser opener utility.
// Extracted from device-flow.ts for reuse by contact/feedback commands.

import { execFileSync, spawn } from "node:child_process";
import { getRuntimePlatform } from "./platform.ts";

const BROWSER_TIMEOUT_MS = 3000;

/**
 * Open a URL in the default browser.
 *
 * Platform-specific strategy:
 * - win32:  `cmd /c start "" <url>`
 * - darwin: `open <url>`
 * - linux:  `xdg-open` / `wslview` fallback chain
 *
 * Returns `true` if the browser likely opened (no error within timeout),
 * `false` if the open attempt failed or no suitable command was found.
 */
export async function openBrowser(url: string): Promise<boolean> {
  const platform = getRuntimePlatform();
  let cmd: string;
  let args: string[];

  if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else {
    // Linux/WSL: fallback chain (GitHub CLI pattern — cli/browser)
    // wslview works in WSL, xdg-open works in native Linux
    const found = ["xdg-open", "wslview"].find((c) => {
      try {
        execFileSync("which", [c], { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    });
    if (!found) return false;
    cmd = found;
    args = [url];
  }

  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, {
        windowsHide: true,
        stdio: "ignore",
        detached: true,
      });
      child.unref();

      const timeout = setTimeout(() => {
        resolve(true); // Assume opened if no error within timeout
      }, BROWSER_TIMEOUT_MS);

      child.on("error", () => {
        clearTimeout(timeout);
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}
