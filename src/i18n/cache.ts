import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { getConfigDir } from "../config/paths.ts";
import { atomicWriteFile } from "../config/file-utils.ts";
import { getLogger } from "../logging/index.ts";

const log = getLogger(import.meta.url);

export interface CacheLookupResult {
  hit: boolean;
  translations: Record<string, string> | null;
}

interface CacheData {
  _meta?: {
    catalog_hash?: string;
    version?: string;
    timestamp?: string;
    source_lang?: string;
    target_lang?: string;
  };
  [key: string]: unknown;
}

function getTranslationsDir(): string {
  const dir = join(getConfigDir(), "translations");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const LANG_CODE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;

function getCachePath(lang: string): string {
  if (!LANG_CODE_RE.test(lang)) {
    throw new Error(`Invalid language code: ${lang}`);
  }
  return join(getTranslationsDir(), `${lang}.json`);
}

function extractTranslations(data: CacheData): Record<string, string> | null {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith("_") && typeof v === "string") {
      result[k] = v;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Load cached translations for a language.
 * Cache hit only when file exists, is valid JSON, has translations,
 * and catalog_hash matches the current English catalog hash.
 */
export function loadCache(lang: string, currentHash: string): CacheLookupResult {
  const path = getCachePath(lang);
  if (!existsSync(path)) {
    log.debug("cache miss (file not found)", { lang });
    return { hit: false, translations: null };
  }

  try {
    const raw = readFileSync(path, "utf8");
    const data = JSON.parse(raw) as CacheData;
    const translations = extractTranslations(data);
    if (!translations) {
      log.debug("cache miss (no translations)", { lang });
      return { hit: false, translations: null };
    }

    if (data._meta?.catalog_hash !== currentHash) {
      log.debug("cache stale (hash mismatch)", {
        lang,
        cached: data._meta?.catalog_hash ?? "none",
        current: currentHash,
      });
      return { hit: false, translations }; // stale but usable
    }

    log.debug("cache hit", { lang, keys: String(Object.keys(translations).length) });
    return { hit: true, translations };
  } catch {
    log.debug("cache miss (parse error)", { lang });
    return { hit: false, translations: null };
  }
}

export function saveCache(
  lang: string,
  translations: Record<string, string>,
  catalogHash: string
): void {
  const data: CacheData = {
    _meta: {
      catalog_hash: catalogHash,
      version: "2.0",
      timestamp: new Date().toISOString(),
      source_lang: "en",
      target_lang: lang,
    },
    ...translations,
  };

  const path = getCachePath(lang);
  atomicWriteFile(path, JSON.stringify(data, null, 2));
  log.debug("cache saved", { lang, keys: String(Object.keys(translations).length) });
}

export function computeCatalogHash(strings: Record<string, string>): string {
  const sorted = Object.entries(strings).toSorted(([a], [b]) => a.localeCompare(b));
  return createHash("md5").update(JSON.stringify(sorted)).digest("hex").slice(0, 8);
}
