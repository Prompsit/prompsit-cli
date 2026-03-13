/**
 * Structured logger powered by pino.
 *
 * Design: Lazy-dispatch wrappers — getLogger() returns objects that
 * delegate to the current _pino instance on every call. This ensures
 * module-level loggers created before setupLogging() work correctly
 * after initialization (pino.child() would bind to pre-init parent).
 *
 * AsyncLocalStorage propagates trace_id across async boundaries via mixin.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import pino from "pino";

// --- Trace ID propagation ---

/** AsyncLocalStorage for trace_id propagation across async boundaries. */
export const traceStore = new AsyncLocalStorage<string>();

/** Get current trace_id from async context, or empty string. */
export function getTraceId(): string {
  return traceStore.getStore() ?? "";
}

// --- Logger ---

export type LogLevel = "debug" | "info" | "warn" | "error";
/** Pre-init: silent logger (no output). Replaced by initPino() during setup. */
let _pino: pino.Logger = pino({ level: "silent" });

/**
 * Replace the pino instance. Called once by setupLogging().
 * All existing getLogger() wrappers immediately dispatch to the new instance.
 */
export function initPino(instance: pino.Logger): void {
  _pino = instance;
}

/** Per-module logger context. */
export interface ModuleLogger {
  debug(message: string, meta?: Record<string, string>): void;
  info(message: string, meta?: Record<string, string>): void;
  warn(message: string, meta?: Record<string, string>): void;
  error(message: string, error?: Error, meta?: Record<string, string>): void;
}

/**
 * Create a per-module logger that auto-injects module name into metadata.
 *
 * Returns a lazy-dispatch wrapper: each call delegates to the current _pino
 * instance, NOT a pino.child() bound at creation time. This is critical
 * because 13 modules create loggers at import-time before setupLogging().
 *
 * @param moduleUrl - Pass `import.meta.url` to auto-detect module name.
 */
export function getLogger(moduleUrl: string): ModuleLogger {
  const moduleName = parseModuleName(moduleUrl);

  return {
    debug: (msg, meta) => {
      _pino.debug({ module: moduleName, ...meta }, msg);
    },
    info: (msg, meta) => {
      _pino.info({ module: moduleName, ...meta }, msg);
    },
    warn: (msg, meta) => {
      _pino.warn({ module: moduleName, ...meta }, msg);
    },
    error: (msg, err?, meta?) => {
      if (err) {
        _pino.error({ err, module: moduleName, ...meta }, msg);
      } else {
        _pino.error({ module: moduleName, ...meta }, msg);
      }
    },
  };
}

/** Extract module name from import.meta.url (e.g. "api/sse-client"). */
function parseModuleName(moduleUrl: string): string {
  return (
    moduleUrl
      .replace(/^file:\/\/\//, "")
      .replaceAll("\\", "/")
      .split("/src/")[1]
      ?.replace(/\.ts$/, "") ?? "unknown"
  );
}
