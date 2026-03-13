// Centralized --formats handler for all commands.
// Each command calls showFormats(source) instead of duplicating fetch + map + render logic.

import { getApiClient } from "../api/client.ts";
import { terminal, createFormatsTableModel } from "../output/index.ts";
import type { FormatEntryVM } from "../output/view-models.ts";
import { saveFormatExtensions, type FormatSource } from "../runtime/format-extensions.ts";
import { handleCommandError } from "./error-handler.ts";
import { getLogger } from "../logging/index.ts";

const log = getLogger(import.meta.url);

function buildExamples(selfId: string, outputFormats: string[]): string {
  const other = outputFormats.find((f) => f !== selfId);
  return other ? `--output-format "${other}"` : "";
}

/** Fetch format metadata from the appropriate API endpoint and render the unified table. */
export async function showFormats(source: FormatSource): Promise<void> {
  try {
    const entries = await fetchFormats(source);
    terminal.table(createFormatsTableModel(entries));
    // Side effect: update format extensions cache for file autocomplete
    saveFormatExtensions(
      source,
      entries.flatMap((e) => e.extensions)
    );
  } catch (error: unknown) {
    handleCommandError(log, error, { command: "formats" });
  }
}

async function fetchFormats(source: FormatSource): Promise<FormatEntryVM[]> {
  const api = getApiClient().discovery;

  switch (source) {
    case "document": {
      const formats = await api.documentFormats();
      return formats.map((f) => {
        const outputFormats = [...f.output_formats];
        const hasConversions = outputFormats.some((o) => o !== f.id);
        return {
          extensions: [...f.extensions],
          description: f.description,
          output_formats: outputFormats,
          examples: hasConversions ? buildExamples(f.id, outputFormats) : "",
        };
      });
    }

    case "qe": {
      const formats = await api.qeFormats();
      return formats.map((f) => {
        const hasConversions = f.output_formats.some((o) => o !== f.id);
        return {
          extensions: [...f.extensions],
          description: f.description,
          output_formats: [...f.output_formats],
          examples: hasConversions ? buildExamples(f.id, f.output_formats) : "",
        };
      });
    }

    case "score": {
      const resp = await api.dataScoreFormats();
      const hiddenFormats = new Set(["moses"]);
      return resp.formats
        .filter((f) => !hiddenFormats.has(f.id))
        .map((f) => {
          const outputFormats = f.output_formats.filter((o) => !hiddenFormats.has(o));
          const hasConversions = outputFormats.some((o) => o !== f.id);
          return {
            extensions: [...f.extensions],
            description: f.description,
            output_formats: outputFormats,
            examples: hasConversions ? buildExamples(f.id, outputFormats) : "",
          };
        });
    }

    case "annotate": {
      const resp = await api.dataAnnotateFormats();
      return resp.formats.map((f) => ({
        extensions: [...f.extensions],
        description: f.description,
        output_formats: [...f.output_formats],
        examples: "",
      }));
    }
  }
}
