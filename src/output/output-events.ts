// Output event types shared between terminal adapter and REPL output bridge.
//
// Contract:
// - stdout payloads use `kind: "text"` or `kind: "table"` (plus REPL-local `command` echo).
// - stderr payloads use `kind: "system"` with `level` metadata.

import type { TableModel } from "./tables/index.ts";

export type OutputLevel = "info" | "error" | "success";
export type OutputStream = "stdout" | "stderr";

export type OutputSinkItem =
  | {
      kind: "command";
      timestamp: number;
      stream: OutputStream;
      level?: OutputLevel;
      text: string;
    }
  | {
      kind: "text";
      timestamp: number;
      stream: OutputStream;
      level?: OutputLevel;
      text: string;
    }
  | {
      kind: "system";
      timestamp: number;
      stream: OutputStream;
      level?: OutputLevel;
      text: string;
    }
  | {
      kind: "table";
      timestamp: number;
      stream: OutputStream;
      level?: OutputLevel;
      table: TableModel;
    };
