// Ctrl+C double-tap timing state.
// Tracks interrupt timestamps for double-tap exit detection.

let _lastInterruptTime = 0;

/** Record a Ctrl+C interrupt timestamp (for double-tap exit detection). */
export function recordInterrupt(): void {
  _lastInterruptTime = Date.now();
}

/** Get the last interrupt timestamp (ms). */
export function getLastInterruptTime(): number {
  return _lastInterruptTime;
}
