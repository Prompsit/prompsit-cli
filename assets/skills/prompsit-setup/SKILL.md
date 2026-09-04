---
name: prompsit-setup
description: Install Prompsit CLI and authenticate with the Prompsit Translation API.
license: Apache-2.0
---

# Prompsit setup

Use when the user needs to install, authenticate, or diagnose initial connectivity.

1. Check `prompsit --version`.
2. If unavailable, verify the Node.js requirement from the current package metadata and run `npm install -g prompsit-cli`.
3. Run `prompsit login` and follow the printed device-authorization URL and code.
4. If the user already has an issued API secret, use `prompsit login -a "EMAIL" -s "SECRET"`.
5. Run `prompsit health`.
6. Use `prompsit config show` for effective settings and their sources.

Never expose credentials in output or shell inspection. Configuration lives in `~/.prompsit/config.toml`; credentials live separately in `~/.prompsit/credentials.json`. Use `prompsit <command> --help` for current syntax and defaults.
