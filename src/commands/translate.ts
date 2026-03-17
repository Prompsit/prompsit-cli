// Flat translate command: @ prefix determines text vs file mode at runtime.
// Text mode (no @): sync inline translation via POST /v1/translation/translate.
// File mode (@): async document upload + track + download via SSE/polling.

import { Command } from "@commander-js/extra-typings";
import { basename } from "node:path";
import { getApiClient } from "../api/client.ts";
import { terminal, createTranslationTableModel } from "../output/index.ts";
import { toTranslationResponseVM } from "./mappers.ts";
import { showFormats } from "./show-formats.ts";
import { showLanguages } from "./show-languages.ts";
import { trackJob } from "./job-tracking.ts";
import { runBatch } from "./batch-processor.ts";
import { t } from "../i18n/index.ts";
import { ErrorCode } from "../errors/codes.ts";
import { getLogger } from "../logging/index.ts";
import { failCommand, handleCommandError } from "./error-handler.ts";
import { validateArgOptionOrder } from "../cli/arg-order.ts";
import { stripFilePrefix } from "../runtime/input-detect.ts";
import { tryExpandFileArgs, resolveOutputPaths } from "../runtime/file-args.ts";
import { getCurrentAbortSignal } from "../runtime/request-context.ts";
import { withWarmupRetry } from "../api/warmup-retry.ts";

const log = getLogger(import.meta.url);

// Boolean flags that don't consume the next token as a value
const BOOL_FLAGS: ReadonlySet<string> = new Set(["--qe", "--languages", "-l", "--formats"]);

/**
 * Flat translate command.
 *
 * Mode detection: @ prefix on positional args = file mode, no @ = text mode.
 * Info flags (--formats, --languages) work directly without mode selection.
 */
export const translateCommand = new Command("translate")
  .summary("Translate text or documents")
  .description("Translate text inline or upload document files for translation")
  .argument("[inputs...]", "Text(s) to translate or @file(s) to upload")
  .option("-s, --source <lang>", "Source language code")
  .option("-t, --target <lang>", "Target language code")
  .option("--qe", "Enable quality estimation (text mode)", false)
  .option("--out <dir>", "Output directory (file mode, default: beside input)")
  .option("--output-format <format>", "Target format conversion (e.g. po, arb, vtt)")
  .option("--formats", "Show supported document formats", false)
  .option("-l, --languages", "Show available language pairs", false)
  .helpCommand(false)
  .action(async (inputs, opts) => {
    // Info-only early exits (no inputs required)
    if (opts.formats) {
      await showFormats("document");
      return;
    }
    if (opts.languages) {
      await showLanguages({ source: opts.source, target: opts.target });
      return;
    }

    // Validate required inputs
    if (inputs.length === 0) {
      failCommand(ErrorCode.VALIDATION, t("validate.missing_argument", { name: "inputs" }));
      return;
    }
    if (!opts.source) {
      failCommand(
        ErrorCode.VALIDATION,
        t("validate.missing_option", { option: "-s, --source <lang>" })
      );
      return;
    }
    if (!opts.target) {
      failCommand(
        ErrorCode.VALIDATION,
        t("validate.missing_option", { option: "-t, --target <lang>" })
      );
      return;
    }

    // Classify inputs: @ prefix = file, else = text
    const fileInputs: string[] = [];
    const textInputs: string[] = [];
    for (const input of inputs) {
      const stripped = stripFilePrefix(input);
      if (stripped === null) {
        textInputs.push(input);
      } else {
        fileInputs.push(stripped);
      }
    }

    if (fileInputs.length > 0 && textInputs.length > 0) {
      failCommand(ErrorCode.VALIDATION, t("validate.translate.mixed_inputs"));
      return;
    }

    // After guards above, source and target are guaranteed strings
    const narrowed = { source: opts.source, target: opts.target };

    if (fileInputs.length > 0) {
      await translateFileMode(fileInputs, {
        ...narrowed,
        out: opts.out,
        outputFormat: opts.outputFormat,
      });
    } else {
      // POSIX arg order validation (text mode only, CLI context)
      const translateIdx = process.argv.indexOf("translate");
      if (translateIdx !== -1) {
        const rawArgs = process.argv.slice(translateIdx + 1);
        const violation = validateArgOptionOrder(rawArgs, BOOL_FLAGS);
        if (violation) {
          failCommand(ErrorCode.VALIDATION, t("validate.translate.text.arg_order", { violation }));
          return;
        }
      }
      await translateTextMode(textInputs, { ...narrowed, qe: opts.qe });
    }
  });

