// Self-service prompsit_secret rotation (POST /v1/auth/secret).
// Two modes:
//   - prompsit secret set         -> server generates a new pr_xxx
//   - prompsit secret set <value> -> set custom (6-72 UTF-8 bytes,
//                                    printable, no newlines, must NOT
//                                    start with reserved 'pr_' prefix)
// Always destructive: revokes ALL active refresh tokens AND bumps
// token_version server-side. The fresh JWT pair returned in the response
// is the only valid session afterward.

import { Command } from "@commander-js/extra-typings";
import { getApiClient, resetApiClient } from "../api/client.ts";
import { saveTokens, getAccountId } from "../config/credentials.ts";
import { promptConfirm } from "../cli/prompts.ts";
import { setSigintExit } from "../cli/exit.ts";
import { terminal } from "../output/index.ts";
import { t } from "../i18n/index.ts";
import { getLogger } from "../logging/index.ts";
import { handleCommandError } from "./error-handler.ts";

const log = getLogger(import.meta.url);

const secretSetCmd = new Command("set")
  .description("Rotate (no value) or set a custom prompsit_secret")
  .argument(
    "[value]",
    "Custom secret to set (6-72 UTF-8 bytes, printable, no newlines, must NOT start with 'pr_'). Omit to have the server generate a new pr_xxx value."
  )
  .option("-y, --yes", "Skip the interactive confirmation (required for non-TTY/CI use)")
  .action(async (value: string | undefined, options: { yes?: boolean }) => {
    const startMs = Date.now();
    try {
      const client = getApiClient();
      const account = getAccountId() ?? "this account";

      if (!options.yes) {
        const confirmed = await promptConfirm(t("auth.secret.confirm_revoke", { account }));
        if (!confirmed) {
          terminal.warn(t("auth.secret.aborted"));
          process.exit(1);
        }
      }

      log.debug("Rotating prompsit_secret", { mode: value === undefined ? "rotate" : "custom" });
      const response = await client.auth.changeSecret(value);

      saveTokens({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresIn: response.expires_in,
        prompsitSecret: response.prompsit_secret,
      });
      resetApiClient();

      terminal.success(t("auth.secret.changed", { secret: response.prompsit_secret }));
    } catch (error: unknown) {
      // Ctrl+C during readline confirmation
      if (
        (error as Error).message === "Cancelled" ||
        (error as Error).message === "Request cancelled"
      ) {
        setSigintExit();
        return;
      }
      handleCommandError(log, error, {
        command: "secret set",
        duration_ms: String(Date.now() - startMs),
      });
    }
  });

export const secretCommand = new Command("secret")
  .description("Manage your prompsit_secret (API key)")
  .addCommand(secretSetCmd);
