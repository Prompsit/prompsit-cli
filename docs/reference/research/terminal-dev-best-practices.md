# Terminal Development Best Practices (Node.js/TypeScript)

<!-- SCOPE: Research reference on rendering, input, performance, and tooling for terminal apps with Ink, Commander.js, chalk, cli-table3. -->
<!-- Last Updated: 2026-02-16 -->

Practical guide for building polished TUI apps on Node.js/TypeScript. Filtered to our stack: Ink (React), Commander.js, chalk, cli-table3, ora, got, Zod.

---

## 1. Rendering & Anti-Flicker

**The #1 problem in TUI apps.** Ink does full-tree traversal + complete re-render on every state change.

| Technique | How it works | Flicker reduction | Complexity |
|-----------|-------------|-------------------|------------|
| `<Static>` component | Renders items once, never re-renders | 2x speedup | Low |
| Differential rendering | Diff each cell, send ANSI only for changes | -85% | High |
| Output batching | Buffer updates, flush every 16ms (~60 FPS) | -50% | Medium |
| `\x1b[H` instead of `\x1b[2J` | Cursor home instead of full clear | Significant | Low |
| Hide cursor during updates | `\x1b[?25l` before render, `\x1b[?25h` after | Eliminates cursor jump | Low |

**Quick win:**
```tsx
// Completed items never re-render:
<Static items={completedItems}>
  {(item) => <Text key={item.id}>✓ {item.name}</Text>}
</Static>
<Box>{/* only dynamic content here */}</Box>
```

---

## 2. ANSI Escape Codes Cheat Sheet

| Code | Effect | Use case |
|------|--------|----------|
| `\x1b[H` | Cursor to home (0,0) | Re-render without clear |
| `\x1b[K` | Clear to end of line | Overwrite stale content per-line |
| `\x1b[?25h` / `\x1b[?25l` | Show/hide cursor | Hide during processing |
| `\x1b[?1049h` / `\x1b[?1049l` | Enter/exit alternate screen | Fullscreen TUI (like vim) |
| `\x1b[?2004h` / `\x1b[?2004l` | Bracketed paste on/off | Detect paste vs keypress |
| `\x1b[s` / `\x1b[u` | Save/restore cursor position | Precise re-rendering |
| `\x1b[38;2;R;G;Bm` | 24-bit RGB foreground | Truecolor terminals |
| `\x1b[38;5;Nm` | 256-color foreground | Wider compatibility |

**Optimization:** batch SGR params — `\x1b[1;31m` (bold+red) instead of `\x1b[1m\x1b[31m` (less I/O).

Source: [ANSI Escape Codes Reference](https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797)

---

## 3. Ink Deep Dive

### Architecture

```
JSX → React Tree → Reconciler Diff → Yoga Layout → ANSI Codes → Terminal
```

### Hooks

| Hook | Purpose | Key detail |
|------|---------|------------|
| `useInput(cb)` | Catch every keypress | Paste comes as single call with full string |
| `useApp()` | Access `exit()` and stdin | `exit(error)` rejects the render promise |
| `useFocus()` | Make component focusable | Tab/Shift+Tab navigation built-in |
| `useFocusManager()` | Programmatic focus control | `focusNext()`, `focusPrevious()`, `disableFocus()` |
| `useStdin()` | Raw stdin access | Check `isRawModeSupported()` before `setRawMode(true)` |
| `useStdout()` | Write outside Ink | `stdout.write()` outputs ABOVE Ink content |

### Performance

1. **`<Static>`** — completed/historical items rendered once, never re-rendered
2. **`React.memo()`** — skip re-render when props unchanged
3. **`useMemo` / `useCallback`** — stable references for expensive computations
4. **Frame rate cap:** `render(<App/>, { experimental: { throttle: 16 } })` (~60 FPS)
5. **Incremental rendering** (Ink 4+): updates only changed lines

### Gotchas

| Gotcha | Fix |
|--------|-----|
| `bold`/`color` on `<Box>` | Transforms only work on `<Text>` |
| Text overflow | `<Text wrap="wrap">` inside fixed-width `<Box>` |
| `stdin.setRawMode` undefined | Check `isRawModeSupported()` first |
| Infinite render loop | Don't `setState` in unconditional `useEffect` |
| `<Static>` missing key | Always provide `key` prop in Static children |
| Terminal size unavailable | Fallback: `{ columns: 80, rows: 24 }` |

