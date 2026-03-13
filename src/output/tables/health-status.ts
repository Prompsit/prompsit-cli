import chalk from "chalk";
import { t } from "../../i18n/index.ts";
import { HealthStatus, QE_THRESHOLD_FAIR, QE_THRESHOLD_GOOD } from "../../shared/constants.ts";
import type {
  HealthResponseVM,
  ServiceHealthInfoVM,
  TranslationResponseVM,
} from "../view-models.ts";
import type { TableColumn, TableModel } from "./types.ts";

function colorStatus(status: string): string {
  const lower = status.toLowerCase();
  if (lower === HealthStatus.OK || lower === HealthStatus.HEALTHY || lower === "connected") {
    return chalk.green(status);
  }

  if (
    lower === HealthStatus.ERROR ||
    lower === HealthStatus.UNREACHABLE ||
    lower === "unhealthy" ||
    lower === "disconnected" ||
    lower === "timeout" ||
    lower === "unavailable"
  ) {
    return chalk.red(status);
  }

  if (lower === HealthStatus.DEGRADED || lower === "fallback_memory") {
    return chalk.yellow(status);
  }

  return chalk.dim(status);
}

function formatServiceStatus(info: ServiceHealthInfoVM): string {
  const base = colorStatus(info.status);
  if (info.version) {
    const versionTag = chalk.dim(`(v${info.version})`);
    return `${base} ${versionTag}`;
  }
  return base;
}

function colorQualityScore(score: number | null): string {
  if (score === null) return chalk.dim("N/A");
  if (score >= QE_THRESHOLD_GOOD) return chalk.green(score.toFixed(3));
  if (score >= QE_THRESHOLD_FAIR) return chalk.yellow(score.toFixed(3));
  return chalk.red(score.toFixed(3));
}

export function createHealthTableModel(health: HealthResponseVM, apiUrl?: string): TableModel {
  const rows: Record<string, string>[] = [];

  if (apiUrl) {
    rows.push({ component: "API URL", status: apiUrl });
  }
  rows.push(
    { component: t("table.health.api"), status: colorStatus(health.status) },
    { component: t("table.health.database"), status: colorStatus(health.database) },
    { component: "Redis", status: colorStatus(health.redis) }
  );

  for (const [name, service] of Object.entries(health.services)) {
    rows.push({
      component: name,
      status: formatServiceStatus(service),
    });
  }

  rows.push(
    { component: "Version", status: health.version },
    { component: "Timestamp", status: health.timestamp }
  );

  return {
    columns: [
      {
        key: "component",
        header: t("table.col.component"),
        width: 16,
        required: true,
        priority: 0,
      },
      { key: "status", header: t("table.col.status"), minWidth: 16, required: true, priority: 0 },
    ],
    rows,
    compactOrder: ["component", "status"],
  };
}

export function createTranslationTableModel(
  response: TranslationResponseVM,
  sources: string[]
): TableModel {
  const hasQeScores = response.translations.some((item) => item.quality_score !== null);

  const rows = response.translations.map((item, i) => {
    const row: Record<string, string> = {
      source: sources[i] ?? "",
      translation: item.translated_text,
    };

    if (hasQeScores) {
      row.qe = colorQualityScore(item.quality_score);
    }

    return row;
  });

  const columns: TableColumn[] = [
    { key: "source", header: t("table.col.source"), minWidth: 14, required: true, priority: 0 },
    {
      key: "translation",
      header: t("table.col.translation"),
      minWidth: 18,
      required: true,
      priority: 0,
    },
  ];

  if (hasQeScores) {
    columns.push({ key: "qe", header: t("table.col.qe_score"), width: 10, priority: 1 });
  }

  return {
    columns,
    rows,
    compactOrder: ["source", "translation", "qe"],
  };
}
