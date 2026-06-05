import { describe, expect, it } from "vitest";
import { formatEntriesToTsvRows } from "../../src/commands/show-formats.ts";
import {
  languagePairsToTsvRows,
  scoreLanguagesToTsvRows,
} from "../../src/commands/show-languages.ts";
import { metadataRowsToTsvRows } from "../../src/commands/show-metadata.ts";
import type { DataScoreLanguagesResponse, LanguagePairDetail } from "../../src/api/models.ts";
import type { FormatEntryVM } from "../../src/output/view-models.ts";
import type { MetadataRow } from "../../src/commands/show-metadata.ts";

describe("discovery TSV mappings", () => {
  it("expands translation language pairs into one row per engine", () => {
    const pairs: LanguagePairDetail[] = [
      {
        source: "es",
        source_name: "Spanish",
        target: "pt-BR",
        target_name: "Portuguese (Brazil)",
        engines: {
          apertium: { package: "apertium-es-pt", package_version: "1.1.6" },
          prompsit_mt: { package: null, package_version: null },
        },
      },
    ];

    expect(languagePairsToTsvRows(pairs)).toEqual([
      ["es", "pt-BR", "apertium", "apertium-es-pt", "1.1.6"],
      ["es", "pt-BR", "prompsit_mt", "", ""],
    ]);
  });

  it("maps score languages to id and name rows", () => {
    const response: DataScoreLanguagesResponse = {
      languages: [
        { id: "en", name: "English" },
        { id: "de", name: "German" },
      ],
      total: 2,
      default: "en",
    };

    expect(scoreLanguagesToTsvRows(response)).toEqual([
      ["en", "English"],
      ["de", "German"],
    ]);
  });

  it("expands formats across input extensions and output formats", () => {
    const formats: FormatEntryVM[] = [
      {
        extensions: [".arb", ".json"],
        description: "ARB",
        output_formats: ["arb", "json"],
        examples: "",
      },
    ];

    expect(formatEntriesToTsvRows(formats)).toEqual([
      ["arb", "arb"],
      ["arb", "json"],
      ["json", "arb"],
      ["json", "json"],
    ]);
  });

  it("maps metadata rows to option, description, and output", () => {
    const rows: MetadataRow[] = [
      {
        option: "lid",
        description: "Language identification",
        output: "lang: code_script",
      },
    ];

    expect(metadataRowsToTsvRows(rows)).toEqual([
      ["lid", "Language identification", "lang: code_script"],
    ]);
  });
});
