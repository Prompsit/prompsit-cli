// Native Windows clipboard read/write via koffi FFI.
// Eliminates ~1000ms PowerShell startup overhead.
// Pattern: same as pi-tui's enableWindowsVTInput() in terminal.js —
// dynamic require("koffi"), lazy init, try/catch wrapper.
// Uses createRequire because the project is ESM-only.

/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-return */

import { createRequire } from "node:module";

let _initialized = false;
let _koffi: typeof import("koffi") | null = null;

// Shared
let _OpenClipboard: ((hwnd: null) => boolean) | null = null;
let _CloseClipboard: (() => boolean) | null = null;
let _GlobalLock: ((hMem: unknown) => unknown) | null = null;
let _GlobalUnlock: ((hMem: unknown) => boolean) | null = null;

// Read
let _GetClipboardData: ((format: number) => unknown) | null = null;

// Write
let _EmptyClipboard: (() => boolean) | null = null;
let _SetClipboardData: ((format: number, hMem: unknown) => unknown) | null = null;
let _GlobalAlloc: ((flags: number, bytes: number) => unknown) | null = null;
let _GlobalFree: ((hMem: unknown) => unknown) | null = null;
let _RtlMoveMemory: ((dest: unknown, src: Buffer, length: number) => void) | null = null;

const CF_UNICODETEXT = 13;
const GMEM_MOVEABLE = 0x00_02;

function init(): boolean {
  if (_initialized) return _OpenClipboard !== null;
  _initialized = true;

  try {
    const esmRequire = createRequire(import.meta.url);
    const koffi = esmRequire("koffi") as typeof import("koffi");
    _koffi = koffi;

    const user32 = koffi.load("user32.dll");
    const kernel32 = koffi.load("kernel32.dll");

    // Shared
    _OpenClipboard = user32.func("bool __stdcall OpenClipboard(void *)");
    _CloseClipboard = user32.func("bool __stdcall CloseClipboard()");
    _GlobalLock = kernel32.func("void * __stdcall GlobalLock(void *)");
    _GlobalUnlock = kernel32.func("bool __stdcall GlobalUnlock(void *)");

    // Read
    _GetClipboardData = user32.func("void * __stdcall GetClipboardData(uint32_t)");

    // Write
    _EmptyClipboard = user32.func("bool __stdcall EmptyClipboard()");
    _SetClipboardData = user32.func("void * __stdcall SetClipboardData(uint32_t, void *)");
    _GlobalAlloc = kernel32.func("void * __stdcall GlobalAlloc(uint32_t, size_t)");
    _GlobalFree = kernel32.func("void * __stdcall GlobalFree(void *)");
    _RtlMoveMemory = kernel32.func("void __stdcall RtlMoveMemory(void *, const void *, size_t)");

    return true;
  } catch {
    return false;
  }
}

/** Guard: all FFI functions loaded. */
function ready(): boolean {
  return !!(
    init() &&
    _koffi &&
    _OpenClipboard &&
    _CloseClipboard &&
    _GlobalLock &&
    _GlobalUnlock &&
    _GetClipboardData &&
    _EmptyClipboard &&
    _SetClipboardData &&
    _GlobalAlloc &&
    _GlobalFree &&
    _RtlMoveMemory
  );
}

/**
 * Read text from system clipboard using Win32 API via koffi FFI.
 * Returns `null` if koffi is unavailable (caller should fall back).
 * Returns `""` if clipboard is empty or has no text format.
 */
export function readClipboardNative(): string | null {
  if (!ready()) return null;

  if (!_OpenClipboard!(null)) return null;
  try {
    const hData = _GetClipboardData!(CF_UNICODETEXT);
    if (!hData) return "";

    const ptr = _GlobalLock!(hData);
    if (!ptr) return "";

    try {
      return _koffi!.decode(ptr, "char16", -1);
    } finally {
      _GlobalUnlock!(hData);
    }
  } finally {
    _CloseClipboard!();
  }
}

/**
 * Write text to system clipboard using Win32 API via koffi FFI.
 * Returns `null` if koffi is unavailable (caller should fall back).
 * Returns `true`/`false` for success/failure.
 */
export function writeClipboardNative(text: string): boolean | null {
  if (!ready()) return null;

  const buf = Buffer.from(text + "\0", "utf16le");

  if (!_OpenClipboard!(null)) return null;
  try {
    _EmptyClipboard!();

    const hMem = _GlobalAlloc!(GMEM_MOVEABLE, buf.length);
    if (!hMem) return false;

    const ptr = _GlobalLock!(hMem);
    if (!ptr) {
      _GlobalFree!(hMem);
      return false;
    }

    _RtlMoveMemory!(ptr, buf, buf.length);
    _GlobalUnlock!(hMem);

    const result = _SetClipboardData!(CF_UNICODETEXT, hMem);
    if (!result) {
      _GlobalFree!(hMem);
      return false;
    }
    // SetClipboardData success → clipboard owns the memory, do NOT GlobalFree
    return true;
  } finally {
    _CloseClipboard!();
  }
}