// --- Text mode ---

interface TextOpts {
  source: string;
  target: string;
  qe: boolean;
}

async function translateTextMode(texts: string[], opts: TextOpts): Promise<void> {
  const startMs = Date.now();
  log.info("Command started", {
    command: "translate",
    mode: "text",
    texts_count: String(texts.length),
  });
  try {
    const response = await withWarmupRetry(
      () =>
        getApiClient().translation.translate({
          texts,
          sourceLang: opts.source,
          targetLang: opts.target,
          enableQe: opts.qe,
        }),
      {
        signal: getCurrentAbortSignal(),
        onStatus: (m) => {
          terminal.dim(m);
        },
      }
    );

    log.info("Command completed", {
      command: "translate",
      mode: "text",
      duration_ms: String(Date.now() - startMs),
    });

    if (opts.qe) {
      terminal.table(createTranslationTableModel(toTranslationResponseVM(response), texts));
    } else {
      for (const item of response.translations) {
        terminal.line(item.translated_text);
      }
    }
  } catch (error: unknown) {
    handleCommandError(log, error, {
      command: "translate",
      mode: "text",
      duration_ms: String(Date.now() - startMs),
    });
  }
}

// --- File mode ---

interface FileOpts {
  source: string;
  target: string;
  out?: string;
  outputFormat?: string;
}

async function translateFileMode(files: string[], opts: FileOpts): Promise<void> {
  const expandResult = tryExpandFileArgs(files);
  if (!expandResult.ok) {
    failCommand(ErrorCode.VALIDATION, expandResult.message);
    return;
  }
  const resolvedFiles = expandResult.files;

  const startMs = Date.now();
  log.info("Command started", {
    command: "translate",
    mode: "file",
    files_count: String(resolvedFiles.length),
  });

  const client = getApiClient();
  const signal = getCurrentAbortSignal();
  const sourceLang = opts.source;
  const targetLang = opts.target;
  const suffix = `_${sourceLang}-${targetLang}`;
  const targetPaths = resolveOutputPaths(resolvedFiles, suffix, opts.out, opts.outputFormat);

  await runBatch({
    items: resolvedFiles,
    label: (f) => basename(f),
    process: async (filePath, index, onProgress) => {
      // Phase 1: Upload (0-5%)
      const resp = await client.translation.uploadDocument(
        {
          filePath,
          sourceLang,
          targetLang,
          outputFormat: opts.outputFormat,
        },
        (p) => { onProgress(Math.round(p.percent * 5)); }
      );
      // Phase 2: Server processing (5-95%)
      const resultUrl = await trackJob(client, resp.job_id, {
        description: basename(filePath),
        silent: true,
        signal,
        onProgress: (pct) => { onProgress(5 + Math.round(pct * 0.9)); },
      });
      // Phase 3: Download (95-100%)
      return client.jobs.download(resultUrl, targetPaths[index], signal, (p) =>
        { onProgress(95 + Math.round(p.percent * 5)); }
      );
    },
    formatSuccess: (path) => `${t("translate.file.success")} ${path}`,
    command: "translate",
    signal,
  });

  log.info("Command completed", {
    command: "translate",
    mode: "file",
    duration_ms: String(Date.now() - startMs),
  });
}
