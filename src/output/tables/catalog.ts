import chalk from "chalk";
import { t } from "../../i18n/index.ts";
import type { LanguageEntryVM, FormatEntryVM } from "../view-models.ts";
import type { TableColumn, TableModel } from "./types.ts";

/** Unified language table — adapts columns based on whether target is present.
 *  Translation: Source, Target, Engine. Annotation: Source, Engine. */
export function createLanguageEntryTableModel(entries: LanguageEntryVM[]): TableModel {
  const hasTarget = entries.some((e) => e.target != null);
  const columns: TableColumn[] = [
    { key: "source", header: t("table.col.source"), width: 28, required: true, priority: 0 },
  ];
  if (hasTarget) {
    columns.push({
      key: "target",
      header: t("table.col.target"),
      width: 28,
      required: true,
      priority: 0,
    });
  }
  columns.push(
    { key: "engines", header: t("table.col.engine"), minWidth: 12, required: true, priority: 0 },
    { key: "examples", header: "Examples", width: 26, priority: 1 }
  );
  return {
    columns,
    rows: entries.map((e) => ({
      source: e.source,
      ...(hasTarget ? { target: e.target ?? "" } : {}),
      engines: e.engines,
      examples: e.examples,
    })),
    compactOrder: hasTarget
      ? ["source", "target", "engines", "examples"]
      : ["source", "engines", "examples"],
  };
}

/** Unified table for all --formats commands. */
export function createFormatsTableModel(formats: FormatEntryVM[]): TableModel {
  const hasExamples = formats.some((f) => f.examples !== "");
  const columns: TableColumn[] = [
    { key: "extensions", header: t("table.col.input"), width: 16, required: true, priority: 0 },
    { key: "description", header: "Description", minWidth: 16, priority: 20 },
    { key: "output_formats", header: "Output Formats (default: input)", minWidth: 14, priority: 1 },
  ];
  if (hasExamples) {
    columns.push({ key: "examples", header: "Examples", width: 26, priority: 10 });
  }

  return {
    columns,
    compactOrder: columns.map((c) => c.key),
    rows: formats.map((fmt) => ({
      extensions: fmt.extensions.map((e) => e.replace(/^\./, "")).join(", "),
      output_formats:
        fmt.output_formats.length > 0 ? fmt.output_formats.join(", ") : chalk.dim("-"),
      ...(hasExamples ? { examples: fmt.examples || chalk.dim("-") } : {}),
      description: fmt.description,
    })),
  };
}
