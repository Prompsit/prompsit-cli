// See API-535: tm search — fuzzy search with source_lang auto-resolve.
// F8: auto-resolve and search must use the same profileId.
// F5: list() accepts targetLang filter for efficient auto-resolve.
// F7: color bands — green >= 0.9, yellow for rest.

import type { Command } from "@commander-js/extra-typings";
import { getApiClient } from "../../api/client.ts";
import { t } from "../../i18n/index.ts";
import { terminal } from "../../output/terminal.ts";
import { createTmSearchTableModel } from "../../output/tables/index.ts";
import { TM_DEFAULT_SEARCH_LIMIT } from "../../shared/constants.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { failCommand, handleCommandError } from "../error-handler.ts";
import { getLogger } from "../../logging/index.ts";

const log = getLogger(import.meta.url);

export function registerTmSearch(tmCommand: Command): void {
  tmCommand
    .command("search")
    .description("Search translation memory (fuzzy)")
    .argument("<query>", "Text to search for")
    .requiredOption("-t, --target <lang>", "Target language")
    .option("-s, --source <lang>", "Source language (auto-resolved if omitted)")
    .option("--limit <n>", "Max results", String(TM_DEFAULT_SEARCH_LIMIT))
    .option("--profile <id>", "Profile ID")
    .action(async (query, opts) => {
      try {
        const client = getApiClient();
        const profileId = opts.profile;
        let sourceLang = opts.source;

        // Auto-resolve source_lang if not provided (F8: same profileId)
        if (!sourceLang) {
          const tms = await client.tm.list({
            profileId,
            targetLang: opts.target, // F5: server-side filter
          });

          if (tms.items.length === 0) {
            failCommand(ErrorCode.VALIDATION, t("tm.search.no_tm", { target: opts.target }));
            return;
          }

          if (tms.items.length > 1) {
            const sources = tms.items.map((tm) => tm.source_lang).join(", ");
            failCommand(
              ErrorCode.VALIDATION,
              t("tm.search.ambiguous_source", { target: opts.target, sources })
            );
            return;
          }

          sourceLang = tms.items[0].source_lang;
          terminal.info(t("tm.search.auto_resolved", { source: sourceLang, target: opts.target }));
        }

        const result = await client.tm.search({
          query,
          sourceLang,
          targetLang: opts.target,
          limit: Number(opts.limit),
          profileId,
        });

        terminal.info(t("tm.search.header", { total: String(result.total_count) }));
        terminal.table(createTmSearchTableModel(result));
      } catch (error: unknown) {
        handleCommandError(log, error, { command: "tm search" });
      }
    });
}
