// See API-438: Environment variable parser with nested delimiter support
// Parses PROMPSIT_* env vars with __ nested delimiter (e.g., PROMPSIT_API__BASE_URL)

/**
 * Parse environment variables with prefix and nested delimiter
 *
 * Pattern: 12-Factor App config precedence (env > file > defaults)
 *
 * @param prefix - Env var prefix (e.g., "PROMPSIT_")
 * @param delimiter - Nested key delimiter (e.g., "__")
 * @returns Nested object with parsed values
 *
 * @example
 * // PROMPSIT_API__BASE_URL=http://custom:8080
 * parseEnvOverrides("PROMPSIT_", "__")
 * // => { api: { base_url: "http://custom:8080" } }
 */
export function parseEnvOverrides(prefix: string, delimiter: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const forbiddenPathSegments = new Set(["__proto__", "prototype", "constructor"]);

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix) || value === undefined) continue;

    // Remove prefix and split by delimiter
    const keyPath = key.slice(prefix.length).toLowerCase().split(delimiter);
    if (keyPath.some((segment) => forbiddenPathSegments.has(segment))) {
      continue;
    }

    // Type coercion
    const coercedValue = coerceValue(value);

    // Build nested object
    let current = result;
    for (let i = 0; i < keyPath.length - 1; i++) {
      const part = keyPath[i];
      if (!(part in current)) {
        current[part] = {};
      }
      const next = current[part];
      current = (typeof next === "object" && next !== null ? next : {}) as Record<string, unknown>;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array guaranteed non-empty by loop
    current[keyPath.at(-1)!] = coercedValue;
  }

  return result;
}

/**
 * Coerce string value to appropriate type
 *
 * Pattern: boolean > number > string (in that order)
 */
function coerceValue(value: string): string | number | boolean {
  // Boolean
  if (value === "true") return true;
  if (value === "false") return false;

  // Number (integer or float)
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") return num;

  // String (fallback)
  return value;
}
