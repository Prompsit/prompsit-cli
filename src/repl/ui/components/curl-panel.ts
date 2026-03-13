// Curl preview panel -- shows last API request as curl command above the editor.
// Visible only when curl display is enabled and a curl command exists.
// Pattern: same as ProgressBar (stateless Component, reads external state each render).

import chalk from "chalk";
import { truncateToWidth, type Component } from "@mariozechner/pi-tui";
import { getSanitizedCurl } from "../curl-store.ts";
import { isCurlEnabled } from "../../../api/curl.ts";
import { t } from "../../../i18n/index.ts";
import { REPL_COLORS } from "../data.ts";

const BORDER_CHAR = "\u2500"; // ─
const MAX_CURL_LINES = 3;

export class CurlPanel implements Component {
  invalidate(): void {
    // Stateless -- reads curl-store on each render.
  }

  render(width: number): string[] {
    if (!isCurlEnabled()) return [];

    const curl = getSanitizedCurl();
    if (!curl) return [];

    const lines: string[] = [""];

    // Border line with copy hint
    const hint = t("repl.curl_panel.copy_hint");
    const hintStyled = chalk.hex(REPL_COLORS.statusLabel)(` ${hint} `);
    const borderLen = Math.max(0, width - hint.length - 3);
    const border = chalk.hex(REPL_COLORS.statusSep)(BORDER_CHAR.repeat(borderLen));
    lines.push(truncateToWidth(`${hintStyled}${border}`, width));

    // Curl content (dark green, max 3 lines)
    const curlLines = curl.split("\n").slice(0, MAX_CURL_LINES);
    for (const cl of curlLines) {
      lines.push(truncateToWidth(chalk.hex(REPL_COLORS.curlText)(cl), width));
    }

    return lines;
  }
}
