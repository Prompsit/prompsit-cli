// Status bar component — renders a single line with connection/language/curl info.
// Wraps buildStatusBar() as a pi-tui Component.

import type { Component } from "@mariozechner/pi-tui";
import { buildStatusBar } from "../status-bar.ts";

export class StatusBarLine implements Component {
  invalidate(): void {
    // Stateless — rebuilds every render cycle from live config.
  }

  render(width: number): string[] {
    return [buildStatusBar(width)];
  }
}
