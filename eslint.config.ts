import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import unicorn from "eslint-plugin-unicorn";

// eslint-disable-next-line @typescript-eslint/no-deprecated -- defineConfig() unavailable in this version
export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/",
      "node_modules/",
      "coverage/",
      "opencode_analysis/",
      "pi-mono-main/",
      "scripts/**/*.mjs",
      "**/*.cjs",
    ],
  },

  // Base recommended rules
  eslint.configs.recommended,

  // TypeScript strict + stylistic (type-checked)
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // TypeScript parser config
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.ts", "vitest.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Modern JavaScript/TypeScript patterns (replaces eslint-plugin-security + eslint-plugin-sonarjs)
  unicorn.configs.recommended,

  // Custom rules
  {
    rules: {
      // CLI tool uses console as primary output
      "no-console": ["warn", { allow: ["warn", "error", "info", "log"] }],

      // Unused vars: match Ruff F841 with underscore ignore
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Allow numbers/booleans in template literals (common CLI pattern)
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],

      // Unicorn: disable opinionated rules that conflict with CLI patterns
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-null": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/prefer-top-level-await": "off",
      // CLI uses named imports from node: modules extensively
      "unicorn/import-style": "off",
      // Hooks require inline arrow functions
      "unicorn/consistent-function-scoping": "off",
      // Node.js CLI uses EventEmitter, not DOM EventTarget
      "unicorn/prefer-event-target": "off",
      // .map(fn) is idiomatic; wrapping in arrow is noise
      "unicorn/no-array-callback-reference": "off",
      // pi-tui Component uses removeChild(), not DOM .remove()
      "unicorn/prefer-dom-node-remove": "off",
      // Noop stubs and fire-and-forget .catch(() => {}) are idiomatic
      "@typescript-eslint/no-empty-function": "off",
    },
  },

  // Test files: disable type-checked rules (tests excluded from tsconfig)
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "tests/**/*.ts"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "no-console": "off",
    },
  },

  // Prettier last (disables formatting rules)
  eslintConfigPrettier
);
