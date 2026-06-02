// Device Flow orchestrator (RFC 8628).
// Coordinates: initiate → display code → open browser → poll → return credentials.
// Works in both CLI mode (ora spinner) and REPL mode (terminal.dim).

import { openBrowser } from "../runtime/browser.ts";
import ora, { type Ora } from "ora";
import type { AuthResource } from "../api/resources/auth.ts";
import { getApiClient } from "../api/client.ts";
import { sleep } from "../runtime/async-utils.ts";
import { CancelledError, AuthenticationError } from "../errors/contracts.ts";
import { terminal } from "../output/index.ts";
import { t } from "../i18n/index.ts";
import { getLogger } from "../logging/index.ts";
import { DEVICE_FLOW_DEFAULT_INTERVAL } from "../shared/constants.ts";

const log = getLogger(import.meta.url);

const SLOW_DOWN_INCREMENT = 5; // RFC 8628 §3.5: increase interval by 5s on slow_down

/** Result from a completed device flow. */
export interface DeviceFlowResult {
  accessToken: string;
  refreshToken: string;
  email: string;
  accountId: string;
  expiresIn: number;
  plan: string;
  /** Present only on first Google registration; absent on recurring login. */
  prompsitSecret?: string;
}

/**
 * Run the complete RFC 8628 Device Flow.
 *
 * 1. Initiate device authorization
 * 2. Display user_code and verification URI
 * 3. Open browser to verification_uri_complete
 * 4. Poll for authorization with exponential slow_down
 * 5. Return credentials on success
 *
 * Pattern follows warmup-retry.ts: sleep + AbortSignal + CancelledError.
 */
export async function runDeviceFlow(
  authResource: AuthResource,
  signal?: AbortSignal
): Promise<DeviceFlowResult> {
  // 1. Initiate
  terminal.info(t("auth.device.starting"));
  const deviceAuth = await authResource.requestDeviceCode();
  log.debug("Device flow initiated", {
    user_code: "***",
    expires_in: String(deviceAuth.expires_in),
    interval: String(deviceAuth.interval),
  });

  // 2. Display user_code and verification URI
  // Resolve relative URI to absolute (defensive: API may omit API_PUBLIC_URL)
  const baseUrl = getApiClient().baseUrl;
  const resolveUrl = (uri: string) => (uri.startsWith("http") ? uri : `${baseUrl}${uri}`);
  const verificationUri = resolveUrl(deviceAuth.verification_uri);
  const browseUrl = deviceAuth.verification_uri_complete
    ? resolveUrl(deviceAuth.verification_uri_complete)
    : verificationUri;

  terminal.info("");
  terminal.info(`  ${t("auth.device.user_code", { code: deviceAuth.user_code })}`);
  terminal.info("");
  terminal.info(`  ${t("auth.device.visit_url", { url: browseUrl })}`);
  terminal.info("");

  // 3. Open browser (prefer complete URL with embedded user_code)
  const opened = await openBrowser(browseUrl);
  if (opened) {
    terminal.info(t("auth.device.browser_opened"));
  } else {
    terminal.warn(t("auth.device.browser_failed"));
  }

  // 4. Poll for authorization
  // Honor the server-advertised interval as-is. The server enforces this value as a
  // hard minimum (RFC 8628 §3.5) and returns slow_down to anyone polling faster, so
  // polling below it is counterproductive — it only earns a slow_down penalty.
  let interval = deviceAuth.interval || DEVICE_FLOW_DEFAULT_INTERVAL;
  const deadline = Date.now() + deviceAuth.expires_in * 1000;

  // Spinner: ora for CLI, terminal.dim for REPL (stdin is raw)
  const isRepl = process.stdin.isRaw;
  let spinner: Ora | null = null;
  if (isRepl) {
    terminal.dim(t("auth.device.waiting"));
  } else {
    spinner = ora(t("auth.device.waiting")).start();
  }

  try {
    while (Date.now() < deadline) {
      // Cancellable sleep (AbortSignal from REPL Ctrl+C or CLI SIGINT)
      try {
        await sleep(interval * 1000, signal);
      } catch {
        throw new CancelledError();
      }

      const result = await authResource.pollDeviceToken(deviceAuth.device_code);

      switch (result.status) {
        case "success": {
          spinner?.succeed(t("auth.login.success"));
          log.info("Device flow completed");
          return {
            accessToken: result.data.access_token,
            refreshToken: result.data.refresh_token,
            email: result.data.email,
            accountId: result.data.account_id,
            expiresIn: result.data.expires_in,
            plan: result.data.plan,
            prompsitSecret: result.data.prompsit_secret ?? undefined,
          };
        }
        case "pending": {
          // Continue polling
          break;
        }
        case "slow_down": {
          // Defensive backstop. We already poll at the server-advertised interval, so
          // this should not fire in normal operation; if it does, respect RFC 8628 §3.5:
          // "the interval MUST be increased by 5 seconds for all subsequent requests".
          interval += SLOW_DOWN_INCREMENT;
          log.debug("Polling slowed down", { new_interval: String(interval) });
          break;
        }
        case "expired": {
          spinner?.fail();
          throw new AuthenticationError(t("auth.device.expired", { cmd: "login" }));
        }
        case "denied": {
          spinner?.fail();
          throw new AuthenticationError(t("auth.device.denied"));
        }
        case "transient_error": {
          log.warn("Transient error during polling, will retry");
          break;
        }
      }
    }

    // Deadline reached without success
    spinner?.fail();
    throw new AuthenticationError(t("auth.device.expired", { cmd: "login" }));
  } finally {
    if (spinner?.isSpinning) spinner.stop();
  }
}
