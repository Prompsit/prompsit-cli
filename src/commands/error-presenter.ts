import type { StringKey } from "../i18n/index.ts";
import type { ErrorClassification } from "../errors/catalog.ts";
import { fmtCmd } from "../runtime/execution-mode.ts";

export interface PresentedError {
  label: string;
  message: string;
  hint: string | null;
  code: string;
}

export type TranslateFn = (key: StringKey, params?: Record<string, string>) => string;

/** Apply fmtCmd() to "cmd" key in hintParams so catalog stays pure data. */
function formatHintParams(params?: Record<string, string>): Record<string, string> | undefined {
  if (!params?.["cmd"]) return params;
  return { ...params, cmd: fmtCmd(params["cmd"]) };
}

export function presentError(classification: ErrorClassification, t: TranslateFn): PresentedError {
  const label = t(classification.labelKey as StringKey);
  const hintParams = formatHintParams(classification.hintParams);
  const resolvedHint = classification.hintKey
    ? t(classification.hintKey as StringKey, hintParams)
    : null;

  if (classification.useHintAsMessage) {
    return {
      label,
      message: resolvedHint ?? classification.message,
      hint: null,
      code: classification.code,
    };
  }

  return {
    label,
    message: classification.message,
    hint: resolvedHint,
    code: classification.code,
  };
}
