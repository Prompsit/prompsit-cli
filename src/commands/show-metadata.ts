// Display annotate --metadata info table (metadata stages with descriptions and output fields).

import { terminal } from "../output/index.ts";
import type { TableModel } from "../output/tables/types.ts";

interface MetadataRow {
  description: string;
  option: string;
  output: string;
}

const METADATA_ROWS: MetadataRow[] = [
  {
    description:
      "Language identification (openlidv3): document-level (lang) and sentence-level (seg_langs)",
    option: "lid",
    output: "lang: code_script; seg_langs: [code_script, ...]",
  },
  {
    description: "Detect duplicate documents in a batch",
    option: "dedup",
    output: "cluster_size: number; duplicate: true/false",
  },
  {
    description: "Regex-based personal data identification (e-mails, phone numbers, IDs, etc.)",
    option: "pii",
    output: "pii: [unicode character offsets]",
  },
  {
    description: "Adult content flagging based on URL matching (UT1 lists)",
    option: "adult_filter",
    output: "filter: adult_ut1",
  },
  {
    description:
      "Character-level fixes for bad encoding, mojibake, HTML entities and trailing spaces",
    option: "monofixer",
    output: "monofixed: true/false",
  },
  {
    description:
      "Web document scoring (WDS): overall score (0-1) with 10 subscores for textual properties",
    option: "docscorer",
    output:
      "doc_scores: [WDS, language, url-ratio, punctuation-ratio, singular_chars-ratio, numbers-ratio, repetitions, n_long_segments, very-long_segment, compression-ratio, short_segments]",
  },
  {
    description: "Length-based document filtering (applied by default)",
    option: "(default)",
    output: "filter: [length_value | word_avg_value | char_avg_value]",
  },
];

function createMetadataTableModel(): TableModel {
  return {
    columns: [
      { key: "description", header: "Metadata", minWidth: 30, required: true, priority: 0 },
      { key: "option", header: "Option", width: 16, required: true, priority: 0 },
      { key: "output", header: "Output (compressed jsonl.zst)", minWidth: 20, priority: 1 },
    ],
    rows: METADATA_ROWS.map((r) => ({
      description: r.description,
      option: r.option,
      output: r.output,
    })),
    compactOrder: ["option", "description", "output"],
  };
}

/** Show available annotation metadata stages with descriptions and output fields. */
export function showAnnotateMetadata(): void {
  terminal.table(createMetadataTableModel());
}
