import { EventEmitter } from "node:events";
import type { OutputSinkItem } from "../../output/output-events.ts";

export interface OutputItem {
  id: number;
  event: ReplOutputEvent;
}

export type ReplOutputEvent = OutputSinkItem;

const MAX_BUFFER = 500;
const TRIM_TO = 400;

type TimerHandle = number | ReturnType<typeof setTimeout>;

class OutputBridge extends EventEmitter {
  private enabled = false;
  private nextId = 0;
  private buffer: OutputItem[] = [];
  private pendingBatch: OutputItem[] = [];
  private timerId: TimerHandle | null = null;

  constructor() {
    super();
    this.setMaxListeners(20);
  }

  private scheduleFlush = (() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- rAF absent in Node.js despite DOM types
    const hasRAF = globalThis.requestAnimationFrame !== undefined;
    if (hasRAF) {
      return () => {
        this.timerId ??= requestAnimationFrame(() => {
          this.flush();
        });
      };
    }

    return () => {
      this.timerId ??= setTimeout(() => {
        this.flush();
      }, 16);
    };
  })();

  enable(): void {
    this.enabled = true;
    this.buffer = [];
    this.pendingBatch = [];
    this.nextId = 0;
  }

  disable(): void {
    this.enabled = false;
    this.buffer = [];
    this.pendingBatch = [];
    this.nextId = 0;
    this.cancelFlush();
  }

  getHistory(): OutputItem[] {
    return [...this.buffer];
  }

  write(content: string | ReplOutputEvent): void {
    if (!this.enabled) return;

    const event: ReplOutputEvent =
      typeof content === "string"
        ? {
            kind: "text",
            timestamp: Date.now(),
            stream: "stdout",
            level: "info",
            text: content,
          }
        : content;

    const item: OutputItem = { id: this.nextId++, event };
    this.buffer.push(item);

    if (this.buffer.length > MAX_BUFFER) {
      this.buffer = this.buffer.slice(-TRIM_TO);
    }

    this.pendingBatch.push(item);
    this.scheduleFlush();
  }

  flushNow(): void {
    this.cancelFlush();
    this.flush();
  }

  private flush(): void {
    this.timerId = null;
    if (this.pendingBatch.length === 0) return;

    const batch = this.pendingBatch;
    this.pendingBatch = [];
    super.emit("outputBatch", batch);
  }

  private cancelFlush(): void {
    if (this.timerId === null) return;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cancelAnimationFrame absent in Node.js
    if (globalThis.cancelAnimationFrame === undefined) {
      clearTimeout(this.timerId as ReturnType<typeof setTimeout>);
    } else {
      cancelAnimationFrame(this.timerId as number);
    }

    this.timerId = null;
  }

  clear(): void {
    if (!this.enabled) return;
    this.cancelFlush();
    this.nextId = 0;
    this.buffer = [];
    this.pendingBatch = [];
    super.emit("clear");
  }
}

export const outputBridge = new OutputBridge();
