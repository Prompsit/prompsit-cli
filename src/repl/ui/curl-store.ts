// Curl command store -- holds both sanitized (display) and raw (clipboard) versions.
// Singleton module, same pattern as hint-state.ts.
// Leaf module -- no internal repl/ imports.

let _sanitizedCurl: string | null = null;
let _rawCurl: string | null = null;

/** Store both curl versions after an API call. */
export function setCurlPair(sanitized: string, raw: string): void {
  _sanitizedCurl = sanitized;
  _rawCurl = raw;
}

/** Get sanitized curl for panel display (tokens masked). */
export function getSanitizedCurl(): string | null {
  return _sanitizedCurl;
}

/** Get raw curl for clipboard copy (tokens included). */
export function getRawCurl(): string | null {
  return _rawCurl;
}

/** Clear both curl versions (called on terse/clear/stop). */
export function clearCurl(): void {
  _sanitizedCurl = null;
  _rawCurl = null;
}
