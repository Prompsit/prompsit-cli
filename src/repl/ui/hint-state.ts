// Generic status bar hint slot (single "toast" — newest wins).

const HINT_DURATION_MS = 2000;
let _hintText: string | null = null;
let _hintExpiry = 0;
let _clearTimer: ReturnType<typeof setTimeout> | null = null;
let _onExpire: (() => void) | null = null;

/** Register a callback invoked when the hint expires (typically requestRender). */
export function setHintExpireCallback(cb: () => void): void {
  _onExpire = cb;
}

/** Show a temporary hint in the status bar. */
export function showStatusHint(text: string, durationMs = HINT_DURATION_MS): void {
  _hintText = text;
  _hintExpiry = Date.now() + durationMs;

  if (_clearTimer) clearTimeout(_clearTimer);
  _clearTimer = setTimeout(() => {
    _hintText = null;
    _clearTimer = null;
    _onExpire?.();
  }, durationMs);
}

/** Get the currently active hint, or null if expired. */
export function getActiveHint(): string | null {
  if (_hintText && Date.now() < _hintExpiry) return _hintText;
  _hintText = null;
  return null;
}

/** Clear all hint state (interrupt timing + status bar hint). */
export function clearHint(): void {
  _hintText = null;
  _hintExpiry = 0;
  if (_clearTimer) {
    clearTimeout(_clearTimer);
    _clearTimer = null;
  }
}
