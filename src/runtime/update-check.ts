// Two-tier update check cache (disk + memory) for REPL welcome banner.
//
// Disk: ~/.prompsit/update-check.json with 24h TTL.
// Memory: module-level string for sync access from formatBannerLines().
//
// npm registry endpoint is public (no auth), warmed on REPL startup.
// Opt-out: set NO_UPDATE_NOTIFIER=1 env var to disable (standard convention).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config/paths.ts";
import { atomicWriteFile } from "../config/file-utils.ts";
import { getLogger } from "../logging/index.ts";
import { toErrorMessage } from "../errors/contracts.ts";
import { invalidateUI } from "./ui-invalidate.ts";

const log = getLogger(import.meta.url);

const TTL_MS = 86_400_000; // 24 hours
const FETCH_TIMEOUT_MS = 3000;
const REGISTRY_URL = "https://registry.npmjs.org/prompsit-cli/latest";

// ---------------------------------------------------------------------------
// Disk cache
// ---------------------------------------------------------------------------

interface DiskEntry {
  timestamp: string;
  latestVersion: string;
}

function diskPath(): string {
  return join(getConfigDir(), "update-check.json");
}

function loadDisk(): string | null {
  const path = diskPath();
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as DiskEntry;
    if (Date.now() - Date.parse(data.timestamp) > TTL_MS) return null;
    return data.latestVersion;
  } catch {
    return null;
  }
}

function saveDisk(version: string): void {
  const entry: DiskEntry = { timestamp: new Date().toISOString(), latestVersion: version };
  atomicWriteFile(diskPath(), JSON.stringify(entry, null, 2));
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let _latest: string | null = null;

// ---------------------------------------------------------------------------
// CalVer comparison
// ---------------------------------------------------------------------------

/** Compare CalVer segments: returns true if `latest` is newer than `current`. */
export function isNewerVersion(current: string, latest: string): boolean {
  const c = current.split(".").map(Number);
  const l = latest.split(".").map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0;
    const lv = l[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Sync getter — returns latest npm version or null if not yet checked. */
export function getLatestVersion(): string | null {
  return _latest;
}

/**
 * Background-warm update check. Load from disk if fresh, else fetch npm registry.
 * Best-effort: errors are logged, never thrown.
 */
export async function warmUpdateCheck(): Promise<void> {
  if (process.env.NO_UPDATE_NOTIFIER) return;

  const cached = loadDisk();
  if (cached) {
    _latest = cached;
    invalidateUI();
    log.debug("update check hit (disk)", { version: cached });
    return;
  }

  try {
    const response = await fetch(REGISTRY_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      log.debug("update check http error", { status: String(response.status) });
      return;
    }
    const data = (await response.json()) as { version?: string };
    if (typeof data.version === "string" && data.version.length > 0) {
      _latest = data.version;
      invalidateUI();
      saveDisk(data.version);
      log.debug("update check refreshed (npm)", { version: data.version });
    }
  } catch (error: unknown) {
    log.debug("update check failed (best-effort)", { error: toErrorMessage(error) });
  }
}
