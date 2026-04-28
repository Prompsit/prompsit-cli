# Prompsit CLI Skills

AI agent skills for the [Prompsit Translation API](https://prompsit.com) CLI.

This marketplace ships **two plugins** that AI assistants (Claude Code, Codex CLI, Gemini CLI) can install independently:

- **`prompsit`** — thin skill wrappers for the Prompsit CLI: setup, translation, quality evaluation, corpus scoring, data annotation.
- **`prompsit-localize`** — an editorial localization workflow that orchestrates an LLM editor pass on top of `prompsit translate`.

Install whichever set you need.

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

### Plugin: `prompsit` — CLI command skills

| Skill | Description | When to Use |
| ----- | ----------- | ----------- |
| `prompsit-setup` | Install CLI + request API token | Getting started, first-time setup |
| `prompsit-translate` | Translate text and documents | Text translation, document translation, format conversion |
| `prompsit-evaluate` | Evaluate translation quality | BLEU, chrF, MetricX scoring |
| `prompsit-score` | Score parallel corpora | Bicleaner quality scoring for TMX/TSV |
| `prompsit-annotate` | Annotate monolingual data | Monotextor metadata (language ID, doc scoring) |

### Plugin: `prompsit-localize` — agent workflow skills

| Skill | Description | When to Use |
| ----- | ----------- | ----------- |
| `prompsit-localize` | Editorial localization pipeline | Multi-locale website, UI, or marketing copy where tone, glossary, and cultural fit matter |

## Requirements

- **Node.js** 22+
- **Playwright MCP** (optional) — for automated API token request via contact form
