import { API_URL_PRESETS, clearTokens, getValidConfigKeys } from "../../config/index.ts";
import { resetApiClient } from "../../api/client.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { t } from "../../i18n/index.ts";
import { terminal } from "../../output/index.ts";
import { failCommand } from "../error-handler.ts";

export type ConfigValueSource = "env" | "file" | "default";

function applyApiUrlChange(): void {
  clearTokens();
  resetApiClient();
}

/**
 * Apply API URL change side-effects and show a unified user warning/success.
 */
export function applyApiUrlChangeAndNotify(resolvedUrl?: string): void {
  applyApiUrlChange();
  terminal.warn(t("config.tui.logout_warning"));
  if (resolvedUrl !== undefined) {
    terminal.success(t("config.api_url.set_to", { url: resolvedUrl }));
  }
}

export function detectSource(
  section: string,
  field: string,
  tomlData: Record<string, unknown> | null,
  envData: Record<string, unknown>
): ConfigValueSource {
  const envSection = envData[section];
  if (envSection && typeof envSection === "object" && field in envSection) {
    return "env";
  }

  const sectionData = tomlData?.[section];
  if (sectionData && typeof sectionData === "object" && field in sectionData) {
    return "file";
  }

  return "default";
}

export function ensureValidConfigKey(key: string): boolean {
  const validKeys = getValidConfigKeys();
  if (validKeys.includes(key)) {
    return true;
  }

  failCommand(
    ErrorCode.CONFIG_INVALID,
    `${t("config.invalid_key")} ${key}. ${t("config.valid_keys")} ${validKeys.join(", ")}`
  );
  return false;
}

export function isApiPreset(value: string): value is keyof typeof API_URL_PRESETS {
  return value in API_URL_PRESETS;
}
