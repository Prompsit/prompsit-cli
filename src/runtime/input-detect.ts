// @ prefix convention for file path auto-detection.
//
// Provides deterministic file/text disambiguation without filesystem probes.
// Convention: "@" prefix marks a positional arg as file path (like curl -d @file).
//
// See: clig.dev, POLA — explicit markers over heuristic detection.

const FILE_PREFIX = "@";

/**
 * Strip @ file prefix from an unquoted argument.
 * Returns the file path (without @) or null if not a file reference.
 *
 * - `@file.txt`    → `"file.txt"` (file)
 * - `hello`        → `null` (plain text)
 * - `@`            → `null` (bare @ is not a file reference)
 */
export function stripFilePrefix(arg: string): string | null {
  return arg.startsWith(FILE_PREFIX) && arg.length > 1 ? arg.slice(1) : null;
}
