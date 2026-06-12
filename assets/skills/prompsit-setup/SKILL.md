---
name: prompsit-setup
description: |
  Install Prompsit CLI and sign in to the Prompsit Translation API.
  Use when the user wants to set up Prompsit Translation API for the first time.
license: Apache-2.0
---

# Prompsit Setup

Install Prompsit CLI and authenticate with the Prompsit Translation API.

**Capabilities:** text/document translation, quality evaluation (QE), parallel corpus scoring (Bicleaner), monolingual data annotation (Monotextor).

**Related skills:** `prompsit-translate`, `prompsit-evaluate`, `prompsit-score`, `prompsit-annotate`.

## When to Use

- User wants to install Prompsit CLI
- User needs API access for the Prompsit Translation API
- User asks "how to get started with Prompsit"
- User asks about login, authentication, or setup

## Workflow

Execute phases sequentially. Skip completed phases (e.g. if CLI is already installed, skip Phase 1).

### Phase 1: Install CLI

1. Check if already installed:
   ```bash
   prompsit --version
   ```
2. If not found, install globally:
   ```bash
   npm install -g prompsit-cli
   ```
   Occasional-use alternative: `npx prompsit-cli --help`
3. Verify installation: `prompsit --version` must print a version string.

### Phase 2: Authenticate

1. Run browser/device-flow login:
   ```bash
   prompsit login
   ```
2. Follow the printed instructions:
   - If a browser opens, enter the one-time code shown in the terminal.
   - If no browser is available, copy the printed URL into another machine's browser. The CLI also attempts to copy the URL to the clipboard.
3. Verify connectivity:
   ```bash
   prompsit health
   ```

Fallback for already-issued Prompsit API secrets:

```bash
prompsit login -a "EMAIL" -s "SECRET"
```

### Linux Install Notes

Prompsit CLI requires Node.js 22.19+. Prefer a Node version manager (`nvm`, `fnm`, or Volta). If a system Node/npm install raises `EACCES` on global install, configure a user-owned prefix and retry without sudo:

```bash
mkdir -p ~/.local
npm config set prefix ~/.local
echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.profile
source ~/.profile
npm install -g prompsit-cli
```

## Configuration Reference

Settings stored in `~/.prompsit/config.toml`. Credentials in `~/.prompsit/credentials.json`.

```bash
prompsit config show                    # show all settings with sources
prompsit config <key>                   # get value
prompsit config <key> <value>           # set value
prompsit config api-url [preset|url]    # set API URL (presets: test, local, or custom URL)
prompsit config language [code]         # set UI language
prompsit config reset [-f]              # reset config and credentials
```

**Precedence:** Environment variables (`PROMPSIT_*`) > config.toml > defaults. Nested keys use `__` delimiter (e.g. `PROMPSIT_API__BASE_URL`).

## System Commands

```bash
prompsit health    # check API connectivity
prompsit usage     # daily API usage statistics
prompsit          # interactive REPL with tab-completion
```

## Error Handling

| Error | Resolution |
|-------|------------|
| 401 Unauthorized | Run `prompsit login` |
| 429 Rate Limited | CLI auto-waits up to `rate-limit-max-wait` (default: 300s) |
| Cold start timeout | API engines warm up; CLI retries up to `warmup-timeout` (default: 120s) |
| Job timeout | Long document jobs timeout after `job-timeout` (default: 600s) |

## Definition of Done

- [ ] CLI installed and `prompsit --version` returns a version
- [ ] `prompsit login` succeeds
- [ ] `prompsit health` returns OK

---
**Version:** 1.0.0
**Last Updated:** 2026-06-12
