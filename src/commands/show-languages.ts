// Centralized --languages handler for translate and score commands.
// Fetches language data from API, maps to view models, and renders tables.

import { getApiClient } from "../api/client.ts";
import { terminal, createLanguageEntryTableModel } from "../output/index.ts";
import type { LanguageEntryVM } from "../output/view-models.ts";
import { t } from "../i18n/index.ts";
import { handleCommandError } from "./error-handler.ts";
import { getLogger } from "../logging/index.ts";

const log = getLogger(import.meta.url);

interface TranslationFilters {
  source?: string;
  target?: string;
}

export async function showLanguages(filters?: TranslationFilters): Promise<void> {
  try {
    const entries = await fetchLanguages(filters);
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

async function fetchLanguages(filters?: TranslationFilters): Promise<LanguageEntryVM[]> {
  const api = getApiClient();
  const pairs = await api.languages.list(filters?.source, filters?.target);
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

/** Show supported source languages for Bicleaner scoring (score --languages). */
export async function showScoringLanguages(): Promise<void> {
  try {
    const api = getApiClient();
    const resp = await api.discovery.dataScoreLanguages();

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
