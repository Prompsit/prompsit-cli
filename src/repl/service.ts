// src/repl/service.ts
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { executeCommand } from "./executor.ts";
import { outputBridge, type OutputItem } from "./core/output-bridge.ts";
import { abort as abortCommand } from "./core/abort.ts";
import { clearHint } from "./ui/hint-state.ts";
import { CommandHistory } from "./history/command-history.ts";
import { terminal } from "../output/terminal.ts";
import { t } from "../i18n/index.ts";
import type { ProgressEvent, ProgressPhase, SubmitResult } from "./core/progress-types.ts";
import { checkCompleteness } from "./input/analyzer.ts";
import { runWithProgressContext, type ProgressContext } from "../runtime/progress-context.ts";

/**
 * REPL Service - business logic SDK for command execution.
 *
 * MCP Ref Pattern: Service Layer with EventEmitter lifecycle management
 * - Dispose pattern prevents memory leaks in tests/remounts
 * - Explicit listener registration/cleanup
 * - Type-safe event emission
 *
 * Events:
 * - "stateChange": { isRunning: boolean, isAborting: boolean }
 * - "outputBatch": OutputItem[] (from OutputBridge, batched at 60fps)
 * - "progress": ProgressEvent (command lifecycle: start/in_progress/done/failed/cancelled)
 * - "clear": void (history cleared)
 * - "exit": void (REPL exit requested)
 * - "error": Error (async error from command execution)
 *
 * Lifecycle:
 * 1. Create: `const service = new ReplService()`
 * 2. Subscribe: `service.on("outputBatch", handler)`
 * 3. Use: `await service.submit("help")`
 * 4. Cleanup: `await service.dispose()` (CRITICAL: prevents memory leaks)
 *
 * Usage:
 * ```typescript
 * const service = new ReplService();
 * service.on("stateChange", (state) => setIsRunning(state.isRunning));
 * service.on("outputBatch", (items) => setHistory(prev => [...prev, ...items]));
 * await service.submit("translate \"Hello\" -s en -t es");
 * service.dispose(); // MUST call on unmount
 * ```
 */
export class ReplService extends EventEmitter {
  private isRunning = false;
  private isAborting = false;
  private lineBuffer: string[] = [];
  readonly commandHistory = new CommandHistory();
  // ✅ MCP Ref: Store handler references for cleanup
  private readonly outputBatchHandler: (items: OutputItem[]) => void;
  private readonly clearHandler: () => void;

  constructor() {
    super();

    // ✅ MCP Ref: Save handler references for proper cleanup
    this.outputBatchHandler = (items: OutputItem[]) => {
      this.emit("outputBatch", items);
    };

    this.clearHandler = () => {
      this.emit("clear");
    };

    // Forward outputBridge events to service consumers
    outputBridge.on("outputBatch", this.outputBatchHandler);
    outputBridge.on("clear", this.clearHandler);
  }

  /**
   * Get current execution state.
   */
  getState(): { isRunning: boolean; isAborting: boolean } {
    return { isRunning: this.isRunning, isAborting: this.isAborting };
  }

  /**
   * Submit a line of input. Accumulates lines in buffer when input is incomplete
   * (unclosed quotes, trailing backslash). Executes full command when complete.
   */
  async submit(input: string): Promise<SubmitResult> {
    const text = input.trim();
    if (!text && this.lineBuffer.length === 0) {
      return { kind: "executed", shouldContinue: true };
    }

    this.lineBuffer.push(input);
    const accumulated = this.lineBuffer.join("\n");

    // Check for trailing backslash (explicit continuation)
    const trimmedAccum = accumulated.trimEnd();
    if (trimmedAccum.endsWith("\\")) {
      // Strip trailing backslash (and surrounding whitespace) for clean join later
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- lineBuffer guaranteed non-empty
      this.lineBuffer[this.lineBuffer.length - 1] = this.lineBuffer
        .at(-1)!
        .replace(/\s{0,100}\\\s{0,100}$/, "");
      return { kind: "await_more_input", reason: "trailing_backslash" };
    }

    // Check completeness (unclosed quotes)
    const completeness = checkCompleteness(accumulated);
    if (!completeness.complete) {
      return { kind: "await_more_input", reason: completeness.reason };
    }

    // Input is complete — join buffer and execute
    const fullText = this.lineBuffer.join(" ").trim();
    this.lineBuffer = [];

    if (!fullText) return { kind: "executed", shouldContinue: true };

    return this.executeFullCommand(fullText);
  }

