import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HistoryComponent } from "../../src/repl/ui/components/history-component.ts";
import { outputBridge } from "../../src/repl/core/output-bridge.ts";

beforeEach(() => {
  outputBridge.enable();
});
afterEach(() => {
  outputBridge.disable();
});

function write(text: string): void {
  outputBridge.write({
    kind: "text",
    timestamp: Date.now(),
    stream: "stdout",
    level: "info",
    text,
  });
}

describe("HistoryComponent output continuity", () => {
  it("shows the newest output and includes later appends", () => {
    const component = new HistoryComponent(() => 3);
    for (let index = 0; index < 10; index += 1) write(`line-${index}`);

    const initial = component.render(80).join("\n");
    expect(initial).toContain("line-9");
    expect(initial).not.toContain("line-0");

    write("appended");
    expect(component.render(80).join("\n")).toContain("appended");
  });

  it("does not show stale output after clear resets event IDs", () => {
    const component = new HistoryComponent(() => 5);
    write("before-clear");
    component.render(80);

    outputBridge.clear();
    write("after-clear");
    const rendered = component.render(80).join("\n");
    expect(rendered).toContain("after-clear");
    expect(rendered).not.toContain("before-clear");
  });

  it("re-wraps output when the terminal width changes", () => {
    const component = new HistoryComponent(() => 20);
    write("A".repeat(80));

    expect(component.render(80).filter(Boolean)).toHaveLength(1);
    expect(component.render(20).filter(Boolean)).toHaveLength(4);
  });

  it("drops output removed by the bounded history buffer", () => {
    const component = new HistoryComponent(() => 500);
    for (let index = 0; index < 500; index += 1) write(`line-${index}`);
    component.render(80);

    write("line-500");
    const rendered = component.render(80).map((line) => line.trim());
    expect(rendered).not.toContain("line-0");
    expect(rendered).toContain("line-500");
  });
});
