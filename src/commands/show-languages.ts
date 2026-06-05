// Centralized --languages handler for translate and score commands.
// Fetches language data from API, maps to view models, and renders tables.

import { getApiClient } from "../api/client.ts";
import { terminal, createLanguageEntryTableModel } from "../output/index.ts";
import type { LanguageEntryVM } from "../output/view-models.ts";
import type { DataScoreLanguagesResponse, LanguagePairDetail } from "../api/models.ts";
import { t } from "../i18n/index.ts";
import { handleCommandError } from "./error-handler.ts";
import { getLogger } from "../logging/index.ts";
import { isTsvOutput, writeTsvRows, type InfoOutputOptions } from "./info-output.ts";

const log = getLogger(import.meta.url);

interface TranslationFilters {
  source?: string;
  target?: string;
}

export async function showLanguages(
  filters?: TranslationFilters,
  options?: InfoOutputOptions
): Promise<void> {
  try {
    const pairs = await fetchLanguagePairs(filters);
    if (isTsvOutput(options)) {
      writeTsvRows(languagePairsToTsvRows(pairs));
      return;
    }

    const entries = languagePairsToTableEntries(pairs);
    if (entries.length === 0) {
      terminal.info(t("languages.no_results"));
      if (filters?.source || filters?.target)
        terminal.info(
          t("languages.filters", { source: filters.source ?? "*", target: filters.target ?? "*" })
        );
      return;
    }
    terminal.table(createLanguageEntryTableModel(entries));
    terminal.info(`\n${t("languages.total", { count: String(entries.length) })}`);
  } catch (error: unknown) {
    handleCommandError(log, error, { command: "languages" });
  }
}

async function fetchLanguagePairs(filters?: TranslationFilters): Promise<LanguagePairDetail[]> {
  const api = getApiClient();
  return api.languages.list(filters?.source, filters?.target);
}

function languagePairsToTableEntries(pairs: readonly LanguagePairDetail[]): LanguageEntryVM[] {
  return pairs.map((p) => ({
    source: `${p.source} - ${p.source_name}`,
    target: `${p.target} - ${p.target_name}`,
    engines: Object.entries(p.engines)
      .map(([name, detail]) => {
        if (!detail.package) return name;
        const ver = detail.package_version ? `:${detail.package_version}` : "";
        return `${name} [${detail.package}${ver}]`;
      })
      .join(", "),
    examples: `-s "${p.source}" -t "${p.target}"`,
  }));
}

export function languagePairsToTsvRows(pairs: readonly LanguagePairDetail[]): string[][] {
  const rows: string[][] = [];
  for (const pair of pairs) {
    for (const [engine, detail] of Object.entries(pair.engines)) {
      rows.push([
        pair.source,
        pair.target,
        engine,
        detail.package ?? "",
        detail.package_version ?? "",
      ]);
    }
  }
  return rows;
}

/** Show supported source languages for Bicleaner scoring (score --languages). */
export async function showScoringLanguages(options?: InfoOutputOptions): Promise<void> {
  try {
    const api = getApiClient();
    const resp = await api.discovery.dataScoreLanguages();

    if (isTsvOutput(options)) {
      writeTsvRows(scoreLanguagesToTsvRows(resp));
      return;
    }

    const entries: LanguageEntryVM[] = resp.languages.map((lang) => ({
      source: `${lang.id} - ${lang.name}`,
      target: null,
      engines: `bicleaner-ai multilingual model (${lang.id} -> *)`,
      examples: `-s "${lang.id}"`,
    }));

    if (entries.length === 0) {
      terminal.info(t("languages.no_results"));
      return;
    }

    terminal.table(createLanguageEntryTableModel(entries));
    terminal.info(`\n${t("languages.score_total", { count: String(entries.length) })}`);
  } catch (error: unknown) {
    handleCommandError(log, error, { command: "languages" });
  }
}

export function scoreLanguagesToTsvRows(resp: DataScoreLanguagesResponse): string[][] {
  return resp.languages.map((lang) => [lang.id, lang.name]);
}
