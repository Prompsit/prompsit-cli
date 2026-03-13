// Smooth trickle progress animation for job tracking.
// NProgress-inspired: diminishing increments with API-driven target catch-up.
// Sits between SSE/polling callbacks and downstream progress display (ora / REPL context).

/** Callback for progress updates (percentage 0-100, current step or null). */
export type OnProgress = (percentage: number, step: string | null) => void;

/** Trickle progress cap — never exceeds this without real "complete" signal. */
const TRICKLE_CAP = 95;

/** NProgress-inspired thresholds for diminishing trickle speed. */
const TRICKLE_THRESHOLDS = { slow: 20, medium: 50, fast: 80 } as const;

/** Default tick interval in milliseconds. */
const DEFAULT_TICK_MS = 150;

/**
 * Animates progress between sparse API updates.
 *
 * Two modes:
 * 1. Catch-up (display < target): ease toward API value, 30% of gap per tick.
 * 2. Trickle  (display ≥ target): diminishing increments, capped at 95%.
 */
export class ProgressAnimator {
  private display = 0;
  private target = 0;
  private step: string | null = null;
  private lastEmitted = -1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly downstream: OnProgress;

  constructor(downstream: OnProgress, tickMs = DEFAULT_TICK_MS) {
    this.downstream = downstream;
    this.timer = setInterval(() => {
      this.tick();
    }, tickMs);
  }

  /** Called by SSE/polling with real API data. */
  setTarget(percent: number, step: string | null): void {
    // Never go backwards
    if (percent > this.target) {
      this.target = percent;
    }
    this.step = step;
  }

  /** Call on job complete — jumps to 100% and stops timer. */
  complete(): void {
    this.clearTimer();
    this.display = 100;
    this.emit();
  }

  /** Call on error/cancel — stops timer without updating display. */
  stop(): void {
    this.clearTimer();
  }

  private tick(): void {
    if (this.display < this.target) {
      // Catch-up mode: ease toward target (30% of remaining gap, min 1)
      const gap = this.target - this.display;
      this.display += Math.max(1, gap * 0.3);
      // Don't overshoot target
      if (this.display > this.target) {
        this.display = this.target;
      }
    } else {
      // Trickle mode: diminishing increments
      const increment = this.getTrickleIncrement(this.display);
      if (increment === 0) return;
      this.display = Math.min(this.display + increment, TRICKLE_CAP);
    }

    this.emit();
  }

  /** NProgress-inspired diminishing trickle increments. */
  private getTrickleIncrement(current: number): number {
    if (current < TRICKLE_THRESHOLDS.slow) return 1;
    if (current < TRICKLE_THRESHOLDS.medium) return 0.5;
    if (current < TRICKLE_THRESHOLDS.fast) return 0.2;
    if (current < TRICKLE_CAP) return 0.05;
    return 0;
  }

  private emit(): void {
    const rounded = Math.round(this.display);
    // Skip redundant emits (avoids unnecessary re-renders)
    if (rounded === this.lastEmitted) return;
    this.lastEmitted = rounded;
    this.downstream(rounded, this.step);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
