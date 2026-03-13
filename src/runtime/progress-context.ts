import { AsyncLocalStorage } from "node:async_hooks";

export type ProgressPhase = "start" | "in_progress" | "done" | "failed" | "cancelled";

export interface ProgressContext {
  commandId: string;
  emit: (phase: ProgressPhase, opts?: { percent?: number; message?: string }) => void;
}

const store = new AsyncLocalStorage<ProgressContext>();

export function runWithProgressContext<T>(ctx: ProgressContext, fn: () => T): T {
  return store.run(ctx, fn);
}

export function getProgressContext(): ProgressContext | undefined {
  return store.getStore();
}
