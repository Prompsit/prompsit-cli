// Device Flow orchestrator (RFC 8628).
// Coordinates: initiate → display code → open browser → poll → return credentials.
// Works in both CLI mode (ora spinner) and REPL mode (terminal.dim).

import { spawn } from "node:child_process";
import ora, { type Ora } from "ora";
import type { AuthResource } from "../api/resources/auth.ts";
import { getApiClient } from "../api/client.ts";
import { sleep } from "../runtime/async-utils.ts";
import { getRuntimePlatform } from "../runtime/platform.ts";
import { CancelledError, AuthenticationError } from "../errors/contracts.ts";
import { terminal } from "../output/index.ts";
import { t } from "../i18n/index.ts";
import { getLogger } from "../logging/index.ts";
import { DEVICE_FLOW_DEFAULT_INTERVAL } from "../shared/constants.ts";

const log = getLogger(import.meta.url);

const BROWSER_TIMEOUT_MS = 3000;
const SLOW_DOWN_INCREMENT = 5; // RFC 8628 §3.5: increase interval by 5s on slow_down

/** Result from a completed device flow. */
export interface DeviceFlowResult {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  expiresIn: number;
  plan: string;
  prompsitSecret: string;
}

/**
 * Open a URL in the default browser.
 * Cross-platform: start (win32), open (darwin), xdg-open (linux).
 * Returns true if opened, false on failure. Non-blocking.
 */
async function openBrowser(url: string): Promise<boolean> {
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
    cmd = "xdg-open";
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
  terminal.info(`  ${t("auth.device.visit_url", { url: verificationUri })}`);
  terminal.info("");

  // 3. Open browser (prefer complete URL with embedded user_code)
  const opened = await openBrowser(browseUrl);
  if (opened) {
    terminal.info(t("auth.device.browser_opened"));
  } else {
    terminal.warn(t("auth.device.browser_failed"));
  }

  // 4. Poll for authorization
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
            accountId: result.data.account_id,
            expiresIn: result.data.expires_in,
            plan: result.data.plan,
            prompsitSecret: result.data.prompsit_secret,
          };
        }
        case "pending": {
          // Continue polling
          break;
        }
        case "slow_down": {
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
