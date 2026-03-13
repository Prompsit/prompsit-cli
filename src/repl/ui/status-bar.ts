// See API-500: Prompt session with dynamic status bar.
// Provides status bar text generation.

import chalk from "chalk";
import { isAuthenticated, getAccountId, getPlan } from "../../config/credentials.ts";
import { getSettings } from "../../config/settings.ts";
import { API_URL_PRESETS } from "../../config/constants.ts";
import { t } from "../../i18n/index.ts";
import { REPL_COLORS, STATUS_SEPARATOR } from "./data.ts";
import { getActiveHint } from "./hint-state.ts";

import { visibleWidth } from "../../output/ansi-utils.ts";
export { visibleWidth } from "../../output/ansi-utils.ts";

const TIP_MIN_COLUMNS = 80;

interface StatusSegment {
  id: "auth" | "env" | "lang";
  plain: string;
  color: string;
  priority: number;
}

function truncateText(text: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional Unicode code-point splitting
  const chars = [...text];
  if (chars.length <= maxWidth) return text;
  if (maxWidth <= 3) return ".".repeat(maxWidth);
  return chars.slice(0, maxWidth - 3).join("") + "...";
}

function renderRight(segments: StatusSegment[]): string {
  if (segments.length === 0) return "";
  const sep = chalk.hex(REPL_COLORS.statusSep)(STATUS_SEPARATOR);
  return segments.map((segment) => chalk.hex(segment.color)(segment.plain)).join(sep);
}

function fitRightSegments(segments: StatusSegment[], maxWidth: number): string {
  if (maxWidth <= 0) return "";

  let active = [...segments];
  while (active.length > 1 && visibleWidth(renderRight(active)) > maxWidth) {
    const drop = active.toSorted((a, b) => b.priority - a.priority)[0];
    active = active.filter((segment) => segment.id !== drop.id);
  }

  let rendered = renderRight(active);
  if (visibleWidth(rendered) <= maxWidth) return rendered;
  if (active.length === 0) return "";

  const [first] = active;
  rendered = chalk.hex(first.color)(truncateText(first.plain, maxWidth));
  return rendered;
}

/**
 * Build status bar text for display below the prompt.
 * Shows: tip | auth_status | env | lang
 * On narrow terminals, drops low-priority segments and hides tip first.
 */
export function buildStatusBar(columns: number): string {
  const safeColumns = Math.max(20, columns);

  const activeHint = getActiveHint();
  if (activeHint) {
    return chalk.hex(REPL_COLORS.hintText)(truncateText(activeHint, safeColumns));
  }

  const tip = t("repl.welcome.tip");

  let authLabel: string;
  let authColor: string;
  try {
    if (isAuthenticated()) {
      const account = getAccountId();
      const plan = getPlan();
      authLabel = account ?? t("repl.welcome.authorized");
      if (plan) authLabel += ` (${plan})`;
      authColor = REPL_COLORS.statusAuthOk;
    } else {
      authLabel = t("repl.welcome.not_authorized");
      authColor = REPL_COLORS.statusAuthFail;
    }
  } catch {
    authLabel = t("repl.welcome.not_authorized");
    authColor = REPL_COLORS.statusAuthFail;
  }

  let lang = "EN";
  let envLabel = "test";
  try {
    const settings = getSettings();
    lang = settings.cli.language.toUpperCase();
    const url = settings.api.base_url;
    const urlToName = new Map<string, string>(
      Object.entries(API_URL_PRESETS).map(([k, v]) => [v, k])
    );
    envLabel = urlToName.get(url) ?? "custom";
  } catch {
    // Keep defaults.
  }

  const rightSegments: StatusSegment[] = [
    { id: "auth", plain: authLabel, color: authColor, priority: 0 },
    { id: "env", plain: envLabel, color: REPL_COLORS.statusEnv, priority: 1 },
    { id: "lang", plain: lang, color: REPL_COLORS.statusLang, priority: 2 },
  ];

  const tipColored = chalk.hex(REPL_COLORS.statusLabel)(tip);

  if (safeColumns >= TIP_MIN_COLUMNS) {
    const right = fitRightSegments(rightSegments, safeColumns);
    if (right.length === 0) {
      return chalk.hex(REPL_COLORS.statusLabel)(truncateText(tip, safeColumns));
    }

    const space = safeColumns - visibleWidth(tipColored) - visibleWidth(right);
    if (space >= 2) {
      return `${tipColored}${" ".repeat(space)}${right}`;
    }
  }

  const rightOnly = fitRightSegments(rightSegments, safeColumns);
  if (rightOnly.length > 0) {
    return rightOnly;
  }

  return chalk.hex(REPL_COLORS.statusLabel)(truncateText(tip, safeColumns));
}
