---
name: prompsit-setup
description: |
  Install Prompsit CLI and request API access via prompsit.com contact form.
  Use when the user wants to set up Prompsit Translation API for the first time.
license: Apache-2.0
---

# Prompsit Setup

Install Prompsit CLI and get API access for the Prompsit Translation API.

**Capabilities:** text/document translation, quality evaluation (QE), parallel corpus scoring (Bicleaner), monolingual data annotation (Monotextor).

**Related skills:** `prompsit-translate`, `prompsit-evaluate`, `prompsit-score`, `prompsit-annotate`.

## When to Use

- User wants to install Prompsit CLI
- User needs API credentials for the Prompsit Translation API
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
   Alternative (no global install): `npx prompsit-cli`
3. Verify installation: `prompsit --version` must print a version string.

### Phase 2: Request API Token

The user needs API credentials. Use the contact form at prompsit.com to request access.

**Ask the user for their email address** before proceeding.

#### With Playwright MCP (preferred)

Use browser automation to fill and submit the contact form:

1. **Navigate:**
   ```
   mcp__playwright__browser_navigate  url="https://prompsit.com/en/contact"
   ```

2. **Snapshot** to verify page loaded:
   ```
   mcp__playwright__browser_snapshot
   ```

3. **Dismiss cookie banner** (if present): click "Accept all" button.
   ```
   mcp__playwright__browser_click  element="Accept all"
   ```

4. **Fill email field** (textbox, placeholder "hi@"):
   ```
   mcp__playwright__browser_fill_form  formData=[{"selector": "[placeholder='hi@']", "value": "{user_email}"}]
   ```

5. **Fill message field** (textbox, placeholder "Enter your message", min 10 chars):
   ```
   mcp__playwright__browser_fill_form  formData=[{"selector": "[placeholder='Enter your message']", "value": "Hello, I would like to request API access for the Prompsit Translation API CLI. My email: {user_email}. Thank you."}]
   ```

6. **Click Send:**
   ```
   mcp__playwright__browser_click  element="Send"
   ```

7. **Verify submission:** snapshot should show "Thank you! We will get back to you soon."

#### Without Playwright MCP (fallback)

If browser MCP tools are unavailable:

1. Open in the user's browser: `https://prompsit.com/en/contact`
2. Instruct the user to fill in:
   - **Email:** their email address
   - **Message:** "Hello, I would like to request API access for the Prompsit Translation API CLI. My email: {email}. Thank you."
3. Click **Send** and wait for confirmation email.

### Phase 3: Authenticate

Once the user has received their API credentials (account email + secret key):

1. Run interactive login (prompts for email and secret):
   ```bash
   prompsit login
   ```
2. Verify connectivity:
   ```bash
   prompsit health
   ```
## Configuration Reference

Settings stored in `~/.prompsit/config.toml`. Credentials in `~/.prompsit/credentials.json`.

```bash
prompsit config show                    # show all settings with sources
prompsit config <key>                   # get value
prompsit config <key> <value>           # set value
prompsit config api-url [preset|url]    # set API URL (presets: production, test, edge, local)
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
- [ ] API token request submitted (or user already has credentials)
- [ ] `prompsit login` succeeds
- [ ] `prompsit health` returns OK

---
**Version:** 1.0.0
**Last Updated:** 2026-03-13
