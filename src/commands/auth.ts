// See API-455: Refactored status command to use global state from cli/options.ts
// See API-452: Login + Logout Commands with Interactive Input
// Commander.js commands for OAuth2 authentication flow.

import { Command } from "@commander-js/extra-typings";
import { getApiClient, resetApiClient } from "../api/client.ts";
import { saveTokens, clearTokens } from "../config/credentials.ts";
import { setSigintExit } from "../cli/exit.ts";
import { terminal } from "../output/index.ts";
import { t } from "../i18n/index.ts";
import { getLogger } from "../logging/index.ts";
import { ErrorCode } from "../errors/codes.ts";
import { failCommand, handleCommandError } from "./error-handler.ts";
import { runDeviceFlow } from "./device-flow.ts";
import { getCurrentAbortSignal } from "../runtime/request-context.ts";

const log = getLogger(import.meta.url);

/**
 * Login command.
 *
 * Two authentication paths:
 * - No flags: Device Flow (RFC 8628) — opens browser for Google OAuth.
 *   Works for both new registration and existing user recovery.
 * - With -a/-s flags: OAuth2 ROPC flow (backward compatible).
 *
 * Stores tokens in ~/.prompsit/credentials.json.
 */
export const loginCommand = new Command("login")
  .description("Sign in or register with the Prompsit API")
  .option("-a, --account <email>", "Account email address")
  .option("-s, --secret <key>", "API secret key")
  .action(async (options) => {
    const startMs = Date.now();
    try {
      log.debug("Login action entered");

      if (options.account && options.secret) {
        // ROPC path: login with existing credentials (backward compatible)
        terminal.info(t("auth.login.authenticating"));
        log.debug("Sending ROPC auth request", { account: options.account });
        const response = await getApiClient().auth.getToken(options.account, options.secret);
        log.info("ROPC authentication completed", {
          duration_ms: String(Date.now() - startMs),
        });

        saveTokens({
          accessToken: response.access_token,
          refreshToken: response.refresh_token ?? undefined,
          accountId: options.account,
          expiresIn: response.expires_in ?? undefined,
          plan: response.plan,
        });
        resetApiClient();
        terminal.success(t("auth.login.success"));
      } else if (options.account || options.secret) {
        // Partial flags: require both
        failCommand(ErrorCode.AUTH_FAILED, t("auth.login.credentials_required"));
      } else {
        // Device Flow path: browser-based sign-in / registration
        log.debug("Starting device flow");
        const result = await runDeviceFlow(
          getApiClient().auth,
          getCurrentAbortSignal()
        );

        saveTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accountId: result.accountId,
          expiresIn: result.expiresIn,
          plan: result.plan,
          prompsitSecret: result.prompsitSecret,
        });
        resetApiClient();

        // Show hint for future ROPC login
        terminal.dim(
          t("auth.device.secret_hint", {
            cmd: "login",
            account: result.accountId,
            secret: result.prompsitSecret,
          })
        );
      }
    } catch (error: unknown) {
      // Ctrl+C during interactive readline or device flow polling
      if ((error as Error).message === "Cancelled" || (error as Error).message === "Request cancelled") {
        setSigintExit();
        return;
      }
      handleCommandError(log, error, {
        command: "login",
        duration_ms: String(Date.now() - startMs),
      });
    }
  });

/**
 * Logout command.
 *
 * Clears stored credentials and resets API client singleton.
 */
export const logoutCommand = new Command("logout")
  .description("Clear stored credentials and log out")
  .action(() => {
    clearTokens();
    resetApiClient();
    terminal.success(t("auth.logout.success"));
  });
