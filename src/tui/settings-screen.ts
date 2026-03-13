/**
 * Interactive settings screen using pi-tui TUI + SettingsList component.
 *
 * Draft state model: changes accumulate in memory, shown with `*` marker.
 * Enter = save all + exit, Esc = discard + exit, Space/Left/Right = cycle values.
 */

import chalk from "chalk";
import {
  ProcessTerminal,
  TUI,
  Container,
  SettingsList,
  Text,
  type SettingItem as PiSettingItem,
  type SettingsListTheme,
  type Component,
  matchesKey,
  Key,
} from "@mariozechner/pi-tui";
import { terminal } from "../output/terminal.ts";
import {
  getSettings,
  getConfigValue,
  setConfigValue,
  writeConfigToml,
  reloadSettings,
  API_URL_PRESETS,
  clearTokens,
  isAuthenticated,
} from "../config/index.ts";
import { getApiClient, resetApiClient } from "../api/client.ts";
import { setCurlEnabled } from "../api/curl.ts";
import { t, setTranslations } from "../i18n/index.ts";
import { translateCatalog } from "../i18n/translator.ts";
import { createTranslator } from "../api/translator-adapter.ts";
import { createProgressSink } from "../output/progress-display.ts";
import { getLogger } from "../logging/index.ts";
import { fmtCmd } from "../runtime/execution-mode.ts";

const log = getLogger(import.meta.url);

// --- Setting Item Definitions ---

interface ConfigItem {
  key: string;
  label: string;
  kind: "bool" | "select" | "cycle";
  options?: string[];
}

/** TUI-visible settings. */
const TUI_ITEMS: ConfigItem[] = [
  { key: "api-base-url", label: "API URL", kind: "select" },
  { key: "language", label: "Language", kind: "cycle", options: ["en"] },
  { key: "show-curl", label: "Show curl", kind: "bool" },
  { key: "telemetry-enabled", label: "Telemetry", kind: "bool" },
];

// --- Draft State ---

interface DraftState {
  original: Map<string, string>;
  current: Map<string, string>;
}

function createDraft(items: PiSettingItem[]): DraftState {
  return {
    original: new Map(items.map((i) => [i.id, i.currentValue])),
    current: new Map(items.map((i) => [i.id, i.currentValue])),
  };
}

function hasDraftChanges(draft: DraftState): boolean {
  for (const [id, value] of draft.current) {
    if (value !== draft.original.get(id)) return true;
  }
  return false;
}

/** Cycle item value forward (+1) or backward (-1) and update draft. */
function cycleValue(
  items: PiSettingItem[],
  index: number,
  direction: 1 | -1,
  draft: DraftState
): void {
  const item = items[index];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive: index may be out of bounds
  if (!item?.values || item.values.length <= 1) return;
  const currentIdx = item.values.indexOf(item.currentValue);
  const nextIdx = (currentIdx + direction + item.values.length) % item.values.length;
  item.currentValue = item.values[nextIdx];
  draft.current.set(item.id, item.currentValue);
  updateLabelMarkers(items, draft);
}

/** Mutate item labels: append ` *` for modified settings (Gemini CLI pattern). */
function updateLabelMarkers(items: PiSettingItem[], draft: DraftState): void {
  for (const item of items) {
    const cfg = TUI_ITEMS.find((c) => c.key === item.id);
    if (!cfg) continue;
    const isModified = draft.current.get(item.id) !== draft.original.get(item.id);
    item.label = isModified ? `${cfg.label} *` : cfg.label;
  }
}

// --- Language Fetching ---

