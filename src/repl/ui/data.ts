// Static REPL data: banner and styles.
//
// Command metadata lives in registry.ts.
// This module retains only visual constants (banner, REPL style).
//
// Leaf module -- no internal repl/ imports.

// ASCII art banner with Prompsit brand gold gradient (light -> dark).
// Each entry: [line, hex color].
export const BANNER_LINES: readonly (readonly [string, string])[] = [
  [" ____  ____   ___  __  __ ____  ____ ___ _____ ", "#FDD65A"],
  [String.raw`|  _ \|  _ \ / _ \|  \/  |  _ \/ ___|_ _|_   _|`, "#FBB142"],
  [String.raw`| |_) | |_) | | | | |\/| | |_) \___ \| |  | |  `, "#DC8605"],
  ["|  __/|  _ <| |_| | |  | |  __/ ___) | |  | |  ", "#DC8605"],
  [String.raw`|_|   |_| \_\\___/|_|  |_|_|   |____/___| |_|  `, "#9A5C00"],
] as const;

// Chalk-compatible color tokens for REPL UI elements.
// Maps semantic names to hex colors (used by chalk.hex() in session/welcome).
export const REPL_COLORS = {
  /** Completion menu background */
  completionBg: "#008888",
  /** Completion menu text */
  completionFg: "#ffffff",
  /** Active completion background */
  completionActiveBg: "#00aaaa",
  /** Active completion text */
  completionActiveFg: "#000000",
  /** Fuzzy match highlight */
  fuzzyMatch: "#00ffff",
  /** Prompt arrow */
  promptArrow: "#00cccc",
  /** Status bar label */
  statusLabel: "#888888",
  /** Auth OK indicator */
  statusAuthOk: "#00cc00",
  /** Auth fail indicator */
  statusAuthFail: "#cc0000",
  /** Status separator */
  statusSep: "#555555",
  /** Environment indicator */
  statusEnv: "#cc8800",
  /** Language indicator */
  statusLang: "#00aaaa",
  /** Hint text */
  hintText: "#cc8800",
  /** Curl panel text */
  curlText: "#2d8a4e",
} as const;

// Status bar format
export const STATUS_SEPARATOR = " | ";
