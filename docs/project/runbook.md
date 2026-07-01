# Operations Runbook

> **SCOPE:** Commands to run, test, and configure. Excludes architecture (`architecture.md`), tech stack (`tech_stack.md`).

---

## 1. Quick Start

```bash
git clone https://github.com/Prompsit/prompsit-cli.git
cd prompsit-cli
npm install
npm run dev -- --help              # Verify
```

---

## 2. Installation

| Method | For | Command |
|--------|-----|---------|
| **npmjs (global)** | Testers, end-users | `npm install -g prompsit-cli` |
| **npx** | Occasional one-off use | `npx prompsit-cli --help` |
| **Local dev** | Developers | `npm install && npm run dev` |

### 2.1 Prerequisites (clean Linux)

Preferred: install Node.js 22.19+ and npm with a Node version manager (`nvm`, `fnm`, or Volta). This keeps global npm packages inside the user's home directory and avoids `sudo npm install -g`.

```bash
# Example with nvm
nvm install 22
nvm use 22
node -v
npm -v
```

Fallback for system Node/npm: configure a user-owned npm prefix before global install.

```bash
mkdir -p ~/.local
npm config set prefix ~/.local
echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.profile
source ~/.profile
```

### 2.2 npmjs Global Install

| Action | Command |
|--------|---------|
| Install | `npm install -g prompsit-cli` |
| Verify | `prompsit --version` |
| Update | `npm install -g prompsit-cli@latest --prefer-online` |
| Occasional use | `npx prompsit-cli --help` |

### 2.3 Local Development

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Interactive REPL | `npm run dev` |
| Run command | `npm run dev -- translate "Hello" -s en -t es` |

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | 22+ | https://nodejs.org/ |
| npm | latest | Bundled with Node.js |

**Linux clipboard (REPL copy/paste):**

| Display server | Required package | Install (Debian/Ubuntu) |
|----------------|-----------------|------------------------|
| Wayland (Ubuntu 22.04+) | `wl-clipboard` | `sudo apt install wl-clipboard` |
| X11 | `xclip` or `xsel` | `sudo apt install xclip` |

---

## 3. CLI Usage

| Task | Command |
|------|---------|
| Interactive REPL | `prompsit` |
| Help | `prompsit --help` |
| Translate text | `prompsit translate "Hello" -s en -t es` |
| Translate file | `prompsit translate @doc.txt -s en -t es --out ./output/` |
| Evaluate text | `prompsit eval -s "Hello" -h "Hola" -r "Hola"` |
| Score tags (reference-free) | `prompsit eval -s "Hi <b>x</b>" -h "Hola <b>x</b>" --tags` (TSV batch: 2 cols; sub-scores via `-m tag_preservation`) |
| List language pairs | `prompsit engines` |
| Check API | `prompsit health` |
| Show config | `prompsit config` |
| Switch to local API | `prompsit config api-url local` |
| Switch to edge API | `prompsit config api-url test` |

---

## 4. Configuration

### Config file: `~/.prompsit/config.toml`

| Section | Key | Default | Description |
|---------|-----|---------|-------------|
| `[api]` | `base_url` | `https://edge.prompsit.com` | API base URL |
| | `timeout` | `30` | Read timeout (s) |
| | `connect_timeout` | `5.0` | Connection timeout (s) |
| | `retry_attempts` | `3` | Max retries on 5xx/429 |
| `[cli]` | `language` | `en` | Interface language |
| | `batch_size` | `50` | File translation batch size |
| | `show_curl` | `false` | Show API requests as curl |
| `[telemetry]` | `enabled` | `false` | Remote error logging to Loki |
| | `loki_timeout` | `3.0` | Loki push timeout (s) |

### API URL presets

| Preset | URL | Use case |
|--------|-----|----------|
| `test` | `https://edge.prompsit.com` | Default (edge server) |
| `local` | `http://localhost:8080` | Local Docker development |

### Environment variables

Prefix: `PROMPSIT_`, nested delimiter: `__`. Precedence: env > config.toml > defaults.

