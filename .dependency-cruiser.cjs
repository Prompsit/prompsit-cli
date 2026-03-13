/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── Circular dependencies ──────────────────────────────────
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make refactoring fragile and break lazy imports.",
      from: {},
      to: { circular: true },
    },

    // ── Layer boundary rules ───────────────────────────────────
    // Architecture: Presentation (commands, repl, tui, output) → Domain (api, config, errors, i18n) → Infrastructure (runtime, logging)
    {
      name: "api-no-presentation",
      severity: "error",
      comment: "API layer must not depend on presentation (commands, output, TUI, REPL).",
      from: { path: "^src/api/" },
      to: { path: "^src/(output|tui|commands|repl)/" },
    },
    {
      name: "config-no-commands",
      severity: "error",
      comment: "Config layer must not depend on commands.",
      from: { path: "^src/config/" },
      to: { path: "^src/commands/" },
    },
    {
      name: "errors-no-commands",
      severity: "error",
      comment: "Error definitions must not depend on commands.",
      from: { path: "^src/errors/" },
      to: { path: "^src/(commands|repl|tui|output)/" },
    },
    {
      name: "i18n-pure",
      severity: "error",
      comment: "i18n module must be self-contained (no presentation deps).",
      from: { path: "^src/i18n/" },
      to: { path: "^src/(commands|repl|tui|output)/" },
    },
    {
      name: "runtime-no-presentation",
      severity: "error",
      comment: "Runtime utilities must not depend on presentation.",
      from: { path: "^src/runtime/" },
      to: { path: "^src/(commands|repl|tui)/" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["module", "main", "types", "typings"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
