// Flat evaluate command: mode determined at runtime.
// Inline mode (no positional, -s/-h/-r): single segment evaluation via POST /v1/evaluation/evaluate.
// Batch mode (positional without @): TSV file(s), segment evaluation via POST /v1/evaluation/evaluate.
// File mode (positional with @): file scoring via POST /v1/quality/score/file.

import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createInterface } from "node:readline";
import { basename } from "node:path";
import { Command } from "@commander-js/extra-typings";
import { getApiClient } from "../api/client.ts";
import type { Segment, EvaluateFileResult } from "../api/models.ts";
import { terminal, createEvaluationTableModel } from "../output/index.ts";
import { toEvaluationResponseVM } from "./mappers.ts";
import { showFormats } from "./show-formats.ts";
import { runBatch } from "./batch-processor.ts";
import { t } from "../i18n/index.ts";
import { getLogger } from "../logging/index.ts";
import { ErrorCode } from "../errors/codes.ts";
import { failCommand, handleCommandError } from "./error-handler.ts";
import { stripFilePrefix } from "../runtime/input-detect.ts";
import { tryExpandFileArgs, resolveOutputPaths } from "../runtime/file-args.ts";
import { withWarmupRetry } from "../api/warmup-retry.ts";
import { getCurrentAbortSignal } from "../runtime/request-context.ts";

const log = getLogger(import.meta.url);

/** Accepted metric names (case-insensitive). */
const VALID_METRICS = new Set(["bleu", "chrf", "metricx", "comet"]);

/** Default metrics when --metrics not specified. */
const DEFAULT_METRICS = "bleu,chrf";

/**
 * Parse and validate a comma-separated metrics string.
 *
 * Splits on commas, trims whitespace, normalizes to lowercase.
 * Returns null on invalid metric names (error already printed).
 */
function parseAndValidateMetrics(input: string): string[] | null {
  const metrics = input
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
  const invalid = metrics.filter((m) => !VALID_METRICS.has(m));

  if (invalid.length > 0) {
    failCommand(
      ErrorCode.CANCELLED,
      `${t("evaluate.invalid_metrics")} ${invalid.join(", ")}`,
      `${t("evaluate.valid_metrics")} ${[...VALID_METRICS].join(", ")}`
    );
    return null;
  }

  return metrics;
}

/**
 * Parse a TSV file into Segment array using streaming readline.
 *
 * Blank lines are skipped. Rows with != 3 columns produce error with line number.
 * Returns null on parse error (error already printed).
 */
async function parseTsvFile(filePath: string): Promise<Segment[] | null> {
  const segments: Segment[] = [];
  let lineNum = 0;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split("\t");
    if (parts.length !== 3) {
      failCommand(ErrorCode.CANCELLED, t("evaluate.invalid_line", { line_num: String(lineNum) }));
      return null;
    }

    segments.push({
      source: parts[0],
      hypothesis: parts[1],
      reference: parts[2],
    });
  }

  if (segments.length === 0) {
    failCommand(ErrorCode.CANCELLED, t("evaluate.no_segments"));
    return null;
  }

  return segments;
}

/**
 * Flat evaluate command.
 *
 * Mode detection:
 * - --formats → show QE-supported formats
 * - No positional + -s/-h/-r → inline metrics (single segment)
 * - Positional without @ → batch mode (TSV files)
 * - Positional with @ → file scoring mode
 */
export const evaluateCommand = new Command("evaluate")
  .summary("Evaluate translation quality")
  .description("Evaluate single segments, batch TSV files, or score document files")
  .argument("[inputs...]", "TSV file(s) or @file(s) for scoring")
  // Free -h for --hypothesis: help available only as --help
  .helpOption("--help", "display help for command")
  .option("-s, --source <text>", "Source text (inline mode)")
  .option("-h, --hypothesis <text>", "Machine translation hypothesis (inline mode)")
  .option("-r, --reference <text>", "Reference translation (inline mode)")
  .option("-m, --metrics <list>", "Metrics to compute (comma-separated)", DEFAULT_METRICS)
  .option("--out <dir>", "Output directory (file mode, default: beside input)")
  .option("--output-format <format>", "Output format (csv/tsv/tmx/xliff)")
  .option("--formats", "Show supported file formats", false)
  .helpCommand(false)
  .action(async (inputs, opts) => {
    // Info-only early exit
    if (opts.formats) {
      await showFormats("qe");
      return;
    }

    const hasInlineFlags =
      opts.source !== undefined || opts.hypothesis !== undefined || opts.reference !== undefined;
    const hasPositional = inputs.length > 0;

    // Pre-validation: strict mode matrix — reject mixed modes
    if (hasPositional && hasInlineFlags) {
      failCommand(ErrorCode.VALIDATION, t("validate.evaluate.mixed_modes"));
      return;
    }

    if (hasPositional) {
      // Classify inputs: @ prefix = file scoring, else = batch TSV
      const fileInputs: string[] = [];
      const batchInputs: string[] = [];
      for (const input of inputs) {
        const stripped = stripFilePrefix(input);
        if (stripped === null) {
          batchInputs.push(input);
        } else {
          fileInputs.push(stripped);
        }
      }

      if (fileInputs.length > 0 && batchInputs.length > 0) {
        failCommand(ErrorCode.VALIDATION, t("validate.evaluate.mixed_inputs"));
        return;
      }

      await (fileInputs.length > 0
        ? evaluateFileMode(fileInputs, opts)
        : evaluateBatchMode(batchInputs, opts));
    } else if (hasInlineFlags) {
      // Inline mode: all three flags required
      if (!opts.source || !opts.hypothesis || !opts.reference) {
        failCommand(ErrorCode.VALIDATION, t("validate.evaluate.missing_inline_flags"));
        return;
      }
      await evaluateInlineMode({
        source: opts.source,
        hypothesis: opts.hypothesis,
        reference: opts.reference,
        metrics: opts.metrics,
      });
    } else {
      // No inputs, no inline flags
      failCommand(ErrorCode.VALIDATION, t("validate.missing_argument", { name: "inputs" }));
    }
  });