/** Fetch available UI languages from languages API (source=en → all targets). */
async function fetchAvailableLanguages(): Promise<string[]> {
  if (!isAuthenticated()) return ["en"];
  try {
    const pairs = await getApiClient().languages.list("en");
    const langs = new Set<string>(["en"]);
    for (const pair of pairs) {
      if (!pair.target.includes("-")) langs.add(pair.target);
    }
    return [...langs].toSorted((a, b) => a.localeCompare(b));
  } catch (error: unknown) {
    log.warn("Failed to fetch languages", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return ["en"];
  }
}

/** Fire-and-forget: update language item values when API responds. */
function initLanguageOptions(items: PiSettingItem[], requestRender?: () => void): void {
  const langItem = items.find((i) => i.id === "language");
  if (!langItem) return;
  langItem.values = [String(getConfigValue("language"))];
  if (!isAuthenticated()) {
    langItem.description = t("config.language.login_required", { cmd: fmtCmd("login") });
    return;
  }
  void fetchAvailableLanguages().then((langs) => {
    langItem.values = langs;
    requestRender?.();
  });
}

// --- Apply Draft Changes ---

/**
 * Persist only changed values and run side-effects.
 *
 * Order: language change (while still authenticated) -> sync changes -> API URL side-effects.
 * Progress: uses ProgressContext from AsyncLocalStorage (REPL → progress bar, standalone → ora).
 */
async function applyDraftChanges(draft: DraftState): Promise<void> {
  if (!hasDraftChanges(draft)) return;

  const changes = new Map<string, string>();
  for (const [id, value] of draft.current) {
    if (value !== draft.original.get(id)) changes.set(id, value);
  }

  // Phase 1: Language change first (before API URL change clears auth)
  const newLang = changes.get("language");
  const oldLang = draft.original.get("language") ?? "en";
  if (newLang) {
    if (newLang === "en") {
      setTranslations({}, "en");
      terminal.success(t("config.language.success", { from: oldLang, lang: "en" }));
    } else if (isAuthenticated()) {
      try {
        const translator = createTranslator();
        const settings = getSettings();
        const result = await translateCatalog(
          translator,
          newLang,
          settings.cli.batch_size,
          createProgressSink(`Translating CLI to ${newLang}...`)
        );
        if (Object.keys(result.translations).length > 0) {
          setTranslations(result.translations, newLang);
          terminal.success(t("config.language.success", { from: oldLang, lang: newLang }));
        } else if (!result.fromCache) {
          terminal.warn(t("config.language.failed", { lang: newLang }));
          changes.delete("language");
        }
      } catch {
        terminal.warn(t("config.language.failed", { lang: newLang }));
        changes.delete("language");
      }
    } else {
      terminal.warn(t("config.language.login_required", { cmd: fmtCmd("login") }));
      changes.delete("language");
    }
  }

  // Phase 2: Apply all changes to config (memory + disk)
  for (const [id, value] of changes) {
    setConfigValue(id, value);
  }
  writeConfigToml(getSettings());

  // Phase 3: Side-effects
  if (changes.has("show-curl")) {
    setCurlEnabled(changes.get("show-curl") === "true");
  }
  if (changes.has("api-base-url")) {
    clearTokens();
    resetApiClient();
    terminal.warn(t("config.tui.logout_warning"));
  }
}

// --- Value Helpers ---

function buildPiItems(): PiSettingItem[] {
  return TUI_ITEMS.map((item): PiSettingItem => {
    const currentValue = String(getConfigValue(item.key));
    let values: string[] | undefined;
    if (item.kind === "bool") values = ["true", "false"];
    else if (item.kind === "select") values = Object.values(API_URL_PRESETS);
    else if (item.options && item.options.length > 1) values = item.options;
    return { id: item.key, label: item.label, currentValue, values };
  });
}

// --- Theme ---

function buildTheme(piItems: PiSettingItem[], getIndex: () => number): SettingsListTheme {
  return {
    label: (text, selected) => (selected ? chalk.bold.cyan(text) : chalk.gray(text)),
    value: (text, selected) => {
      const colored = text === "false" ? chalk.red(text) : chalk.green(text);
      if (!selected) return colored;
      const item = piItems[getIndex()];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive: index may be out of bounds
      if (item?.values && item.values.length > 1) {
        return `${chalk.gray("\u2190")} ${colored} ${chalk.gray("\u2192")}`;
      }
      return colored;
    },
    description: (text) => chalk.gray(text),
    cursor: chalk.bold.cyan("> "),
    hint: () =>
      chalk.gray("  \u2190/\u2192/Space to change \u00B7 Enter to save \u00B7 Esc to discard"),
  };
}

// --- Shared Navigation Handler ---

/** Handle arrow-key navigation shared between overlay and standalone settings screen. */
function handleSettingsNav(
  data: string,
  piItems: PiSettingItem[],
  indexRef: { current: number },
  draft: DraftState,
  requestRender?: () => void
): { consume: true } | "tracked" | null {
  if (matchesKey(data, "up")) {
    indexRef.current = indexRef.current === 0 ? piItems.length - 1 : indexRef.current - 1;
    return "tracked";
  }
  if (matchesKey(data, "down")) {
    indexRef.current = indexRef.current === piItems.length - 1 ? 0 : indexRef.current + 1;
    return "tracked";
  }
  if (matchesKey(data, "left")) {
    cycleValue(piItems, indexRef.current, -1, draft);
    requestRender?.();
    return { consume: true };
  }
  if (matchesKey(data, "right")) {
    cycleValue(piItems, indexRef.current, 1, draft);
    requestRender?.();
    return { consume: true };
  }
  return null;
}

// --- Overlay Factory (for REPL) ---

export type SettingsInputInterceptor = (data: string) => { consume: boolean } | undefined;

/**
 * Create a settings overlay component for use with tui.showOverlay().
 * Returns container, focus target, and input interceptor for Enter/Left/Right/arrow tracking.
 */
export function createSettingsOverlay(
  onClose: () => void,
  onSave: (applyFn: () => Promise<void>) => void,
  requestRender?: () => void
): {
  container: Component;
  focusTarget: Component;
  inputInterceptor: SettingsInputInterceptor;
} {
  reloadSettings();
  const piItems = buildPiItems();
  const draft = createDraft(piItems);
  const indexRef = { current: 0 };
  const theme = buildTheme(piItems, () => indexRef.current);

  const container = new Container();
  container.addChild(new Text(chalk.bold.cyan(`  ${t("config.tui.title")}`)));

  const settingsList = new SettingsList(
    piItems,
    TUI_ITEMS.length + 2,
    theme,
    (id, newValue) => {
      // Space-triggered cycle — update draft, no persistence
      draft.current.set(id, newValue);
      updateLabelMarkers(piItems, draft);
    },
    onClose // Esc = discard and close
  );
  container.addChild(settingsList);

  initLanguageOptions(piItems, requestRender);

  const inputInterceptor: SettingsInputInterceptor = (data) => {
    const nav = handleSettingsNav(data, piItems, indexRef, draft);
    if (nav === "tracked") return;
    if (nav) return nav;
    // Enter = save all and close
    if (matchesKey(data, "enter")) {
      onClose();
      onSave(() => applyDraftChanges(draft));
      return { consume: true };
    }
    return;
  };

  return { container, focusTarget: settingsList, inputInterceptor };
}

// --- Main Entry ---

/**
 * Run interactive fullscreen settings screen.
 *
 * Enter = save changes, Esc/q/Ctrl+C = discard changes.
 * Requires TTY (interactive terminal).
 */
export function runSettingsScreen(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      terminal.warn(t("config.tui.not_tty"));
      resolve();
      return;
    }

    reloadSettings();

    const pt = new ProcessTerminal();
    const tui = new TUI(pt);
    const piItems = buildPiItems();
    const draft = createDraft(piItems);
    const indexRef = { current: 0 };
    const theme = buildTheme(piItems, () => indexRef.current);

    const discard = (): void => {
      tui.stop();
      resolve();
    };

    const save = (): void => {
      tui.stop();
      // In standalone mode, use ora spinner for language translation progress
      applyDraftChanges(draft).then(
        () => {
          resolve();
        },
        (error: unknown) => {
          log.error("Settings save failed", error instanceof Error ? error : undefined);
          terminal.error("SETTINGS_SAVE", t("config.tui.save_error"));
          resolve();
        }
      );
    };

    const settingsList = new SettingsList(
      piItems,
      TUI_ITEMS.length + 2,
      theme,
      (id, newValue) => {
        // Space-triggered cycle — update draft, no persistence
        draft.current.set(id, newValue);
        updateLabelMarkers(piItems, draft);
      },
      discard // Esc = discard
    );

    tui.addChild(new Text(chalk.bold.cyan(`  ${t("config.tui.title")}`)));
    tui.addChild(settingsList);
    tui.setFocus(settingsList);

    tui.addInputListener((data) => {
      const nav = handleSettingsNav(data, piItems, indexRef, draft, () => {
        tui.requestRender();
      });
      if (nav === "tracked") return;
      if (nav) return nav;
      // Enter = save
      if (matchesKey(data, "enter")) {
        save();
        return { consume: true };
      }
      // q / Ctrl+C = discard
      if (data === "q" || matchesKey(data, Key.ctrl("c"))) {
        discard();
        return { consume: true };
      }
      return;
    });

    initLanguageOptions(piItems, () => {
      tui.requestRender();
    });
    tui.start();
  });
}