| Variable | Example |
|----------|---------|
| `PROMPSIT_API__BASE_URL` | `https://api.prompsit.com` |
| `PROMPSIT_API__TIMEOUT` | `60` |
| `PROMPSIT_CLI__LANGUAGE` | `es` |
| `PROMPSIT_TELEMETRY__ENABLED` | `true` |

### Credentials

OAuth2 tokens stored in `~/.prompsit/credentials.json`:

| Action | Command |
|--------|---------|
| Login/register | `prompsit login` |
| Fallback login | `prompsit login -a "EMAIL" -s "SECRET"` |
| Logout | `prompsit logout` |
| Check session | `prompsit status` |

`prompsit login` starts the Google device-flow sign-in. It prints a one-time code and URL, attempts to copy the sign-in URL to the clipboard, and opens the default browser when available. On headless machines, copy the printed URL into a browser on another machine and enter the one-time code.

---

## 5. Code Quality

### Unified quality gate

```bash
npm run lint:all    # Run ALL 6 static checks (fail-fast)
```

Runs sequentially with `&&` — stops on first failure:

| # | Script | Tool | Purpose |
|---|--------|------|---------|
| 1 | `typecheck` | `tsc --noEmit` | TypeScript strict mode |
| 2 | `lint` | ESLint 10 | Errors + warnings |
| 3 | `format:check` | Prettier | Formatting dry-run |
| 4 | `check:terminal-io` | Custom script | Terminal I/O safety (no raw `process.stdout/stderr` outside allowlist) |
| 5 | `lint:unused` | Knip | Dead exports, unused deps |
| 6 | `lint:arch` | dependency-cruiser | Architecture rules (cycles, layer violations) |

### Auto-fix shortcuts

| Script | Purpose |
|--------|---------|
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier auto-format |

### Tool config

| Tool | Scope | Config |
|------|-------|--------|
| TypeScript (`tsc --noEmit`) | `src/**/*.ts(x)` | `tsconfig.json` |
| ESLint 10 (flat config) | `src/**/*.ts(x)` | `eslint.config.ts` |
| Prettier | `src/**/*.{ts,tsx,json}` | `.prettierrc` |
| Knip | production exports | `knip.json` |
| dependency-cruiser | `src/` imports | `.dependency-cruiser.cjs` |

**Plugins:** `eslint-plugin-unicorn` (recommended preset) for modern JS/TS patterns + `typescript-eslint` strict type-checked rules. See `eslint.config.ts` for disabled opinionated rules.

---

## 6. Testing

Vitest 4 с [multi-project config](../../vitest.config.ts): unit (threads) + e2e (forks).

```bash
npm test                           # Unit only (fast, default)
npm run test:unit                  # Unit only (alias)
npm run test:e2e                   # E2E only (real API)
npm run test:all                   # Unit + E2E

# Specific test file
npx vitest run src/__tests__/settings.test.ts

# Watch mode
npx vitest
```

| Suite | Path | Tests | Auth | Pool | Speed |
|-------|------|-------|------|------|-------|
| Unit | `tests/unit/*.test.ts` | 149+ | No (mocked) | threads | ~1s |
| E2E | `tests/e2e/**/*.test.ts` | 40+ | Yes (real API) | forks | ~60s |

### E2E Environment Variables

E2E тесты используют настройки приложения напрямую. API URL берётся из стандартной `PROMPSIT_API__BASE_URL` (или Zod default `edge.prompsit.com`).

| Variable | Default | Description |
|----------|---------|-------------|
| `PROMPSIT_API__BASE_URL` | `https://edge.prompsit.com` | Стандартная env var приложения |
| `TEST_ACCOUNT` | dev default | Тестовый email |
| `TEST_SECRET` | dev default | Тестовый API key |

```bash
# Local stand
PROMPSIT_API__BASE_URL=http://localhost:8080 TEST_ACCOUNT=local@test.com TEST_SECRET=local_secret npm run test:e2e
```

---

## 7. Build & Distribution

