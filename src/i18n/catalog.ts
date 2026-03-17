// English string catalog - single source of truth for all UI text.
//
// Every user-facing string in the CLI is registered here.
// Keys use dot-notation: section.context.name
// Values are English text with optional {name} placeholders.

export const STRINGS = {
  // === auth.py ===
  "auth.login.no_credentials": "No credentials provided",
  "auth.login.opening_contact": "Opening {url} to request API access...",
  "auth.login.authenticating": "Authenticating...",
  "auth.login.success": "Successfully authenticated!",
  "auth.login.expires": "Session expires in {hours} hours",
  "auth.logout.success": "Successfully logged out.",
  "auth.status.authenticated": "Authenticated",
  "auth.status.account": "Account:",
  "auth.status.token": "Token:",
  "auth.status.not_authenticated": "Not authenticated",
  "auth.login.prompt_account": "Account email: ",
  "auth.login.prompt_secret": "API secret: ",
  "auth.login.credentials_required": "Account and secret are required.",

  // === config.py ===
  "config.invalid_key": "Invalid key:",
  "config.valid_keys": "Valid keys:",
  "config.set_success": "Set {name} = {value}",
  "config.get_not_set": "{name}: not set",
  "config.file_location": "Config file:",
  "config.reset.confirm": "Reset all configuration to defaults?",
  "config.reset.confirm_full":
    "This will delete config.toml and clear stored credentials. Continue? [y/N] ",
  "config.reset.cancelled": "Cancelled",
  "config.reset.success": "Configuration reset to defaults",
  "config.reset.done": "Configuration and credentials cleared.",
  "config.api_url.set_to": "API URL set to: {url}",

  // === config api-url ===
  "config.api_url.current": "Current API URL: {url}",
  "config.api_url.presets": "Available presets:",
  "config.api_url.invalid_preset": "Unknown preset: {name}",
  "config.api_url.active": "(active)",
  "config.api_url.invalid_scheme":
    "Invalid URL scheme: {scheme}. Only http and https are supported.",
  "config.api_url.unknown_preset":
    "Unknown preset: {name}. Available: {list}. Or provide a full URL.",

  // === config TUI ===
  "config.tui.title": "Prompsit CLI Settings",
  "config.tui.hint": "Up/Down navigate  Left/Right change  Esc exit",
  "config.tui.not_tty": "Settings TUI requires an interactive terminal.",
  "config.tui.logout_warning": "Warning: Logged out (API URL changed). Tokens are URL-scoped.",
  "config.tui.save_error": "Failed to save settings. Check logs for details.",

  // === config language ===
  "config.language.current": "Current language: {lang}",
  "config.language.available": "Available languages:",
  "config.language.no_pairs": "No translation pairs available from English",
  "config.language.login_required": "Login required. Run: {cmd}",
  "config.language.invalid_code": "Language '{lang}' is not available",
  "config.language.reset_success": "Language reset to English",
  "config.language.success": "Language switched: {from} \u2192 {lang}",
  "config.language.failed": "Failed to translate CLI to '{lang}'. Language not changed.",
  "config.language.partial_warning": "Partial translation: {translated}/{total} strings",
  "config.language.hint": "Run '{cmd}' to switch (requires login)",
  "config.language.loaded_cache": "Loaded {count} cached translations for '{lang}'",
  "config.language.translate_failed":
    "Failed to translate CLI to '{lang}'. Check language code and try again.",
  "config.language.partial": "Partial translation: {count} strings translated",

  // === translate.py ===
  "translate.source_required": "Source language required.",
  "translate.source_hint": "Use {flag}",
  "translate.target_required": "Target language required.",
  "translate.target_hint": "Use {flag}",
  "translate.status": "Translating...",
  "translate.file.upload_status": "Uploading document...",
  "translate.file.job_created": "Job created:",
  "translate.file.sse_unavailable": "SSE unavailable, using polling...",
  "translate.file.download_status": "Downloading result...",
  "translate.file.success": "Translated file saved to:",
  "translate.file.langs_required": "Source and target languages required.",
  "translate.file.not_found": "File not found:",

  // === languages ===
  "languages.no_results": "No language pairs found",
  "languages.filters": "Filters: source={source}, target={target}",
  "languages.total": "Total: {count} pairs",
  "languages.default": "default",
  "languages.score_total": "Total: {count} languages",

  // === evaluate.py ===
  "evaluate.invalid_metrics": "Invalid metrics:",
  "evaluate.valid_metrics": "Valid metrics:",
  "evaluate.status": "Evaluating...",
  "evaluate.file_not_found": "File not found:",
  "evaluate.invalid_line": "Invalid line {line_num}: expected 3 tab-separated columns",
  "evaluate.no_segments": "No segments found in file",
  "evaluate.batch_status": "Evaluating {count} segments...",
  "evaluate.total": "Evaluated {count} segments",

  // === health.py ===
  "health.status": "Checking service health...",
  "health.api_version": "API version:",
  "health.api_url": "API URL:",

  // === annotate ===
  "annotate.file_not_found": "File not found:",
  "annotate.upload_status": "Uploading corpus...",
  "annotate.job_created": "Job created:",
  "annotate.sse_unavailable": "SSE unavailable, using polling...",
  "annotate.download_status": "Downloading result...",
  "annotate.success": "Annotated file saved to:",
  "annotate.invalid_metadata": "Invalid metadata options:",
  "annotate.metadata_hint": "Valid options: lid, dedup, pii, adult_filter, monofixer, docscorer.",
  "annotate.invalid_lid_model": "Invalid LID model:",
  "annotate.lid_model_hint": "Valid models: openlid-v2, nllb, openlid-v3.",

  // === score ===
  "score.file_not_found": "File not found:",
  "score.target_not_found": "Target file not found:",
  "score.upload_status": "Uploading data...",
  "score.job_created": "Job created:",
  "score.sse_unavailable": "SSE unavailable, using polling...",
  "score.download_status": "Downloading result...",
  "score.success": "Scored file saved to:",

  // === discovery (replaces formats) ===
  "discovery.total": "Total: {count} formats",
  "discovery.no_formats": "No formats found",
  "discovery.output_formats": "Output formats: {formats}",
  "discovery.output_format": "Output format: {format}",

  // === evaluate file ===
  "evaluate.file.upload_status": "Uploading file for scoring...",
  "evaluate.file.success": "Evaluated file saved to:",

  // === _job_tracking.py ===
  "job_tracking.cancelled": "Job was cancelled",
  "job_tracking.sse_unavailable": "SSE unavailable, using polling...",
  "job_tracking.dlq": "Job failed after multiple retries (dead-letter queue)",
  "job_tracking.unknown_status": "Job entered unexpected status: {status}",
  "job_tracking.timeout": "Job timed out after {seconds}s",

  // === output/tables.py - table titles ===
  "table.translation.title": "Translation",
  "table.translation.via": "via",
  "table.translation.in": "in",
  "table.languages.title": "Available Language Pairs",
  "table.evaluation.title": "Quality Evaluation Results",
  "table.config.title": "Configuration",
  "table.health.title": "Service Health",
  "table.formats.title": "Supported Document Formats",

  // === output/tables.py - column headers ===
  "table.col.source": "Source",
  "table.col.translation": "Translation",
  "table.col.latency": "Latency",
  "table.col.qe_score": "QE Score",
  "table.col.target": "Target",
  "table.col.example": "Example",
  "table.col.metric": "Metric",
  "table.col.score": "Score",
  "table.col.quality": "Quality",
  "table.col.key": "Key",
  "table.col.value": "Value",
  "table.col.component": "Component",
  "table.col.status": "Status",
  "table.col.id": "ID",
  "table.col.input": "Input",
  "table.col.engine": "Engine",

  // === output/tables.py - values and labels ===
  "table.quality.excellent": "Excellent",
  "table.quality.good": "Good",
  "table.quality.poor": "Poor",
  "table.config.not_set": "not set",
  "table.health.api": "API",
  "table.health.database": "Database",
  "table.health.services": "Services",

  // === errors/catalog.py - labels ===
  "error.auth.label": "Authentication error",
  "error.auth.hint": "Run '{cmd}' to authenticate.",
  "error.ratelimit.label": "Rate limit exceeded",
  "error.ratelimit.hint": "Wait a moment and try again.",
  "error.validation.label": "Invalid input",
  "error.validation.hint": "Run the command with {flag} for usage details.",
  "error.job_cancelled.label": "Job cancelled",
  "error.job_failed.label": "Job failed",
  "error.server.label": "Server error",
  "error.server.hint": "The API is experiencing issues. Try again later.",
  "error.unsupported_lang.label": "Unsupported language",
  "error.unsupported_lang.hint":
    "Language '{0}' is not available. Run '{cmd}' to see supported pairs.",
  "error.unsupported_pair.label": "Unsupported language pair",
  "error.unsupported_pair.hint": "Run '{cmd}' to see available language pairs.",
  "error.unsupported_format.label": "Unsupported format",
  "error.unsupported_format.hint": "Run '{cmd}' to see supported file formats.",
  "error.job_not_found.label": "Job not found",
  "error.job_not_found.hint": "Check the job ID and try again.",
  "error.api.label": "API error",
  "error.forbidden.label": "Access denied",
  "error.forbidden.hint": "Check your account permissions or contact your administrator.",
  "error.zod.label": "Unexpected API response format",
  "error.zod.hint": "API may have changed. Update the CLI or report this issue.",

  // === validation — command-specific input errors ===
  "validate.missing_argument": "Missing required argument '{name}'",
  "validate.missing_option": "Required option '{option}' not specified",
  "validate.translate.text.arg_order":
    '"{violation}" -- texts must come before options. Usage: translate "text1" "text2" -s lang -t lang',
  "validate.translate.mixed_inputs":
    "Cannot mix text and @file inputs. Use either text mode or file mode, not both.",
  "validate.evaluate.mixed_modes":
    "Cannot mix positional inputs with -s/-h/-r flags. Use file mode or inline mode, not both.",
  "validate.evaluate.mixed_inputs":
    "Cannot mix @file and batch inputs. Use either file mode or batch mode, not both.",
  "validate.evaluate.missing_inline_flags":
    "Inline mode requires all three flags: -s (source), -h (hypothesis), -r (reference).",
  "validate.annotate.invalid_int": "Option '{option}' must be a positive integer",
  "validate.score.source_dir_target_file":
    "Source is a directory but target is a file. Both must be the same type.",
  "validate.score.target_dir_source_file":
    "Target is a directory but source is a file. Both must be the same type.",
  "validate.score.invalid_source_lang": "Invalid source language for scoring: '{lang}'",
  "validate.score.source_lang_hint": "Supported languages: en, de, es.",
  "validate.score.source_lang_required":
    "Source language (-s) is required for non-TMX formats. Supported: en, de, es.",

  // === usage ===
  "usage.daily_usage": "Daily usage",
  "usage.tier": "Tier",
  "usage.resets": "Resets",
  "usage.corpus_usage": "Corpus usage",
  "usage.subscription_inactive": "Subscription is not active.",

  // === warmup retry ===
  "warmup.waiting": "Waiting for engine to start...",
  "warmup.retry": "Engine not ready, retrying... ({elapsed}s)",

  // === errors/handler.py ===
  "error.network.label": "Network error",
  "error.network.hint": "Check your connection and try again.",
  "error.network.ssl.hint": "SSL/TLS connection failed. Check your API URL configuration.",
  "error.network.unavailable.hint":
    "Server temporarily unavailable. Contact us: https://prompsit.com/en/contact",

  // === api/curl ===
  "curl.panel_title": "API Request",

  // === repl.py - command descriptions ===
  "repl.cmd.login": "Authenticate (or get credentials)",
  "repl.cmd.logout": "Clear stored tokens",
  "repl.cmd.config": "Show/get/set configuration",
  "repl.cmd.config_tui": "Open interactive settings editor",
  "repl.cmd.config_show": "Show all configuration settings",
  "repl.cmd.config_get": "Get a specific configuration value",
  "repl.cmd.config_set": "Set a configuration value",
  "repl.cmd.config_api_url": "Set API URL (preset: test, local, or custom URL)",
  "repl.cmd.config_reset": "Reset configuration to defaults",
  "repl.cmd.config_path": "Show configuration file path",
  "repl.cmd.language": "Switch CLI interface language",
  "repl.cmd.translate": "Translate text or documents",
  "repl.cmd.t": "Translate (alias)",
  "repl.cmd.eval": "Evaluate translation quality",
  "repl.cmd.score": "Score parallel corpus quality (Bicleaner)",
  "repl.cmd.annotate": "Annotate corpus (Monotextor: Language ID, PII, quality)",
  "repl.cmd.health": "Check API health",
  "repl.cmd.usage": "Show daily API usage",
  "repl.cmd.clear": "Clear screen and show banner",
  "repl.cmd.help": "Show help",
  "repl.cmd.help_alias": "Show help (alias)",
  "repl.cmd.exit": "Exit REPL",
  "repl.cmd.quit": "Exit REPL",
  "repl.cmd.q": "Exit (alias)",

  // === repl.py - help group names ===
  "repl.help.group.basics": "Basics",
  "repl.help.group.text_translation": "Text Translation",
  "repl.help.group.evaluation": "Evaluation",
  "repl.help.group.score": "Score",
  "repl.help.group.annotate": "Annotate",
  "repl.help.group.config": "Configuration",
  "repl.help.group.system": "System",
  "repl.help.label.aliases": "Aliases:",
  "repl.help.label.options": "Options:",
  "repl.help.label.subcommands": "Subcommands:",
  "repl.help.label.examples": "Examples:",

  "repl.help.hint.all_commands": "Type 'help' to see all commands",

  // === repl.py - option descriptions (help page) ===
  "repl.opt.account": "Account email",
  "repl.opt.secret": "API secret",
  "repl.opt.source": "Source language code",
  "repl.opt.target": "Target language code",
  "repl.opt.qe": "Enable quality estimation score",
  "repl.opt.output": "Output directory (default: beside input)",
  "repl.opt.output_format": "Output format (e.g. docx)",
  "repl.opt.source_text": "Source text",
  "repl.opt.hypothesis": "Machine translation (hypothesis)",
  "repl.opt.reference": "Reference translation",
  "repl.opt.metrics": "Comma-separated: bleu,chrf,metricx,comet (default: bleu,chrf)",
  "repl.opt.formats": "Show supported file formats",
  "repl.opt.languages": "Show available language pairs",
  "repl.opt.metadata":
    "Metadata to add (comma-separated: lid, dedup, pii, adult_filter, monofixer, docscorer)",
  "repl.opt.min_len": "Min document length in chars (default: 500, CJK: 300)",
  "repl.opt.min_avg_words": "Min average words per segment (default: 5)",
  "repl.opt.source_lang":
    "Source language (en, de, es); target can be any language. Required for TSV/parallel, auto-detected for TMX",
  "repl.opt.lid_model": "LID model: openlid-v3 (default), openlid-v2, nllb",

  // === repl.py - welcome messages ===
  "repl.welcome.authorized": "authorized",
  "repl.welcome.not_authorized": "not authorized",
  "repl.welcome.translate_hint": "Translate text",
  "repl.welcome.translate_file_hint": "Translate file(s)",
  "repl.welcome.eval_hint": "Evaluate text",
  "repl.welcome.eval_file_hint": "Evaluate file(s)",
  "repl.welcome.score_hint": "Score bitext",

  "repl.welcome.annotate_hint": "Annotate monotext",
  "repl.welcome.login_hint": "Authenticate",
  "repl.welcome.tip":
    "Start typing for suggestions | Tab: next field | ?: full help | clear: reset screen",

  // === repl.py - runtime messages ===
  "repl.goodbye": "Goodbye!",
  "repl.ctrl_c_hint": "Press Ctrl+C again to exit",
  "repl.unclosed_quote_hint": "Unclosed quote. Add closing quote or Ctrl+C to cancel.",
  "repl.error.unquoted_value": "Values must be quoted",
  "repl.error.arg_order": "Texts must come before options",
  "repl.unknown_command": "Unknown command:",
  "repl.help_tip": "Type '{cmd}' for available commands",
  "repl.error": "Error:",
  "repl.cancelled": "Cancelled.",
  "repl.running": "Running...",

  // -- clipboard --
  "repl.clipboard.sent_osc52": "Sent to terminal clipboard (OSC 52)",
  "repl.clipboard.paste_unavailable": "Paste unavailable (no clipboard tool)",
  "repl.clipboard.no_display_warning":
    "No display server. Copy uses OSC 52 (terminal must support it).",
  "repl.clipboard.no_tools_warning":
    "No clipboard tools found. Install wl-clipboard (Wayland) or xclip (X11).",

  // -- curl panel --
  "repl.curl_panel.copy_hint": "F8: copy curl",
  "repl.curl_panel.copied": "copied to clipboard",
  "repl.curl_panel.no_curl": "No curl command available",
  "repl.cmd.copy-curl": "Copy last curl command to clipboard",

  // === shell CLI runtime messages ===
  "cli.usage_error.hint": "Invalid command or arguments. Run '{cmd}' for available commands.",

  // === translator.py - visualizer step labels ===
  "i18n.viz.title": "Translating CLI to {lang}",
  "i18n.viz.step.collect": "Collect strings",
  "i18n.viz.step.send": "Send to API",
  "i18n.viz.step.receive": "Receive translations",
  "i18n.viz.step.save": "Save to cache",
  "i18n.viz.preview": "Preview:",
  "i18n.viz.waiting": "waiting...",
  "i18n.viz.strings": "{count} strings",
  "i18n.viz.batch": "Batch {current}/{total}",
  "i18n.viz.received": "{done}/{total}",
  "i18n.viz.batches_done": "{count} batches",
  "i18n.viz.writing": "writing...",
  "i18n.viz.failed": "API error, skipped",
} as const satisfies Record<string, string>;

export type StringKey = keyof typeof STRINGS;
