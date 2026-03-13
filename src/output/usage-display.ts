// Usage bar renderer — colorized progress bar for daily API usage.
// Separate from progress-display.ts (ora-specific) because this needs
// multi-line layout with chalk colors and number formatting.

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

/**
 * Render a multi-line usage bar for terminal display.
 *
 * Output (3 lines):
 *   Daily usage                              Tier: free
 *   ████████████████░░░░░░░░░░░░░░░░░░░░░░░  45.2% used
 *   45,200 / 100,000 chars                   Resets 00:00 UTC
 *
 * Bar fill is clamped to [0, 100] to prevent repeat() errors,
 * but actual percentage is shown in text (can exceed 100%).
 */
export function renderUsageBar(vm: UsageVM): string {
  const clampedPct = Math.min(Math.max(vm.percentage, 0), 100);
  const filled = Math.round((clampedPct / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;

  const barFilled = colorByThreshold(vm.percentage, "\u2588".repeat(filled));
  const barEmpty = chalk.dim("\u2591".repeat(empty));
  const pctText = colorByThreshold(vm.percentage, `${String(vm.percentage)}%`);

  const charsText = `${numFmt.format(vm.charsUsed)} / ${numFmt.format(vm.charsLimit)}`;

  // Parse reset time from ISO string
  const resetDate = new Date(vm.resetAt);
  const resetTime = resetDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  const line1Left = t("usage.daily_usage");
  const line1Right = `${t("usage.tier")}: ${vm.tierName}`;
  const line2 = `${barFilled}${barEmpty}  ${pctText} ${chalk.dim("used")}`;
  const line3Left = `${charsText} ${chalk.dim("chars")}`;
  const line3Right = `${t("usage.resets")} ${resetTime} UTC`;

  // Pad line1 and line3 to align right side
  const pad1 = Math.max(0, BAR_WIDTH + 10 - line1Left.length - line1Right.length);
  const pad3 = Math.max(0, BAR_WIDTH + 10 - line3Left.length - line3Right.length);

  const lines = [
    `${line1Left}${" ".repeat(pad1)}${chalk.dim(line1Right)}`,
    line2,
    `${line3Left}${" ".repeat(pad3)}${chalk.dim(line3Right)}`,
  ];

  return lines.join("\n");
}
