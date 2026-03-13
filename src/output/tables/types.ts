export type TableRenderMode = "auto" | "table" | "compact";

export interface TableRenderContext {
  columns?: number;
  mode?: TableRenderMode;
}

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  priority?: number;
  required?: boolean;
}

export interface TableModel {
  columns: TableColumn[];
  rows: Record<string, string>[];
  compactOrder?: string[];
  emptyMessage?: string;
}

export interface ResolvedColumn {
  key: string;
  header: string;
  width?: number;
  minWidth: number;
  priority: number;
  required: boolean;
}
