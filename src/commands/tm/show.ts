// See API-535: tm show — adaptive list TMs or list segments.
// Without -s/-t: GET /translation/memory (list TMs for profile)
// With -s + -t: GET /translation/memory/segments (paginated segment list)

import type { Command } from "@commander-js/extra-typings";
import { getApiClient } from "../../api/client.ts";
import { t } from "../../i18n/index.ts";
import { terminal } from "../../output/terminal.ts";
import { createTmListTableModel, createTmSegmentTableModel } from "../../output/tables/index.ts";
import { TM_DEFAULT_PAGE_SIZE } from "../../shared/constants.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { failCommand, handleCommandError } from "../error-handler.ts";
import { getLogger } from "../../logging/index.ts";

const log = getLogger(import.meta.url);

export function registerTmShow(tmCommand: Command): void {
  tmCommand
    .command("show")
    .description("Show TM overview or segments")
    .option("-s, --source <lang>", "Source language")
    .option("-t, --target <lang>", "Target language")
    .option("--profile <id>", "Profile ID")
    .option("--page <n>", "Page number", "1")
    .option("--page-size <n>", "Items per page", String(TM_DEFAULT_PAGE_SIZE))
    .action(async (opts) => {
      try {
        const client = getApiClient();
        const { source, target } = opts;

        if ((source === undefined) !== (target === undefined)) {
          failCommand(ErrorCode.VALIDATION, t("validate.tm.missing_both_langs"));
          return;
        }

        if (source !== undefined && target !== undefined) {
          // Show segments for specific TM
          const result = await client.tm.listSegments({
            sourceLang: source,
            targetLang: target,
            profileId: opts.profile,
            page: Number(opts.page),
            pageSize: Number(opts.pageSize),
          });

          terminal.info(
            t("tm.show.segments_header", {
              source,
              target,
              page: opts.page,
              total: String(result.total),
            }),
          );
          terminal.table(createTmSegmentTableModel(result));
        } else {
          // List all TMs for profile
          const result = await client.tm.list({ profileId: opts.profile });
          terminal.info(t("tm.show.header", { total: String(result.total) }));
          terminal.table(createTmListTableModel(result));
        }
      } catch (error: unknown) {
        handleCommandError(log, error, { command: "tm show" });
      }
    });
}