### Yoga Layout (CSS-like)

| Property | Values |
|----------|--------|
| `flexDirection` | `row`, `column` |
| `justifyContent` | `flex-start`, `center`, `flex-end`, `space-between`, `space-around` |
| `alignItems` | `flex-start`, `center`, `flex-end`, `stretch` |
| `width` | `<number>`, `"50%"`, `"auto"`, `"fill"` |
| `gap`, `padding`, `margin` | `<number>` or `{top, bottom, left, right}` |
| `borderStyle` | `round`, `bold`, `double`, `dashed` |

### Ink 4 → 5

No API breaking changes. Only requires Node.js 18+. `<Static>` is 2x faster in v5.

---

## 4. Input Handling

### Raw Mode vs Cooked Mode

| Mode | Pros | Cons |
|------|------|------|
| **Raw** | Every keypress in real-time | Must handle Ctrl+C manually |
| **Cooked** | Backspace/editing built-in | Waits for Enter, not for TUI |

Ink enables raw mode automatically. Custom keypress handling:

```typescript
useInput((input, key) => {
  if (key.ctrl && input === 'c') process.exit();
});
```

### Bracketed Paste Detection

```
Enable:  \x1b[?2004h
Paste arrives wrapped: \x1b[200~ ...pasted text... \x1b[201~
Disable: \x1b[?2004l
```

@inkjs/ui `TextInput` already supports paste mode. Enable manually only for custom input.

---

## 5. Color Detection & Fallback

```
Detection hierarchy:
1. FORCE_COLOR env var (0|1|2|3)
2. COLORTERM env var ("truecolor" | "24bit" → level 3)
3. TERM env var (contains "256color" → level 2)
4. stdout.isTTY (false → no color)
5. Default: level 1 (16 colors)
```

chalk auto-downsamples: `#FF5733` on 16-color terminal → closest ANSI red. No manual fallback needed.

---

## 6. Unicode & Double-Width Characters

CJK characters and some emoji occupy 2 terminal cells, but `string.length` reports 1.

```typescript
import wc from 'wcwidth';
wc('你');     // → 2 (2 terminal cells)
wc('A');      // → 1
wc('\u200D'); // → 0 (zero-width joiner)
```

**Impact:** Translation tables with CJK languages misalign without wcwidth correction in cli-table3 output.

---

## 7. Signals & Graceful Shutdown

TUI can leave terminal broken (hidden cursor, raw mode, alternate screen) without cleanup.

```typescript
const cleanup = () => {
  process.stdout.write('\x1b[?1049l'); // exit alternate screen
  process.stdout.write('\x1b[?25h');   // show cursor
  process.stdout.write('\x1b(B\x1b[m'); // reset all attributes
  process.exit(0);
};

process.on('SIGINT', cleanup);   // Ctrl+C
process.on('SIGTERM', cleanup);  // kill
process.on('SIGHUP', cleanup);   // terminal closed
```

### Alternate Screen Trade-offs

| Pros | Cons |
|------|------|
| Zero flicker, clean UI | Can't copy/paste previous output |
| Full-screen layout | Cmd+F search doesn't work |
| Restored on exit | Scrollback history invisible |

**REPL recommendation:** Don't use alternate screen. Users need copy/paste from command history.

---

## 8. Cross-Platform (Windows)

| Terminal | ANSI Support | Notes |
|----------|-------------|-------|
| Windows Terminal | Full (truecolor, mouse, OSC 8) | Ships with Win 11 |
| Git Bash / MSYS2 | Full | Forward slashes, Unix-like |
| cmd.exe | Partial (since Win 10 1511) | Not recommended |
| PowerShell 7+ | Full | Good alternative |

**Key issues:**
- Always use forward slashes in output paths
- `process.stdout.columns` may be `undefined` in some Windows environments
- Mouse events: not all Windows terminals support SGR mouse mode

---

## 9. Streaming SSE + Ink

Pattern for long-running operations (translation jobs):

```typescript
// Buffer SSE events, flush to UI at 60 FPS max
let pendingUpdate = null;
const FRAME_MS = 16;

stream.on('data', (event) => {
  pendingUpdate = parseSSE(event);
});

setInterval(() => {
  if (pendingUpdate) {
    updateUI(pendingUpdate); // triggers Ink re-render
    pendingUpdate = null;
  }
}, FRAME_MS);
```