  /**
   * Discard the line buffer (Ctrl+C during continuation mode).
   * Returns true if there was a buffer to discard.
   */
  discardBuffer(): boolean {
    if (this.lineBuffer.length === 0) return false;
    this.lineBuffer = [];
    return true;
  }

  /** Whether the service is accumulating continuation lines. */
  isInContinuation(): boolean {
    return this.lineBuffer.length > 0;
  }

  /**
   * Execute a complete command text (internal, after buffer assembly).
   */
  private async executeFullCommand(text: string): Promise<SubmitResult> {
    const commandId = randomUUID();

    clearHint();
    this.isRunning = true;
    this.isAborting = false;
    this.emit("stateChange", this.getState());

    this.emitProgress(commandId, "start");

    // Append full command to persistent history file + in-memory navigation
    this.commandHistory.appendLine(text);
    this.commandHistory.add(text);

    // Echo command as structured history entry (rendered differently from live prompt).
    outputBridge.write({
      kind: "command",
      timestamp: Date.now(),
      stream: "stdout",
      level: "info",
      text,
    });

    try {
      const ctx: ProgressContext = {
        commandId,
        emit: (phase, opts) => {
          this.emitProgress(commandId, phase, opts);
        },
      };

      const result = await runWithProgressContext(ctx, () => executeCommand(text));

      switch (result.outcome) {
        case "continue": {
          this.emitProgress(commandId, "done");
          return { kind: "executed", shouldContinue: true };
        }
        case "cleared": {
          outputBridge.clear();
          this.emitProgress(commandId, "done");
          return { kind: "executed", shouldContinue: true };
        }
        case "exit": {
          this.emitProgress(commandId, "done");
          terminal.dim(t("repl.goodbye"));
          this.emit("exit");
          return { kind: "executed", shouldContinue: false };
        }
        case "cancelled": {
          this.emitProgress(commandId, "cancelled");
          terminal.dim(t("repl.cancelled"));
          return { kind: "executed", shouldContinue: true };
        }
        case "settings": {
          this.emitProgress(commandId, "done");
          return { kind: "settings" };
        }
      }
    } catch (error) {
      this.emitProgress(commandId, "failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      this.emit("error", error);
      return { kind: "executed", shouldContinue: true };
    } finally {
      this.isRunning = false;
      this.isAborting = false;
      this.emit("stateChange", this.getState());
    }
  }

  /** Emit a progress event for the given command. */
  private emitProgress(
    commandId: string,
    phase: ProgressPhase,
    opts?: { percent?: number; message?: string }
  ): void {
    const event: ProgressEvent = {
      commandId,
      phase,
      percent: opts?.percent,
      message: opts?.message,
      timestamp: Date.now(),
    };
    this.emit("progress", event);
  }

  /**
   * Abort the currently running command (Ctrl+C).
   */
  abort(): void {
    if (!this.isRunning) return;

    this.isAborting = true;
    this.emit("stateChange", this.getState());

    // Trigger abort via module-level controller (abort.ts singleton)
    abortCommand();
  }

  /**
   * Get buffered history snapshot (for UI initialization).
   */
  getHistory(): OutputItem[] {
    return outputBridge.getHistory();
  }

  /**
   * ✅ MCP Ref: Dispose pattern for cleanup (CRITICAL for memory leak prevention)
   *
   * MUST be called when service is no longer needed:
   * - After tests complete
   * - On REPL shutdown
   * - On any early-exit/error path in startup
   *
   * Prevents EventEmitter warning: "possible EventEmitter memory leak detected"
   */
  dispose(): void {
    // Unsubscribe from outputBridge (prevents leak in tests/remounts)
    outputBridge.off("outputBatch", this.outputBatchHandler);
    outputBridge.off("clear", this.clearHandler);

    // Remove all service's own listeners
    this.removeAllListeners();
  }
}
