import chalk from "chalk";
import { TM_SIMILARITY_GOOD } from "../../shared/constants.ts";
import { t } from "../../i18n/index.ts";
import type { TmListVM, TmSegmentListVM, TmSearchVM } from "../view-models.ts";
import type { TableModel } from "./types.ts";

const TEXT_TRUNCATE = 80;

function truncate(text: string, max = TEXT_TRUNCATE): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

/** TM list table (tm show without lang flags). */
export function createTmListTableModel(data: TmListVM): TableModel {
  const rows: Record<string, string>[] = data.items.map((tm) => ({
    source_lang: tm.sourceLang,
    target_lang: tm.targetLang,
    segment_count: String(tm.segmentCount),
    created_at: new Date(tm.createdAt).toLocaleDateString(),
  }));

  return {
    columns: [
      {
        key: "source_lang",
        header: t("table.col.source_lang"),
        width: 10,
        required: true,
        priority: 0,
      },
      {
        key: "target_lang",
        header: t("table.col.target_lang"),
        width: 10,
        required: true,
        priority: 0,
      },
      {
        key: "segment_count",
        header: t("table.col.segment_count"),
        width: 12,
        required: true,
        priority: 0,
      },
      { key: "created_at", header: t("table.col.created_at"), minWidth: 12, priority: 1 },
    ],
    rows,
    compactOrder: ["source_lang", "target_lang", "segment_count"],
    emptyMessage: t("tm.show.empty"),
  };
}

/** TM segment list table (tm show -s -t). */
export function createTmSegmentTableModel(data: TmSegmentListVM): TableModel {
  const rows: Record<string, string>[] = data.items.map((seg) => ({
    source_text: truncate(seg.sourceText),
    target_text: truncate(seg.targetText),
    created_at: new Date(seg.createdAt).toLocaleDateString(),
  }));

  return {
    columns: [
      {
        key: "source_text",
        header: t("table.col.source_text"),
        minWidth: 20,
        required: true,
        priority: 0,
      },
      {
        key: "target_text",
        header: t("table.col.target_text"),
        minWidth: 20,
        required: true,
        priority: 0,
      },
      { key: "created_at", header: t("table.col.created_at"), width: 12, priority: 1 },
    ],
    rows,
    compactOrder: ["source_text", "target_text"],
    emptyMessage: t("tm.show.segments_empty"),
  };
}

/** TM search results table (tm search). F7: green >= 0.9, yellow for rest. */
export function createTmSearchTableModel(data: TmSearchVM): TableModel {
  const rows: Record<string, string>[] = data.hits.map((hit) => {
    const sim = hit.similarity;
    const simStr = (sim * 100).toFixed(0) + "%";
    const coloredSim = sim >= TM_SIMILARITY_GOOD ? chalk.green(simStr) : chalk.yellow(simStr);
    const coloredType =
      hit.matchType === "exact" ? chalk.green(hit.matchType) : chalk.yellow(hit.matchType);

    return {
      source_text: truncate(hit.sourceText),
      target_text: truncate(hit.targetText),
      similarity: coloredSim,
      match_type: coloredType,
    };
  });

  return {
    columns: [
      {
        key: "source_text",
        header: t("table.col.source_text"),
        minWidth: 20,
        required: true,
        priority: 0,
      },
      {
        key: "target_text",
        header: t("table.col.target_text"),
        minWidth: 20,
        required: true,
        priority: 0,
      },
      {
        key: "similarity",
        header: t("table.col.similarity"),
        width: 12,
        required: true,
        priority: 0,
      },
      { key: "match_type", header: t("table.col.match_type"), width: 8, priority: 1 },
    ],
    rows,
    compactOrder: ["source_text", "target_text", "similarity"],
    emptyMessage: t("tm.search.no_hits"),
  };
}
