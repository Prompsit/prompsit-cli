// Flat eval command: mode determined at runtime.
// Inline mode (no positional, -s/-h/-r): single segment scoring via POST /v1/quality/score.
// Batch mode (positional without @): TSV file(s), segment scoring via POST /v1/quality/score.
// File mode (positional with @): file scoring via POST /v1/quality/score/file.
// Tags mode (--tags): reference-free tag scoring via POST /v1/quality/tags.

import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createInterface } from "node:readline";
import { basename } from "node:path";
import { Command } from "@commander-js/extra-typings";
import { getApiClient } from "../api/client.ts";
import type { Segment, TagSegment, EvaluateFileResult } from "../api/models.ts";
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
import { infoOutputFromFlag } from "./info-output.ts";

const log = getLogger(import.meta.url);

/** Accepted metric names (case-insensitive). */
const VALID_METRICS = new Set(["bleu", "chrf", "metricx", "comet"]);

/** Accepted tag sub-score names (case-insensitive), used with --tags. */
const VALID_TAG_SUBSCORES = new Set(["tag_preservation", "tag_position"]);

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
 * Parse and validate a comma-separated tag sub-scores string (used with --tags).
 *
 * Mirrors parseAndValidateMetrics: splits on commas, trims, lowercases.
 * Returns null on invalid sub-score names (error already printed).
 */
function parseAndValidateSubScores(input: string): string[] | null {
  const subScores = input
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const invalid = subScores.filter((s) => !VALID_TAG_SUBSCORES.has(s));

  if (invalid.length > 0) {
    failCommand(
      ErrorCode.CANCELLED,
      `${t("evaluate.invalid_subscores")} ${invalid.join(", ")}`,
      `${t("evaluate.valid_subscores")} ${[...VALID_TAG_SUBSCORES].join(", ")}`
    );
    return null;
  }

  return subScores;
}

/**
 * Read a TSV file into rows of exactly `cols` columns using streaming readline.
 *
 * Blank lines are skipped. Rows with != `cols` columns produce error with line
 * number and expected column count. Returns null on parse error (error already
 * printed) or when no rows are found.
 */
async function parseTsvRows(filePath: string, cols: number): Promise<string[][] | null> {
  const rows: string[][] = [];
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
    if (parts.length !== cols) {
      failCommand(
        ErrorCode.CANCELLED,
        t("evaluate.invalid_line", { line_num: String(lineNum), cols: String(cols) })
      );
      return null;
    }

    rows.push(parts);
  }

  if (rows.length === 0) {
    failCommand(ErrorCode.CANCELLED, t("evaluate.no_segments"));
    return null;
  }

  return rows;
}

/**
 * Parse a 3-column TSV (source, hypothesis, reference) into Segment array.
 * @internal Exported for unit tests (inbound corpus parsing).
 */
export async function parseTsvFile(filePath: string): Promise<Segment[] | null> {
  const rows = await parseTsvRows(filePath, 3);
  if (!rows) return null;
  return rows.map((parts) => ({
    source: parts[0],
    hypothesis: parts[1],
    reference: parts[2],
  }));
}

/**
 * Parse a 2-column TSV (source, hypothesis) into TagSegment array (reference-free).
 * @internal Exported for unit tests (inbound corpus parsing).
 */
