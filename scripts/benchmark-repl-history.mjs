import { performance } from "node:perf_hooks";
import { HistoryComponent } from "../src/repl/ui/components/history-component.ts";
import { outputBridge } from "../src/repl/core/output-bridge.ts";

const WIDTH = 120;
const MAX_LINES = 40;
const EVENT_COUNT = 500;
const SAMPLE_COUNT = 50;
const TARGET_P95_MS = 16.7;

function percentile(samples, quantile) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * quantile) - 1];
}

function measure(render) {
  const startedAt = performance.now();
  render();
  return performance.now() - startedAt;
}

const payload = Array.from({ length: 10 }, (_, index) => `${index}: ${"x".repeat(177)}`).join("\n");
const event = (timestamp) => ({
  kind: "text",
  timestamp,
  stream: "stdout",
  level: "info",
  text: payload,
});

outputBridge.enable();
for (let index = 0; index < EVENT_COUNT; index += 1) outputBridge.write(event(index));

const component = new HistoryComponent(() => MAX_LINES);
for (let index = 0; index < 5; index += 1) component.render(WIDTH);

const steady = Array.from({ length: SAMPLE_COUNT }, () => measure(() => component.render(WIDTH)));
const append = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
  outputBridge.write(event(EVENT_COUNT + index));
  return measure(() => component.render(WIDTH));
});
outputBridge.disable();

const result = {
  workload: { width: WIDTH, maxLines: MAX_LINES, events: EVENT_COUNT, linesPerEvent: 10 },
  steady: { p50: percentile(steady, 0.5), p95: percentile(steady, 0.95) },
  append: { p50: percentile(append, 0.5), p95: percentile(append, 0.95) },
  targetP95: TARGET_P95_MS,
};

console.log(JSON.stringify(result));
if (result.steady.p95 >= TARGET_P95_MS || result.append.p95 >= TARGET_P95_MS) {
  process.exitCode = 1;
}
