export interface TranslatorPort {
  translateBatch(texts: string[], sourceLang: string, targetLang: string): Promise<string[]>;
}
