// Horizontal progress bar component for REPL TUI.
// Renders exactly 1 line (no spacer) to eliminate gap between editor and status area.
// No left-side label — the command is visible in history above the bar.

import chalk from "chalk";
import type { TUI, Component } from "@mariozechner/pi-tui";
import { REPL_COLORS } from "../data.ts";

const FILLED = "\u2588"; // █
const EMPTY = "\u2591"; // ░

export class ProgressBar implements Component {
  private percent = 0;
  private step: string | null = null;
  private readonly ui: TUI;

  constructor(ui: TUI) {
    this.ui = ui;
  }

  update(percent: number, step: string | null): void {
    this.percent = percent;
    this.step = step;
    this.ui.requestRender();
  }

  invalidate(): void {
    // Stateless render -- no cache to clear.
  }

  render(width: number): string[] {
    const pctText = `${this.percent}%`;
    const stepText = this.step ? `  ${this.step}` : "";
    const suffix = ` ${pctText}${stepText} `;

    const barWidth = Math.max(4, width - suffix.length);
    const filled = Math.round((this.percent / 100) * barWidth);
    const empty = barWidth - filled;

    const bar =
      chalk.hex(REPL_COLORS.promptArrow)(FILLED.repeat(filled)) +
      chalk.hex(REPL_COLORS.statusSep)(EMPTY.repeat(empty));

    const pctPart = chalk.white(` ${pctText}`);
    const stepPart = this.step ? chalk.hex(REPL_COLORS.statusLabel)(`  ${this.step}`) : "";

    return [`${bar}${pctPart}${stepPart}`];
  }
}
