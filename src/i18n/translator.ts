/**
 * Batch translation of CLI strings via Prompsit API.
 *
 * Translates the entire English catalog, validates placeholder preservation,
 * and saves results to the local cache. Uses ProgressSink for display
 * (caller injects a ProgressSink; falls back to NULL_SINK if omitted).
 */

import { STRINGS } from "./catalog.ts";
import { computeCatalogHash, loadCache, saveCache } from "./cache.ts";
import type { TranslatorPort } from "./translator-port.ts";
import { NULL_SINK, type ProgressSink } from "../runtime/progress-sink.ts";

export interface TranslateCatalogResult {
  translations: Record<string, string>;
  fromCache: boolean;
}

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/** Extract {name} placeholder names from a string. */
function extractPlaceholders(text: string): Set<string> {
  const matches = [...text.matchAll(PLACEHOLDER_RE)];
  return new Set(matches.map((m) => m[1]));
}

/**
 * Check if all original placeholders survived translation.
 * Returns false if any placeholder is missing from the translated text.
 */
function validatePlaceholders(original: string, translated: string): boolean {
  const origPh = extractPlaceholders(original);
  if (origPh.size === 0) return true;
  const transPh = extractPlaceholders(translated);
  for (const ph of origPh) {
    if (!transPh.has(ph)) return false;
  }
  return true;
}

/** Split array into chunks of given size. */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Translate all catalog strings to target language via Prompsit API.
 *
 * Returns cached translations immediately when catalog hash matches.
 * Otherwise translates via API, validates placeholders, and saves cache.
 *
 * @param translator - Translation API adapter
 * @param targetLang - Target language code (e.g. "es", "fr")
 * @param batchSize - Number of strings per API call (default 50)
 * @param progress - Optional progress sink for UI feedback (auto-detects if omitted)
 * @returns Translations and whether they came from cache
 */
export async function translateCatalog(
  translator: TranslatorPort,
  targetLang: string,
  batchSize = 50,
  progress?: ProgressSink
): Promise<TranslateCatalogResult> {
  const catalogHash = computeCatalogHash(STRINGS);
  const cached = loadCache(targetLang, catalogHash);
  if (cached.hit) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked by cached.hit
    return { translations: cached.translations!, fromCache: true };
  }

  const keys = Object.keys(STRINGS);
  const texts = Object.values(STRINGS);
  const total = keys.length;
  const batches = chunk(texts, batchSize);
  const batchKeys = chunk(keys, batchSize);
  const numBatches = batches.length;

  const translations: Record<string, string> = {};
  let hadBatchFailure = false;

  const sink = progress ?? NULL_SINK;

  for (let i = 0; i < numBatches; i++) {
    const progressMsg = `Translating to ${targetLang}: batch ${i + 1}/${numBatches} (${Object.keys(translations).length}/${total})`;
    sink.update(Math.round((i / numBatches) * 100), progressMsg);

    try {
      const translationsBatch = await translator.translateBatch(batches[i], "en", targetLang);

      for (let j = 0; j < batchKeys[i].length; j++) {
        const key = batchKeys[i][j];
        const original = STRINGS[key as keyof typeof STRINGS];
        const translated = translationsBatch[j];

        if (!translated) continue;

        // Validate placeholders preserved; fallback to English if lost
        translations[key] = validatePlaceholders(original, translated) ? translated : original;
      }
    } catch {
      // API error mid-batch: save what we have so far
      sink.warn(
        `API error at batch ${i + 1}/${numBatches}. Saving ${Object.keys(translations).length} translated strings.`
      );
      hadBatchFailure = true;
      break;
    }
  }

  // Save to cache (even partial translations are useful)
  if (Object.keys(translations).length > 0) {
    saveCache(targetLang, translations, catalogHash);
    if (!hadBatchFailure) {
      sink.succeed(
        `Translated ${Object.keys(translations).length}/${total} strings to ${targetLang}`
      );
    }
  } else {
    if (!hadBatchFailure) {
      sink.fail(`Failed to translate CLI to ${targetLang}`);
    }
  }

  return { translations, fromCache: false };
}