// --- Inline mode ---

interface InlineOpts {
  source: string;
  hypothesis: string;
  reference: string;
  metrics: string;
}

async function evaluateInlineMode(opts: InlineOpts): Promise<void> {
  const startMs = Date.now();
  log.info("Command started", { command: "evaluate", mode: "inline" });
  try {
    const metricList = parseAndValidateMetrics(opts.metrics);
    if (!metricList) return;

    const segment: Segment = {
      source: opts.source,
      hypothesis: opts.hypothesis,
      reference: opts.reference,
    };
    const response = await withWarmupRetry(
      () =>
        getApiClient().evaluation.evaluate({
          segments: [segment],
          metrics: metricList,
          aggregation: "corpus",
        }),
      {
        signal: getCurrentAbortSignal(),
        onStatus: (m) => {
          terminal.dim(m);
        },
      }
    );

    log.info("Command completed", {
      command: "evaluate",
      mode: "inline",
      duration_ms: String(Date.now() - startMs),
    });
    terminal.table(createEvaluationTableModel(toEvaluationResponseVM(response)));
  } catch (error: unknown) {
    handleCommandError(log, error, {
      command: "evaluate",
      mode: "inline",
      duration_ms: String(Date.now() - startMs),
    });
  }
}

// --- Batch mode ---

interface BatchOpts {
  metrics: string;
}

async function evaluateBatchMode(files: string[], opts: BatchOpts): Promise<void> {
  const startMs = Date.now();
  log.info("Command started", {
    command: "evaluate",
    mode: "batch",
    files_count: String(files.length),
  });
  try {
    const metricList = parseAndValidateMetrics(opts.metrics);
    if (!metricList) return;

    for (const file of files) {
      try {
        await access(file);
      } catch {
        failCommand(ErrorCode.CANCELLED, `${t("evaluate.file_not_found")} ${file}`);
        return;
      }

      const segments = await parseTsvFile(file);
      if (!segments) return;

      const response = await withWarmupRetry(
        () =>
          getApiClient().evaluation.evaluate({
            segments,
            metrics: metricList,
            aggregation: "both",
          }),
        {
          signal: getCurrentAbortSignal(),
          onStatus: (m) => {
            terminal.dim(m);
          },
        }
      );

      log.info("Command completed", {
        command: "evaluate",
        mode: "batch",
        duration_ms: String(Date.now() - startMs),
        segments: String(response.segment_count),
      });
      terminal.table(createEvaluationTableModel(toEvaluationResponseVM(response)));
      terminal.info(`\n${t("evaluate.total", { count: String(response.segment_count) })}`);
    }
  } catch (error: unknown) {
    handleCommandError(log, error, {
      command: "evaluate",
      mode: "batch",
      duration_ms: String(Date.now() - startMs),
    });
  }
}

// --- File mode ---

interface FileOpts {
  metrics: string;
  out?: string;
  outputFormat?: string;
}

async function evaluateFileMode(files: string[], opts: FileOpts): Promise<void> {
  const metricList = parseAndValidateMetrics(opts.metrics);
  if (!metricList) return;

  const expandResult = tryExpandFileArgs(files);
  if (!expandResult.ok) {
    failCommand(ErrorCode.VALIDATION, expandResult.message);
    return;
  }
  const resolvedFiles = expandResult.files;

  const outputPaths = resolveOutputPaths(resolvedFiles, "_scored", opts.out, opts.outputFormat);
  const client = getApiClient();
  const startMs = Date.now();
  log.info("Command started", {
    command: "evaluate",
    mode: "file",
    files_count: String(resolvedFiles.length),
  });

  const batchResult = await runBatch<string, EvaluateFileResult>({
    items: resolvedFiles,
    label: (f) => basename(f),
    process: async (filePath, index) => {
      return withWarmupRetry(
        () =>
          client.evaluation.evaluateFile(
            { filePath, metrics: metricList, outputFormat: opts.outputFormat },
            outputPaths[index]
          ),
        {
          signal: getCurrentAbortSignal(),
          onStatus: (m) => {
            terminal.dim(m);
          },
        }
      );
    },
    formatSuccess: (r) => `${t("evaluate.file.success")} ${r.filename}`,
    command: "evaluate",
  });
  for (const { value } of batchResult.results) {
    if (Object.keys(value.corpusScores).length > 0) {
      terminal.dim(`  ${value.filename}:`);
      terminal.table(createEvaluationTableModel({ corpus_scores: value.corpusScores }));
    }
  }
  log.info("Command completed", {
    command: "evaluate",
    mode: "file",
    duration_ms: String(Date.now() - startMs),
  });
}
