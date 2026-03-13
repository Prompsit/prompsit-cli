// Logging setup: configures pino with console (pretty), file, and optional Loki streams.
//
// Separated from index.ts to break circular dependency:
// index.ts is a pure barrel (safe to import anywhere),
// setup.ts pulls in pino-pretty and handlers with transitive deps.
//
// Call setupLogging() once at startup (src/index.ts).

import * as fs from "node:fs";
import * as path from "node:path";
import { Writable } from "node:stream";
import pino from "pino";
import pinoPretty from "pino-pretty";
import { getSettings, getSettingsDiagnostics, resolveLokiPreset } from "../config/index.ts";
import { getConfigDir } from "../config/paths.ts";
import { LokiHandler } from "./loki-handler.ts";
import { getTraceId, initPino } from "./logger.ts";
import type { LogLevel } from "./logger.ts";

let _initialized = false;
let _fileDestination: pino.DestinationStream | null = null;
let _consoleEnabled = true;

/** Silence the console handler (use in REPL mode to avoid raw stderr noise in TUI). */
export function silenceConsole(): void {
  _consoleEnabled = false;
}

/**
 * Initialize logging with pino multistream: console (pretty), file, and optional Loki.
 *
 * Console level follows cli.log_level from config.
 * File stream always captures DEBUG (full diagnostics).
 * Root pino level = "debug" (lowest stream level, required by multistream).
 */
export function setupLogging(): void {
  if (_initialized) return;
  _initialized = true;

  const settings = getSettings();
  const settingsDiagnostics = getSettingsDiagnostics();
  const configLevel = settings.cli.log_level as LogLevel;

  // 1. Console stream: pino-pretty → gated stderr writable
  const gatedStderr = new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      if (_consoleEnabled) {
        process.stderr.write(chunk, cb);
      } else {
        cb();
      }
    },
  });

  const prettyStream = pinoPretty({
    colorize: true,
    destination: gatedStderr,
    sync: true,
    ignore: "pid,hostname",
  });

  // 2. File stream: JSON lines to ~/.prompsit/debug.log
  const logFile = path.join(getConfigDir(), "debug.log");
  rotateIfNeeded(logFile);
  _fileDestination = pino.destination({ dest: logFile, sync: true, mkdir: true });

  // 3. Loki stream: custom adapter over existing LokiHandler (WARN+ERROR only)
  type StreamEntry = pino.StreamEntry<LogLevel>;
  const streams: StreamEntry[] = [
    { stream: prettyStream, level: configLevel },
    { stream: _fileDestination, level: "debug" },
  ];

  if (settings.telemetry.enabled) {
    const preset = resolveLokiPreset(settings);
    if (preset) {
      const lokiHandler = new LokiHandler(
        preset.url,
        preset.key,
        {},
        settings.telemetry.loki_timeout * 1000
      );
      streams.push({ stream: createLokiAdapter(lokiHandler), level: "warn" });
    }
  }

  // Root level = "debug" (lowest). pino filters BEFORE multistream routing.
  const instance = pino(
    {
      level: "debug",
      mixin() {
        const traceId = getTraceId();
        return traceId ? { trace_id: traceId } : {};
      },
    },
    pino.multistream(streams)
  );
  initPino(instance);

  if (settingsDiagnostics.length > 0) {
    instance.warn(
      { issues: settingsDiagnostics.join("; ") },
      "Invalid env overrides detected and dropped"
    );
  }
}

/** Flush and close file destination on shutdown. */
export function shutdownLogging(): void {
  if (_fileDestination) {
    // SonicBoom supports flushSync
    if ("flushSync" in _fileDestination && typeof _fileDestination.flushSync === "function") {
      (_fileDestination as { flushSync: () => void }).flushSync();
    }
    if ("end" in _fileDestination && typeof _fileDestination.end === "function") {
      (_fileDestination as { end: () => void }).end();
    }
    _fileDestination = null;
  }
}

// --- File rotation ---

/** Rotate debug.log at startup if it's from a previous day. Keep 1 backup. */
function rotateIfNeeded(logPath: string): void {
  try {
    if (!fs.existsSync(logPath)) return;
    const stat = fs.statSync(logPath);
    const fileDate = stat.mtime.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    if (fileDate === todayStr) return;

    fs.renameSync(logPath, `${logPath}.${fileDate}`);

    // Cleanup: keep only 1 most recent backup
    const dir = path.dirname(logPath);
    const base = path.basename(logPath);
    const backups = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(base + "."))
      .toSorted((a, b) => b.localeCompare(a));
    for (let i = 1; i < backups.length; i++) {
      fs.unlinkSync(path.join(dir, backups[i]));
    }
  } catch {
    // Ignore rotation errors
  }
}

// --- Loki adapter ---

/** Writable stream that parses pino NDJSON and dispatches to LokiHandler. */
function createLokiAdapter(lokiHandler: LokiHandler): Writable {
  return new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      try {
        // SonicBoom may batch multiple lines — split and parse each
        for (const line of chunk.toString().split("\n")) {
          if (!line) continue;
          const entry = JSON.parse(line) as Record<string, unknown>;
          const numLevel = typeof entry.level === "number" ? entry.level : pino.levels.values.info;
          const lvl = pino.levels.labels[numLevel] ?? "info";

          const meta: Record<string, string> = {};
          if (typeof entry.module === "string") meta.module = entry.module;
          if (typeof entry.trace_id === "string") meta.trace_id = entry.trace_id;

          // Flatten pino err serializer → existing Loki metadata schema
          const err = entry.err as Record<string, unknown> | undefined;
          if (err) {
            meta.error_type = typeof err.type === "string" ? err.type : "";
            meta.exception_message = typeof err.message === "string" ? err.message : "";
            if (typeof err.stack === "string") meta.stack = err.stack;
          }

          // Pass remaining string fields (user metadata)
          const excludeKeys = new Set([
            "msg",
            "level",
            "time",
            "module",
            "trace_id",
            "pid",
            "hostname",
            "err",
          ]);
          for (const [k, v] of Object.entries(entry)) {
            if (typeof v === "string" && !excludeKeys.has(k)) {
              meta[k] = v;
            }
          }

          const msg = typeof entry.msg === "string" ? entry.msg : "";
          lokiHandler.emit(lvl, msg, meta);
        }
      } catch {
        // Telemetry must never throw
      }
      cb();
    },
  });
}
