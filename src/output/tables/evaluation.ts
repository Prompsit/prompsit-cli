import chalk from "chalk";
import {
  BLEU_THRESHOLD_EXCELLENT,
  BLEU_THRESHOLD_GOOD,
  CHRF_THRESHOLD_EXCELLENT,
  CHRF_THRESHOLD_GOOD,
  METRICX_THRESHOLD_EXCELLENT,
  METRICX_THRESHOLD_GOOD,
} from "../../shared/constants.ts";
import { t } from "../../i18n/index.ts";
import type { EvaluationResponseVM } from "../view-models.ts";
import type { TableModel } from "./types.ts";

function formatMetricScore(
  metricName: string,
  score: number
): { scoreStr: string; quality: string } {
  const upper = metricName.toUpperCase();

  if (upper === "BLEU") {
    const scoreStr = score.toFixed(2);
    if (score >= BLEU_THRESHOLD_EXCELLENT) {
      return { scoreStr, quality: chalk.green(t("table.quality.excellent")) };
    }
    if (score >= BLEU_THRESHOLD_GOOD) {
      return { scoreStr, quality: chalk.yellow(t("table.quality.good")) };
    }
    return { scoreStr, quality: chalk.red(t("table.quality.poor")) };
  }

  if (upper === "COMET") {
    return { scoreStr: score.toFixed(4), quality: "—" };
  }

  if (upper === "METRICX") {
    const scoreStr = score.toFixed(4);
    if (score <= METRICX_THRESHOLD_EXCELLENT) {
      return { scoreStr, quality: chalk.green(t("table.quality.excellent")) };
    }
    if (score <= METRICX_THRESHOLD_GOOD) {
      return { scoreStr, quality: chalk.yellow(t("table.quality.good")) };
    }
    return { scoreStr, quality: chalk.red(t("table.quality.poor")) };
  }

  const scoreStr = score.toFixed(4);
  if (score >= CHRF_THRESHOLD_EXCELLENT) {
    return { scoreStr, quality: chalk.green(t("table.quality.excellent")) };
  }
  if (score >= CHRF_THRESHOLD_GOOD) {
    return { scoreStr, quality: chalk.yellow(t("table.quality.good")) };
  }
  return { scoreStr, quality: chalk.red(t("table.quality.poor")) };
}

export function createEvaluationTableModel(response: EvaluationResponseVM): TableModel {
  const rows: Record<string, string>[] = [];

  if (response.corpus_scores) {
    for (const [name, score] of Object.entries(response.corpus_scores)) {
      const { scoreStr, quality } = formatMetricScore(name, score);
      rows.push({
        metric: name.toUpperCase(),
        score: scoreStr,
        quality,
      });
    }
  }

  return {
    columns: [
      { key: "metric", header: t("table.col.metric"), width: 10, required: true, priority: 0 },
      { key: "score", header: t("table.col.score"), width: 10, required: true, priority: 0 },
      { key: "quality", header: t("table.col.quality"), minWidth: 10, priority: 1 },
    ],
    rows,
    compactOrder: ["metric", "score", "quality"],
  };
}
