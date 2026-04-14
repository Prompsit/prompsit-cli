// See API-535: tm import — upload TMX file into TM.
// F1: profile_id is a query param, NOT form field.
// F6: accepts path with or without @ prefix.
// F4: displays all language pairs from response.
// F9: on timeout, shows verify hint.

import type { Command } from "@commander-js/extra-typings";
import { stat } from "node:fs/promises";
import { getApiClient } from "../../api/client.ts";
import { t } from "../../i18n/index.ts";
import { terminal } from "../../output/terminal.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { NetworkError } from "../../errors/contracts.ts";
import { failCommand, handleCommandError } from "../error-handler.ts";
import { getLogger } from "../../logging/index.ts";

const log = getLogger(import.meta.url);

/** Strip optional @ prefix from file path (F6). */
function resolveFilePath(input: string): string {
  return input.startsWith("@") ? input.slice(1) : input;
}

export function registerTmImport(tmCommand: Command): void {
  tmCommand
    .command("import")
    .description("Import TMX file into translation memory")
    .argument("<file>", "TMX file path (@ prefix optional)")
    .option("--profile <id>", "Profile ID")
    .action(async (fileArg, opts) => {
      try {
        const filePath = resolveFilePath(fileArg);

        // Validate file exists and is a regular file
        let fileStat;
        try {
          fileStat = await stat(filePath);
        } catch {
          failCommand(ErrorCode.VALIDATION, t("validate.tm.file_not_found", { path: filePath }));
          return;
        }
        if (!fileStat.isFile()) {
          failCommand(ErrorCode.VALIDATION, t("validate.tm.file_not_found", { path: filePath }));
          return;
        }

        terminal.info(t("tm.import.uploading"));

        const client = getApiClient();
        const result = await client.tm.importTmx(filePath, opts.profile);

        // F4: display all language pairs
        terminal.success(t("tm.import.success", { count: String(result.segment_count) }));
        for (const [source, target] of result.language_pairs) {
          terminal.line(t("tm.import.pair", { source, target }));
        }
      } catch (error: unknown) {
        // F9: on network errors (timeout/DNS/refused) upload may have reached the server — show verify hint
        if (error instanceof NetworkError) {
          terminal.warn(t("tm.import.verify_hint"));
        }
        handleCommandError(log, error, { command: "tm import" });
      }
    });
}
