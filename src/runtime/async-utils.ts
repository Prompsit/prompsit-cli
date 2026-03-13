// Async utilities: cancellable sleep (node:timers/promises) and concurrency pool.

import { setTimeout } from "node:timers/promises";

/**
 * Cancellable sleep using native Node.js timers/promises.
 * Rejects with AbortError when signal fires.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return setTimeout(ms, undefined, signal ? { signal } : undefined);
}

/**
 * Run async tasks over items with bounded concurrency.
 *
 * Each item is processed by `fn`. Workers pull from a shared queue.
 * On abort signal, workers stop picking new items (in-flight items continue
 * and are expected to handle abort via their own signal propagation).
 *
 * @returns PromiseSettledResult per item (error isolation: one failure doesn't block others)
 */
export async function poolMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<(PromiseSettledResult<R> | undefined)[]> {
  const results: (PromiseSettledResult<R> | undefined)[] = Array.from({ length: items.length });
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      if (signal?.aborted) break;
      const i = nextIndex++;
      try {
        const value = await fn(items[i], i);
        results[i] = { status: "fulfilled", value };
      } catch (error) {
        results[i] = { status: "rejected", reason: error };
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
