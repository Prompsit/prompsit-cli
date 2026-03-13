// Single re-render notification hook for background async tasks.
// Modules that mutate state read during TUI rendering call invalidateUI()
// after state change. Controller registers the actual render callback.
//
// _pending handles the startup race: warmUpdateCheck() npm fetch (~1-3s) can
// resolve BEFORE setInvalidateCallback() is called (~1-2s into startup).
// Without _pending, invalidateUI() would be a silent no-op on fast networks.

let _callback: (() => void) | null = null;
let _pending = false;

export function setInvalidateCallback(fn: (() => void) | null): void {
  _callback = fn;
  if (fn && _pending) {
    _pending = false;
    fn(); // flush queued invalidation from before TUI started
  }
}

export function invalidateUI(): void {
  if (_callback) {
    _callback();
  } else {
    _pending = true; // defer until callback is registered
  }
}