Reconnection with Last-Event-ID:

```typescript
const response = await got.stream(url, {
  headers: { 'Last-Event-ID': lastEventId }
});
```

---

## 10. Testing TUI

| Strategy | Speed | Realism | When |
|----------|-------|---------|------|
| Component (ink-testing-library) | Fast | Medium | Ink component logic |
| Snapshot | Fast | Low | Regression detection |
| PTY-based E2E | Slow | High | Critical paths only |

```typescript
import { render } from 'ink-testing-library';
const { lastFrame, stdin } = render(<App />);
expect(lastFrame()).toContain('Expected text');
stdin.write('q'); // simulate keypress
```

Rule: 1-2 E2E tests per feature. Unit tests for critical logic only.

---

## 11. Enhancement Libraries

| Library | Purpose | When to use |
|---------|---------|-------------|
| **terminal-link** | Clickable hyperlinks (OSC 8) | URLs in output |
| **marked-terminal** | Render Markdown in terminal | Help text, docs |
| **boxen** | Box/frame around text | Highlight messages |
| **figlet** | ASCII art text | Branding, splash |
| **wcwidth** | Unicode character width | CJK alignment |
| **supports-color** | Detect color level | Conditional formatting |
| **terminal-image** | Images (Kitty/iTerm2/Sixel) | Visual output |
| **node-notifier** | Desktop notifications | Long job completion |
| **asciinema + svg-term** | Record terminal sessions | Docs, demos |
| **enquirer** | Interactive prompts | User input forms |
| **diff (jsdiff)** | Programmatic text diff | Compare translations |
| **listr2** | Multi-step progress | Pipeline visualization |
| **stmux** | Terminal multiplexing | Side-by-side processes |

---

## 12. Performance Tricks

| Trick | Effect |
|-------|--------|
| Batch ANSI params: `\x1b[1;31m` | Less I/O per styled chunk |
| Cache chalk output strings | Avoid repeated formatting |
| `\r` for in-place line update | No flicker for progress |
| `<Static>` for log history | Skip re-render of old items |
| Throttle SSE updates to 60 FPS | Prevent terminal buffer overflow |
| `!process.stdout.isTTY` → JSON output | Fast piped mode |

---

## 13. TTY Detection

```typescript
if (process.stdout.isTTY) {
  // Interactive → Ink, colors, spinners
} else {
  // Piped → JSON output, no colors, no prompts
}
```

Critical for CLI tools used both interactively and in pipelines.

---

## 14. Accessibility

- Don't rely solely on color — always include text labels (`ERROR:`, `OK:`)
- Use structured separators in table output
- Screen readers (NVDA, VoiceOver) read terminal as linear text stream

---

## Sources

**Rendering:**
- [Build CLI with ANSI codes](https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html)
- [ANSI Escape Codes](https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797)
- [Terminal Colors Guide](https://marvinh.dev/blog/terminal-colors/)

**Ink:**
- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [Ink 3 Performance](https://vadimdemedes.com/posts/ink-3)
- [Advanced Ink v3 Guide](https://developerlife.com/2021/11/25/ink-v3-advanced-ui-components/)
- [Ink + Yoga Reactive UI](https://gerred.github.io/building-an-agentic-system/ink-yoga-reactive-ui.html)
- [@inkjs/ui](https://github.com/vadimdemedes/ink-ui)

**Best practices:**
- [Node.js CLI Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)
- [Top 12 Node CLI Libraries](https://byby.dev/node-command-line-libraries)
- [Testing TUI Apps](https://blog.waleedkhan.name/testing-tui-apps/)
- [CLI Accessibility](https://dl.acm.org/doi/fullHtml/10.1145/3411764.3445544)

**Cross-platform:**
- [Node.js on WSL](https://learn.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl)
- [Windows Terminal](https://github.com/microsoft/terminal)

**Tools:**
- [asciinema](https://asciinema.org/) + [svg-term-cli](https://github.com/marionebl/svg-term-cli)
- [terminal-link (OSC 8)](https://github.com/sindresorhus/terminal-link)

---

## Maintenance

**Update Triggers:**
- When adopting new terminal libraries
- When discovering new rendering techniques
- When cross-platform issues are resolved

**Verification:**
- [ ] All libraries referenced exist in npm
- [ ] Code examples use project conventions (ESM, strict TS)
- [ ] No references to non-JS ecosystems
