# Prompsit CLI Skills

AI agent skills for the [Prompsit Translation API](https://prompsit.com) CLI.

Teach AI assistants (Claude Code, Codex CLI, Gemini CLI) how to use Prompsit CLI commands for translation, quality evaluation, corpus scoring, and data annotation.

## Installation

**As a Claude Code plugin:**
```bash
/plugin add Prompsit/prompsit-cli
```

**Bundled with CLI** (automatic on first launch):
```bash
npm install -g prompsit-cli
prompsit    # prompts to install skills on first interactive launch
```

## Skills

| Skill | Description | When to Use |
|-------|-------------|-------------|
| `prompsit-setup` | Install CLI + request API token | Getting started, first-time setup |
| `prompsit-translate` | Translate text and documents | Text translation, document translation, format conversion |
| `prompsit-evaluate` | Evaluate translation quality | BLEU, chrF, MetricX scoring |
| `prompsit-score` | Score parallel corpora | Bicleaner quality scoring for TMX/TSV |
| `prompsit-annotate` | Annotate monolingual data | Monotextor metadata (language ID, doc scoring) |

## Requirements

- **Node.js** 22+
- **Playwright MCP** (optional) — for automated API token request via contact form
