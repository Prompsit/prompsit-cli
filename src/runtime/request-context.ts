import { AsyncLocalStorage } from "node:async_hooks";

const abortSignalStore = new AsyncLocalStorage<AbortSignal | undefined>();

/** Run a callback with a request-scoped AbortSignal. */
export function runWithAbortSignal<T>(
  signal: AbortSignal | undefined,
  callback: () => Promise<T>
): Promise<T> {
  return abortSignalStore.run(signal, callback);
}

/** Get the AbortSignal bound to the current async request context. */
export function getCurrentAbortSignal(): AbortSignal | undefined {
  return abortSignalStore.getStore();
}
