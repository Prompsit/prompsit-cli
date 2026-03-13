import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HistoryComponent } from "../../src/repl/ui/components/history-component.ts";
import { outputBridge } from "../../src/repl/core/output-bridge.ts";

beforeEach(() => { outputBridge.enable(); });
afterEach(() => { outputBridge.disable(); }); // disable() clears buffer

function component(maxLines: number): HistoryComponent {
  return new HistoryComponent(() => maxLines);
}

function writeLines(n: number): void {
  for (let i = 0; i < n; i++) {
    outputBridge.write({
      kind: "text",
      timestamp: Date.now(),
      stream: "stdout",
      level: "info",
      text: `line-${i}`,
    });
  }
}

describe("HistoryComponent", () => {
  it("shows the last N lines, not the first ones", () => {
    writeLines(10);
    const result = component(3).render(80).join("\n");
    expect(result).toContain("line-9");
    expect(result).not.toContain("line-0");
  });

  it("render result never exceeds the height limit", () => {
    writeLines(200);
    expect(component(20).render(80).length).toBeLessThanOrEqual(20);
  });

  it("returns empty content after outputBridge.clear()", () => {
    writeLines(10);
    outputBridge.clear();
    const result = component(20).render(80);
    // Padding ensures editor stays at terminal bottom — all lines are empty but present
    expect(result.every((line) => line === "")).toBe(true);
  });

  it("wraps long lines instead of truncating them", () => {
    outputBridge.write({
      kind: "text",
      timestamp: Date.now(),
      stream: "stdout",
      level: "info",
      text: "A".repeat(120), // 120 chars, rendered at width 40 → 3 physical lines
    });
    const result = component(10).render(40);
    const nonEmpty = result.filter((line) => line !== "");
    expect(nonEmpty.length).toBe(3);
    expect(nonEmpty.join("")).toContain("A".repeat(40));
  });

  it("height limit re-evaluated on each render — no stale state from previous call", () => {
    writeLines(5);
    let limit = 10;
    const c = new HistoryComponent(() => limit);
    const full = c.render(80);
    limit = 2;
    const trimmed = c.render(80);
    expect(trimmed.length).toBeLessThanOrEqual(2);
    expect(full.length).toBeGreaterThan(trimmed.length);
  });
});
