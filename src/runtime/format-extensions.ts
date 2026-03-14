// Two-tier format extensions cache (disk + memory) for file autocomplete filtering.
//
// Disk: ~/.prompsit/formats/{source}.json with 24h TTL.
// Memory: Map<command, Set<extension>> for sync access from getSuggestions().
//
// Format API endpoints are public (no auth required), so we warm on REPL startup.
// --formats command also updates the cache as a side effect.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config/paths.ts";
import { atomicWriteFile } from "../config/file-utils.ts";
import { getApiClient } from "../api/client.ts";
import { getLogger } from "../logging/index.ts";
import { toErrorMessage } from "../errors/contracts.ts";

const log = getLogger(import.meta.url);

/** Shared type across format-extensions and show-formats. */
export type FormatSource = "document" | "qe" | "score" | "annotate";

const TTL_MS = 86_400_000; // 24 hours

/** Command name → FormatSource mapping (includes aliases). */
const CMD_SOURCE: Readonly<Partial<Record<string, FormatSource>>> = {
  translate: "document",
  t: "document",
  eval: "qe",
  evaluate: "qe",
  score: "score",
  annotate: "annotate",
};

const ALL_SOURCES: readonly FormatSource[] = ["document", "qe", "score", "annotate"];

// ---------------------------------------------------------------------------
// Disk cache
// ---------------------------------------------------------------------------

interface DiskEntry {
  timestamp: string;
  extensions: string[];
}

function getFormatsDir(): string {
  const dir = join(getConfigDir(), "formats");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function diskPath(source: FormatSource): string {
  return join(getFormatsDir(), `${source}.json`);
}

function loadDisk(source: FormatSource): string[] | null {
  const path = diskPath(source);
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as DiskEntry;
    if (Date.now() - Date.parse(data.timestamp) > TTL_MS) return null; // expired
    return data.extensions;
  } catch {
    return null;
  }
}

function saveDisk(source: FormatSource, extensions: string[]): void {
  const entry: DiskEntry = { timestamp: new Date().toISOString(), extensions };
  atomicWriteFile(diskPath(source), JSON.stringify(entry, null, 2));
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchExtensions(source: FormatSource): Promise<string[]> {
  const api = getApiClient().discovery;
  switch (source) {
    case "document": {
      const formats = await api.documentFormats();
      return formats.flatMap((f) => f.extensions);
    }
    case "qe": {
      const formats = await api.qeFormats();
      return formats.flatMap((f) => f.extensions);
    }
    case "score": {
      const resp = await api.dataScoreFormats();
      return resp.formats.flatMap((f) => f.extensions);
    }
    case "annotate": {
      const resp = await api.dataAnnotateFormats();
      return resp.formats.flatMap((f) => f.extensions);
    }
  }
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

// source → Set<".docx", ".pdf", ...>
const _memory = new Map<FormatSource, ReadonlySet<string>>();

function storeInMemory(source: FormatSource, extensions: string[]): void {
  // Normalize: ensure dot prefix, deduplicate
  const normalized = new Set(extensions.map((e) => (e.startsWith(".") ? e : `.${e}`)));
  _memory.set(source, normalized);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Background-warm all format sources. Load from disk if fresh, else fetch API.
 * Best-effort: errors are logged, never thrown.
 */
export async function warmFormatExtensions(): Promise<void> {
  const fetches: Promise<void>[] = [];

  for (const source of ALL_SOURCES) {
    const cached = loadDisk(source);
    if (cached) {
      storeInMemory(source, cached);
      log.debug("format cache hit (disk)", { source });
      continue;
    }
    // Stale or missing → fetch from API
    fetches.push(
      fetchExtensions(source)
        .then((exts) => {
          storeInMemory(source, exts);
          saveDisk(source, exts);
          log.debug("format cache refreshed (api)", { source, count: String(exts.length) });
        })
        .catch((error: unknown) => {
          log.warn("format cache fetch failed", { source, error: toErrorMessage(error) });
        })
    );
  }

  await Promise.all(fetches);
}

/**
 * Save already-fetched extensions to cache (avoids re-fetching in --formats).
 */
export function saveFormatExtensions(source: FormatSource, extensions: string[]): void {
  storeInMemory(source, extensions);
  saveDisk(source, extensions);
}

/**
 * Get allowed file extensions for a REPL command name.
 * Returns null if command is unknown or cache not populated yet.
 */
export function getAllowedExtensions(command: string): ReadonlySet<string> | null {
  const source = CMD_SOURCE[command];
  if (!source) return null;
  return _memory.get(source) ?? null;
}