| Method | Command |
|--------|---------|
| Build | `npm run build` (tsc → `dist/`) |
| npmjs install | `npm install -g prompsit-cli` |
| npmjs update | `npm install -g prompsit-cli@latest --prefer-online` |
| Local install | `npm install .` |

**Publishing:** Automated. Each push to `master` triggers [.gitlab-ci.yml](../../.gitlab-ci.yml), which mirrors a filtered, squashed snapshot to `github.com/Prompsit/prompsit-cli` `main` (one `Mirror <gitlab-sha> (<date>)` commit per push, after a leak-scan gate). [ci.yml](../../.github/workflows/ci.yml) scopes its `push`/`pull_request` triggers with a `paths:` filter (`src/**`, `examples/**`, `assets/**`, `package.json`, `package-lock.json`, `tsconfig.json`) — a push that only touches docs, README, CHANGELOG, or the workflow file itself matches none of these, so the whole workflow is skipped: no lint/test run, no version bump, no `npm publish`, no GitHub Release. When package-relevant files do change, CI runs lint/typecheck/test/build and, on success, derives a CalVer version (`YY.MMDD.HHMM`) from the commit timestamp and runs `npm publish`. The GitHub Release step is gated on that `Publish` step's own outcome (`steps.publish.outcome == 'success'`), not just the pre-publish existence check, and only fires if `## Unreleased` in [../../CHANGELOG.md](../../CHANGELOG.md) has entries. **No developer-side `git tag` push is required** — versions are derived from commit timestamps automatically.

**Manual fallback:** `npm run release` builds and publishes from a local checkout using the current local time for the version. Use only when GitHub Actions CI is unavailable.

**Verifying a push reached GitHub:** the GitHub default branch is `main`, not `master`, and SHAs do **not** match between the two remotes — match by the SHA embedded in the mirror commit message.

```bash
# Confirm the mirror commit references your local SHA:
gh api repos/Prompsit/prompsit-cli/commits/main \
  --jq '{short: .sha[0:7], message: (.commit.message | split("\n")[0]), date: .commit.author.date}'

# Inspect the post-mirror CI run; failure here blocks npm publish:
gh run list --repo Prompsit/prompsit-cli --limit 5 \
  --json status,conclusion,name,headSha,createdAt
```

---

## 8. Observability (Telemetry)

CLI sends WARNING+ errors to Loki for remote diagnostics. Opt-in, non-blocking.

| Action | Command |
|--------|---------|
| Enable | `prompsit config telemetry-enabled true` |
| Disable | `prompsit config telemetry-enabled false` |

Each HTTP request gets an 8-char `X-Request-ID` header (trace_id) for end-to-end correlation.

**Details:** [Observability Operations](observability-operations.md)

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| `ERR_MODULE_NOT_FOUND` | Run `npm install` in project root |
| `ERR_UNKNOWN_FILE_EXTENSION .tsx` | Use `npm run dev` (tsx loader), not `node` directly |
| `npm ERR! code EACCES` on `npm install -g` | Use a Node version manager, or configure a user-level prefix (`~/.local`) and retry without sudo |
| `prompsit: command not found` | Ensure `$(npm prefix -g)/bin` is in PATH and restart shell |
| Connection refused | Check `prompsit config api-url` and `prompsit health` |
| Browser does not open on login | Copy the printed URL; the CLI also tries system clipboard and OSC 52 terminal clipboard |
| No logs in Grafana/Loki | Check `prompsit config telemetry-enabled` |
| REPL paste not working (Linux) | Install `wl-clipboard` (Wayland) or `xclip` (X11). See section 2.2 |
| Right-click opens terminal menu | Terminal intercepts right-click. Use Ctrl+V or Shift+Right-click |

---

## 10. Health Checks

| Check | Command |
|-------|---------|
| API connectivity | `prompsit health` |
| Loki (local only) | `curl http://localhost:3100/ready` |

---

**Last Updated:** 2026-07-01

**Update Triggers:** New config keys, CLI commands, operational procedures, or troubleshooting scenarios.
