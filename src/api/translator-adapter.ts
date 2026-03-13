// Shared TranslatorPort factory — adapts API client to translator interface.

import { getApiClient } from "./client.ts";
import type { TranslatorPort } from "../i18n/translator-port.ts";

export function createTranslator(): TranslatorPort {
  const client = getApiClient();
  return {
    async translateBatch(texts, sourceLang, targetLang) {
      const response = await client.translation.translate({ texts, sourceLang, targetLang });
      return response.translations.map((item) => item.translated_text);
    },
  };
}
