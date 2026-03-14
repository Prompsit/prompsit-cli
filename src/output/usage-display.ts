// Usage bar renderer — colorized progress bars for daily API usage.
// Renders two pools: character usage (translation+QE) and corpus byte usage (annotation).

import chalk from "chalk";
import { t } from "../i18n/index.ts";
import type { UsageVM } from "./view-models.ts";

const BAR_WIDTH = 40;

const numFmt = new Intl.NumberFormat("en-US");

function colorByThreshold(pct: number, text: string): string {
  if (pct >= 90) return chalk.red(text);
  if (pct >= 70) return chalk.yellow(text);
  return chalk.green(text);
}

function formatResetTime(isoString: string): string {
  const resetDate = new Date(isoString);
  return resetDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function formatMB(bytes: number): string {
  return numFmt.format(Math.round(bytes / 1_000_000));
}

/** Render a single 3-line progress bar block. */
function renderBar(
  label: string,
  rightLabel: string,
  used: string,
  limit: string,
  percentage: number,
  resetAt: string,
  unit: string
): string[] {
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const filled = Math.round((clampedPct / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;

  const barFilled = colorByThreshold(percentage, "\u2588".repeat(filled));
  const barEmpty = chalk.dim("\u2591".repeat(empty));
  const pctText = colorByThreshold(percentage, `${String(percentage)}%`);

  const countsText = `${used} / ${limit}`;
  const resetTime = formatResetTime(resetAt);

  const line1Right = rightLabel;
  const line2 = `${barFilled}${barEmpty}  ${pctText} ${chalk.dim("used")}`;
  const line3Left = `${countsText} ${chalk.dim(unit)}`;
  const line3Right = `${t("usage.resets")} ${resetTime} UTC`;

  const pad1 = Math.max(0, BAR_WIDTH + 10 - label.length - line1Right.length);
  const pad3 = Math.max(0, BAR_WIDTH + 10 - line3Left.length - line3Right.length);

  return [
    `${label}${" ".repeat(pad1)}${chalk.dim(line1Right)}`,
    line2,
    `${line3Left}${" ".repeat(pad3)}${chalk.dim(line3Right)}`,
  ];
}

/**
 * Render dual usage bars for terminal display.
 *
 * Output (7 lines):
 *   Daily usage                              Tier: free
 *   ████████████████░░░░░░░░░░░░░░░░░░░░░░░  45.2% used
 *   45,200 / 500,000 chars                   Resets 00:00 UTC
 *
 *   Corpus usage
 *   ██████████████████████████████░░░░░░░░░░  75.0% used
 *   38 / 50 MB                               Resets 00:00 UTC
 */
export function renderUsageBar(vm: UsageVM): string {
  const tierRight = `${t("usage.tier")}: ${vm.tierName}`;

  const charsBar = renderBar(
    t("usage.daily_usage"),
    tierRight,
    numFmt.format(vm.charsUsed),
    numFmt.format(vm.charsLimit),
    vm.percentage,
    vm.resetAt,
    "chars"
  );

  const corpusBar = renderBar(
    t("usage.corpus_usage"),
    "",
    formatMB(vm.corpusBytesUsed),
    formatMB(vm.corpusBytesLimit),
    vm.corpusPercentage,
    vm.corpusResetAt,
    "MB"
  );

  return [...charsBar, "", ...corpusBar].join("\n");
}
