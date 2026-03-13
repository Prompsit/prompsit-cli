import { STRINGS } from "./catalog.ts";
import type { StringKey } from "./catalog.ts";
import { computeCatalogHash, loadCache } from "./cache.ts";
import { invalidateUI } from "../runtime/ui-invalidate.ts";

export type { StringKey } from "./catalog.ts";

let _translations: Record<string, string> = {};
let _currentLang = "en";
let _needsRefresh = false;

export function init(lang = "en"): void {
  _currentLang = lang;
  _needsRefresh = false;

  if (lang === "en") {
    _translations = {};
    return;
  }

  const currentHash = computeCatalogHash(STRINGS);
  const cached = loadCache(lang, currentHash);
  _translations = cached.translations ?? {};
  _needsRefresh = !cached.hit;
}

export function setTranslations(translations: Record<string, string>, lang: string): void {
  _translations = translations;
  _currentLang = lang;
  invalidateUI();
}

export function t(key: StringKey, params?: Record<string, string | number>): string {
  let text: string = _translations[key] ?? STRINGS[key];

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }

  return text;
}

export function currentLang(): string {
  return _currentLang;
}

/** True when cached translations are stale and should be re-fetched. */
export function needsRefresh(): boolean {
  return _needsRefresh;
}

export function clearRefreshFlag(): void {
  _needsRefresh = false;
}
