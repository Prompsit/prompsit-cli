// See API-455: Refactored status command to use global state from cli/options.ts
// See API-452: Login + Logout Commands with Interactive Input
// Commander.js commands for OAuth2 authentication flow.

import { Command } from "@commander-js/extra-typings";
import { getApiClient, resetApiClient } from "../api/client.ts";
import { saveTokens, clearTokens } from "../config/credentials.ts";
import { setSigintExit } from "../cli/exit.ts";
import { promptHidden, promptInput } from "../cli/prompts.ts";
import { terminal } from "../output/index.ts";
import { t } from "../i18n/index.ts";
import { getLogger } from "../logging/index.ts";
import { ErrorCode } from "../errors/codes.ts";
import { failCommand, handleCommandError } from "./error-handler.ts";

const log = getLogger(import.meta.url);

/**
 * Login command.
 *
 * Authenticates via OAuth2 ROPC flow. Supports flags or interactive input.
 * Stores tokens in ~/.prompsit/credentials.json.
 */
export const loginCommand = new Command("login")
  .description("Authenticate with the Prompsit API")
  .option("-a, --account <email>", "Account email address")
  .option("-s, --secret <key>", "API secret key")
  .action(async (options) => {
    const startMs = Date.now();
    try {
      log.debug("Login action entered");
      // Resolve account and secret (flags or interactive)
      const account = options.account ?? (await promptInput(t("auth.login.prompt_account")));
      const secret = options.secret ?? (await promptHidden(t("auth.login.prompt_secret")));

      if (!account || !secret) {
        failCommand(ErrorCode.AUTH_FAILED, t("auth.login.credentials_required"));
        return;
      }

      // Authenticate via OAuth2
      terminal.info(t("auth.login.authenticating"));
      log.debug("Sending auth request", { account });
      const response = await getApiClient().auth.getToken(account, secret);
      log.info("Authentication completed", { duration_ms: String(Date.now() - startMs) });

      // Save tokens (normalize nullable -> undefined for credential store)
      saveTokens({
        accessToken: response.access_token,
        refreshToken: response.refresh_token ?? undefined,
        accountId: account,
        expiresIn: response.expires_in ?? undefined,
        plan: response.plan,
      });

      // Reset client to pick up new credentials
      resetApiClient();

      terminal.success(t("auth.login.success"));
    } catch (error: unknown) {
      // Ctrl+C during interactive readline: POSIX SIGINT exit code
      if ((error as Error).message === "Cancelled") {
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
