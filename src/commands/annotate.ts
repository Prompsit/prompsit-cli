// Annotate corpus file(s) with Monotextor (Language ID, PII, quality).
// Workflow: validate -> upload -> track (SSE/polling) -> download.
// Reuses trackJob() facade and runBatch() for multi-file parallel processing.

import { basename } from "node:path";
import { Command, Option } from "@commander-js/extra-typings";
import { getApiClient } from "../api/client.ts";
import { terminal } from "../output/index.ts";
import { trackJob } from "./job-tracking.ts";
import { runBatch } from "./batch-processor.ts";
import { t } from "../i18n/index.ts";
import { showFormats } from "./show-formats.ts";
import { showAnnotateMetadata } from "./show-metadata.ts";
import { VALID_PIPELINE_STAGES, VALID_LID_MODELS, DEFAULT_LID_MODEL } from "../shared/constants.ts";
import type { AnnotateParams } from "../api/models.ts";
import { getLogger } from "../logging/index.ts";
import { ErrorCode } from "../errors/codes.ts";
import { failCommand } from "./error-handler.ts";
import { tryExpandFileArgs, resolveOutputPaths } from "../runtime/file-args.ts";
import { getCurrentAbortSignal } from "../runtime/request-context.ts";
import { withWarmupRetry } from "../api/warmup-retry.ts";

const log = getLogger(import.meta.url);

/** Parse and validate metadata options. Returns null on invalid input. */
function parseAndValidateMetadata(input: string): string[] | null {
  const stages = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (stages.length === 0) return null;
  const invalid = stages.filter((s) => !VALID_PIPELINE_STAGES.has(s));
  if (invalid.length > 0) {
    failCommand(
      ErrorCode.VALIDATION,
      `${t("annotate.invalid_metadata")} ${invalid.join(", ")}`,
      t("annotate.metadata_hint")
    );
    return null;
  }
  return stages;
}

/** Parse string to positive integer. Returns null and reports error on failure. */
function parsePositiveInt(value: string, option: string): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    failCommand(ErrorCode.VALIDATION, t("validate.annotate.invalid_int", { option }));
    return null;
  }
  return n;
}

export const annotateCommand = new Command("annotate")
  .description("Annotate monolingual documents with metadata using Monotextor")
  .argument("[input-files...]", "Input corpus file(s) or directory (JSONL/JSONL.gz/JSONL.zst/text)")
  .option("-l, --lang <code>", "Language code (e.g. en, es, zh-Hans)")
  .option("--out <dir>", "Output directory (default: beside input file)")
  .option(
    "--metadata [options]",
    "Metadata to add (comma-separated: lid, dedup, pii, adult_filter, monofixer, docscorer)"
  )
  .addOption(
    new Option("--min-len <n>", "Min document length in chars (API default: 500)").hideHelp()
  )
  .addOption(
    new Option("--min-avg-words <n>", "Min average words per segment (API default: 5)").hideHelp()
  )
  .addOption(
    new Option(
      "--lid-model <model>",
      "LID model: openlid-v3 (default), openlid-v2, nllb"
    ).hideHelp()
  )
  .option("--formats", "Show supported file formats", false)
  .action(async (inputFiles, opts) => {
    // Early-exit: --formats shows annotation input formats
    if (opts.formats) {
      await showFormats("annotate");
      return;
    }

    // Early-exit: --metadata without files shows metadata info table
    if (opts.metadata === true && inputFiles.length === 0) {
      showAnnotateMetadata();
      return;
    }

    if (inputFiles.length === 0) {
      failCommand(ErrorCode.VALIDATION, t("validate.missing_argument", { name: "input-files" }));
      return;
    }
    if (!opts.lang) {
      failCommand(
        ErrorCode.VALIDATION,
        t("validate.missing_option", { option: "-l, --lang <code>" })
      );
      return;
    }
    // Validate optional pipeline stages
    let pipelineStages: string[] | undefined;
    if (opts.metadata && typeof opts.metadata === "string") {
      const parsed = parseAndValidateMetadata(opts.metadata);
      if (!parsed) return;
      pipelineStages = parsed;
    }

    // Validate optional int params
    let minLen: number | undefined;
    if (opts.minLen != null) {
      const parsed = parsePositiveInt(opts.minLen, "--min-len");
      if (parsed == null) return;
      minLen = parsed;
    }
    let minAvgWords: number | undefined;
    if (opts.minAvgWords != null) {
      const parsed = parsePositiveInt(opts.minAvgWords, "--min-avg-words");
      if (parsed == null) return;
      minAvgWords = parsed;
    }

    // Validate LID model (defaults to openlid-v3)
    const lidModel = opts.lidModel ?? DEFAULT_LID_MODEL;
    if (!VALID_LID_MODELS.has(lidModel)) {
      failCommand(
        ErrorCode.VALIDATION,
        `${t("annotate.invalid_lid_model")} ${lidModel}`,
        t("annotate.lid_model_hint")
      );
      return;
    }

    const expandResult = tryExpandFileArgs(inputFiles);
    if (!expandResult.ok) {
      failCommand(ErrorCode.VALIDATION, expandResult.message);
      return;
    }
    const resolvedFiles = expandResult.files;

    const lang = opts.lang;
    const annotateBase: Omit<AnnotateParams, "filePath"> = {
      lang,
      pipeline: pipelineStages,
      minLen,
      minAvgWords,
      lidModel,
    };
    const outputPaths = resolveOutputPaths(resolvedFiles, "_annotated", opts.out, "jsonl.zst");
    const client = getApiClient();
    const signal = getCurrentAbortSignal();
    const startMs = Date.now();
    log.info("Command started", { command: "annotate" });

    await runBatch({
      items: resolvedFiles,
      label: (f) => basename(f),
      process: async (filePath, index, onProgress) => {
        // Phase 1: Upload (0-5%)
        const resp = await withWarmupRetry(
          () =>
            client.data.annotate({ filePath, ...annotateBase }, (p) =>
              onProgress(Math.round(p.percent * 5))
            ),
          {
            signal,
            onStatus: (m) => {
              terminal.dim(m);
            },
          }
        );
        // Phase 2: Server processing (5-95%)
        const resultUrl = await trackJob(client, resp.job_id, {
          description: basename(filePath),
          silent: true,
          signal,
          onProgress: (pct) => onProgress(5 + Math.round(pct * 0.9)),
        });
        // Phase 3: Download (95-100%)
        return client.jobs.download(resultUrl, outputPaths[index], signal, (p) =>
          onProgress(95 + Math.round(p.percent * 5))
        );
      },
      formatSuccess: (path) => `${t("annotate.success")} ${path}`,
      command: "annotate",
      signal,
    });
    log.info("Command completed", {
      command: "annotate",
      duration_ms: String(Date.now() - startMs),
    });
  });
