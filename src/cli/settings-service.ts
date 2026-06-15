// Settings-application service.
//
// Owns the infrastructure side-effects of changing settings (API client lifecycle, curl
// toggle) so presentation code (the TUI settings screen) doesn't orchestrate the API client
// directly. Keeps lifecycle decisions out of UI components.

import { resetApiClient } from "../api/client.ts";
import { setCurlEnabled } from "../api/curl.ts";
import { clearTokens } from "../config/index.ts";

/** Apply the "show curl" setting to the live curl/request state. */
export function applyCurlSetting(enabled: boolean): void {
  setCurlEnabled(enabled);
}

/**
 * Apply an API base-URL change: log out (credentials are URL-scoped) and rebuild the
 * API client so the next request targets the new base URL.
 */
export function applyApiUrlChange(): void {
  clearTokens();
  resetApiClient();
}