export async function parseTagsTsvFile(filePath: string): Promise<TagSegment[] | null> {
  const rows = await parseTsvRows(filePath, 2);
  if (!rows) return null;
  return rows.map((parts) => ({
    source: parts[0],
    hypothesis: parts[1],
  }));
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
export const evaluateCommand = new Command("eval")
  .summary("Evaluate translation quality")
  .description("Evaluate single segments, batch TSV files, or score document files")
  .argument("[inputs...]", "TSV file(s) or @file(s) for scoring")
  // Free -h for --hypothesis: help available only as --help
  .helpOption("--help", "display help for command")
  .option("-s, --source <text>", "Source text (inline mode)")
  .option("-h, --hypothesis <text>", "Machine translation hypothesis (inline mode)")
  .option("-r, --reference <text>", "Reference translation (inline mode)")
  .option("-m, --metrics <list>", "Metrics to compute (comma-separated)", DEFAULT_METRICS)
  .option("--tags", "Score inline tag preservation/position (reference-free)", false)
  .option("--out <dir>", "Output directory (file mode, default: beside input)")
  .option("--output-format <format>", "Output format (csv/tsv/tmx/xliff)")
  .option("--formats", "Show supported file formats", false)
  .option("--tsv", "Print machine-readable TSV for --formats", false)
  .helpCommand(false)
  .action(async (inputs, opts, command) => {
    // Info-only early exit
    if (opts.formats) {
      await showFormats("qe", infoOutputFromFlag(opts.tsv));
      return;
    }
    if (opts.tsv) {
      failCommand(ErrorCode.VALIDATION, t("validate.tsv.info_only"));
      return;
    }

    if (opts.tags) {
      await dispatchTagsMode(inputs, opts, command.getOptionValueSource("metrics") === "default");
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

  const outputPaths = resolveOutputPaths(resolvedFiles, "_evaluated", opts.out, opts.outputFormat);
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

// --- Tags mode (reference-free tag quality) ---

export interface TagsOpts {
  source?: string;
  hypothesis?: string;
  reference?: string;
  metrics: string;
}

/**
 * Route an `eval --tags` invocation to inline or batch handling.
 *
 * Tags scoring is reference-free, so -r is rejected and there is no @file mode
 * (no tags file endpoint). When -m was left at its default, sub_scores is omitted
 * so the server computes both tag_preservation and tag_position.
 *
 * Exported for unit testing: invalid flag combinations are rejected here before
 * any network call, so validation is fully testable without Commander or the API.
 */
export async function dispatchTagsMode(
  inputs: string[],
  opts: TagsOpts,
  metricsIsDefault: boolean
): Promise<void> {
  const hasInlineFlags =
    opts.source !== undefined || opts.hypothesis !== undefined || opts.reference !== undefined;
  const hasPositional = inputs.length > 0;

  if (hasPositional && hasInlineFlags) {
    failCommand(ErrorCode.VALIDATION, t("validate.evaluate.mixed_modes"));
    return;
  }

  // Sub-scores: only sent when the user explicitly set -m (else server default).
  // null means a parse/validation error was already reported; undefined means default.
  const subScores = metricsIsDefault ? undefined : parseAndValidateSubScores(opts.metrics);
  if (subScores === null) return;

  if (hasPositional) {
    // @file scoring is unsupported for tags (no file endpoint).
    if (inputs.some((input) => stripFilePrefix(input) !== null)) {
      failCommand(ErrorCode.VALIDATION, t("validate.evaluate.tags_no_file"));
      return;
    }
    await evaluateTagsBatchMode(inputs, subScores);
    return;
  }

  if (hasInlineFlags) {
    if (opts.reference !== undefined) {
      failCommand(ErrorCode.VALIDATION, t("validate.evaluate.tags_no_reference"));
      return;
    }
    if (!opts.source || !opts.hypothesis) {
      failCommand(ErrorCode.VALIDATION, t("validate.evaluate.missing_tags_inline_flags"));
      return;
    }
    await evaluateTagsInlineMode(opts.source, opts.hypothesis, subScores);
    return;
  }

  failCommand(ErrorCode.VALIDATION, t("validate.missing_argument", { name: "inputs" }));
}

async function evaluateTagsInlineMode(
  source: string,
  hypothesis: string,
  subScores: string[] | undefined
): Promise<void> {
  const startMs = Date.now();
  log.info("Command started", { command: "evaluate", mode: "tags-inline" });
  try {
    const response = await getApiClient().evaluation.scoreTags({
      segments: [{ source, hypothesis }],
      subScores,
      aggregation: "corpus",
    });

    log.info("Command completed", {
      command: "evaluate",
      mode: "tags-inline",
      duration_ms: String(Date.now() - startMs),
    });
    terminal.table(createEvaluationTableModel(toEvaluationResponseVM(response)));
  } catch (error: unknown) {
    handleCommandError(log, error, {
      command: "evaluate",
      mode: "tags-inline",
      duration_ms: String(Date.now() - startMs),
    });
  }
}

async function evaluateTagsBatchMode(
  files: string[],
  subScores: string[] | undefined
): Promise<void> {
  const startMs = Date.now();
  log.info("Command started", {
    command: "evaluate",
    mode: "tags-batch",
    files_count: String(files.length),
  });
  try {
    for (const file of files) {
      try {
        await access(file);
      } catch {
        failCommand(ErrorCode.CANCELLED, `${t("evaluate.file_not_found")} ${file}`);
        return;
      }

      const segments = await parseTagsTsvFile(file);
      if (!segments) return;

      const response = await getApiClient().evaluation.scoreTags({
        segments,
        subScores,
        aggregation: "both",
      });

      log.info("Command completed", {
        command: "evaluate",
        mode: "tags-batch",
        duration_ms: String(Date.now() - startMs),
        segments: String(response.segment_count),
      });
      terminal.table(createEvaluationTableModel(toEvaluationResponseVM(response)));
      terminal.info(`\n${t("evaluate.total", { count: String(response.segment_count) })}`);
    }
  } catch (error: unknown) {
    handleCommandError(log, error, {
      command: "evaluate",
      mode: "tags-batch",
      duration_ms: String(Date.now() - startMs),
    });
  }
}
