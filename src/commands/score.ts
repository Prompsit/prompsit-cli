// Score parallel corpus quality with Bicleaner.
// Workflow: validate -> upload -> track (SSE/polling) -> download.
// Reuses trackJob() facade and runBatch() for multi-file parallel processing.

import { statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Command } from "@commander-js/extra-typings";
import { getApiClient } from "../api/client.ts";
import { terminal } from "../output/index.ts";
import { trackJob } from "./job-tracking.ts";
import { runBatch } from "./batch-processor.ts";
import { t } from "../i18n/index.ts";
import { showFormats } from "./show-formats.ts";
import { showScoringLanguages } from "./show-languages.ts";
import { getLogger } from "../logging/index.ts";
import { ErrorCode } from "../errors/codes.ts";
import { failCommand } from "./error-handler.ts";
import { VALID_SCORING_LANGUAGES } from "../shared/constants.ts";
import {
  tryExpandFileArgs,
  tryMatchDirectoryPairs,
  resolveOutputPaths,
} from "../runtime/file-args.ts";
import { getCurrentAbortSignal } from "../runtime/request-context.ts";
import { withWarmupRetry } from "../api/warmup-retry.ts";

const log = getLogger(import.meta.url);

export const scoreCommand = new Command("score")
  .description("Compute translation likelihood scores with Bicleaner-AI")
  .argument("[source-files...]", "Bitext file(s)/directory (TMX/TSV) or source file(s)/directory")
  .option(
    "-s, --source-lang <lang>",
    "Source language (en, de, es); target can be any language. Required for TSV/parallel, auto-detected for TMX"
  )
  .option("-t, --target <path>", "Target file or directory for parallel mode")
  .option("--output-format <format>", "Output format (tsv or tmx)")
  .option("--out <dir>", "Output directory (default: beside input file)")
  .option("--formats", "Show supported file formats", false)
  .option("-l, --languages", "Show supported source languages", false)
  .action(async (sourceFiles, opts) => {
    // Early-exit: info-only flags (no inputs required)
    if (opts.formats) {
      await showFormats("score");
      return;
    }
    if (opts.languages) {
      await showScoringLanguages();
      return;
    }

    if (sourceFiles.length === 0) {
      failCommand(ErrorCode.VALIDATION, t("validate.missing_argument", { name: "source-files" }));
      return;
    }

    // Validate source language (if provided)
    if (opts.sourceLang && !VALID_SCORING_LANGUAGES.has(opts.sourceLang)) {
      failCommand(
        ErrorCode.VALIDATION,
        t("validate.score.invalid_source_lang", { lang: opts.sourceLang }),
        t("validate.score.source_lang_hint")
      );
      return;
    }
    const sourceLang = opts.sourceLang;

    // Detect directory mode
    const firstResolved = resolve(sourceFiles[0]);
    let sourceIsDir = false;
    try {
      sourceIsDir = statSync(firstResolved).isDirectory();
    } catch {
      // Will be caught by tryExpandFileArgs below
    }

    const targetIsDir =
      opts.target != null &&
      (() => {
        try {
          return statSync(resolve(opts.target)).isDirectory();
        } catch {
          return false;
        }
      })();

    // Validate dir/file consistency
    if (sourceIsDir && opts.target && !targetIsDir) {
      failCommand(ErrorCode.VALIDATION, t("validate.score.source_dir_target_file"));
      return;
    }
    if (!sourceIsDir && targetIsDir) {
      failCommand(ErrorCode.VALIDATION, t("validate.score.target_dir_source_file"));
      return;
    }

    const client = getApiClient();
    const signal = getCurrentAbortSignal();
    const startMs = Date.now();
    log.info("Command started", { command: "score" });

    // --- Directory parallel mode: match source/target by filename ---
    if (sourceIsDir && targetIsDir && opts.target) {
      const pairResult = tryMatchDirectoryPairs(firstResolved, resolve(opts.target));
      if (!pairResult.ok) {
        failCommand(ErrorCode.VALIDATION, pairResult.message);
        return;
      }
      const pairs = pairResult.pairs;

      if (!sourceLang && pairs.some(([src]) => !src.toLowerCase().endsWith(".tmx"))) {
        failCommand(ErrorCode.VALIDATION, t("validate.score.source_lang_required"));
        return;
      }

      const outputPaths = resolveOutputPaths(
        pairs.map(([src]) => src),
        "_scored",
        opts.out,
        opts.outputFormat
      );

      await runBatch({
        items: pairs,
        label: ([src]) => basename(src),
        process: async ([src, tgt], index, onProgress) => {
          const resp = await withWarmupRetry(
            () =>
              client.data.score({
                sourceFile: src,
                targetFile: tgt,
                outputFormat: opts.outputFormat,
                sourceLang,
              }),
            {
              signal,
              onStatus: (m) => {
                terminal.dim(m);
              },
            }
          );
          const resultUrl = await trackJob(client, resp.job_id, {
            description: basename(src),
            silent: true,
            signal,
            onProgress,
          });
          return client.jobs.download(resultUrl, outputPaths[index]);
        },
        formatSuccess: (path) => `${t("score.success")} ${path}`,
        command: "score",
        signal,
      });

      log.info("Command completed", {
        command: "score",
        duration_ms: String(Date.now() - startMs),
      });
      return;
    }

    // --- File mode (single or multiple, bitext or parallel) ---
    const fileResult = tryExpandFileArgs(sourceFiles);
    if (!fileResult.ok) {
      failCommand(ErrorCode.VALIDATION, fileResult.message);
      return;
    }
    const resolvedFiles = fileResult.files;

    if (!sourceLang && resolvedFiles.some((f) => !f.toLowerCase().endsWith(".tmx"))) {
      failCommand(ErrorCode.VALIDATION, t("validate.score.source_lang_required"));
      return;
    }

    // Validate target file exists (if provided for non-dir mode)
    if (opts.target) {
      const targetResult = tryExpandFileArgs([opts.target]);
      if (!targetResult.ok) {
        failCommand(ErrorCode.VALIDATION, targetResult.message);
        return;
      }
    }

    const outputPaths = resolveOutputPaths(resolvedFiles, "_scored", opts.out, opts.outputFormat);

    await runBatch({
      items: resolvedFiles,
      label: (f) => basename(f),
      process: async (filePath, index, onProgress) => {
        const resp = await withWarmupRetry(
          () =>
            client.data.score({
              sourceFile: filePath,
              targetFile: opts.target,
              outputFormat: opts.outputFormat,
              sourceLang,
            }),
          {
            signal,
            onStatus: (m) => {
              terminal.dim(m);
            },
          }
        );
        const resultUrl = await trackJob(client, resp.job_id, {
          description: basename(filePath),
          silent: true,
          signal,
          onProgress,
        });
        return client.jobs.download(resultUrl, outputPaths[index]);
      },
      formatSuccess: (path) => `${t("score.success")} ${path}`,
      command: "score",
      signal,
    });

    log.info("Command completed", {
      command: "score",
      duration_ms: String(Date.now() - startMs),
    });
  });
