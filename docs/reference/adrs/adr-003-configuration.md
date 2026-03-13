# ADR-003: Configuration Management (Zod + smol-toml)

**Date:** 2026-02-15 | **Status:** Accepted | **Category:** configuration | **Decision Makers:** Engineering Team

<!-- SCOPE: Architecture Decision Record for configuration library selection ONLY. Contains context, decision, rationale, consequences, alternatives. -->
<!-- DO NOT add here: Settings implementation -> config/settings.ts, Schemas -> config/schemas.ts, TOML I/O -> config/toml-io.ts -->

---

## Context

The CLI requires a configuration system that supports: TOML config file (`~/.prompsit/config.toml`), environment variable overrides with nested keys (`PROMPSIT_API__BASE_URL`), three nested sections (`[api]`, `[cli]`, `[telemetry]`) with typed fields, runtime type validation (int timeouts, float retry delays, bool flags), and a clear precedence order (env > file > defaults). The same validation library should handle both config and API response validation.

---

## Decision

Use **Zod 4+** for schema validation and **smol-toml 1.6+** for TOML parsing/writing. Environment variable parsing via custom `env-parser.ts`.

---

## Rationale

1. **Single validation library** -- Zod schemas validate both configuration (`config/schemas.ts`) and API responses (`api/models.ts`). `z.infer<typeof Schema>` provides TypeScript types from schemas, eliminating manual interface declarations.
2. **TOML with smol-toml** -- Zero-dependency, spec-compliant TOML 1.0 parser/stringifier. `parse()` returns plain objects, `stringify()` writes back. ~3KB bundle vs. 30KB+ for `@iarna/toml`.
3. **Explicit env precedence** -- Custom `env-parser.ts` reads `PROMPSIT_*` variables, splits `__` delimiter into nested paths, merges over TOML values. No magic -- clear `loadSettings()` flow: defaults -> TOML -> env.

---

## Consequences

**Positive:**
- `z.infer<typeof ConfigSchema>` = TypeScript type (zero duplication between schema and type)
- Zod `.default()` provides defaults inline with schema definitions
- smol-toml roundtrip: `parse(read()) -> modify -> stringify(write())` preserves format
- Env parsing is explicit: `PROMPSIT_API__TIMEOUT=60` -> `{ api: { timeout: 60 } }`
- Same Zod used for API responses, CLI option validation, and config -- one library for all validation

**Negative:**
- No auto-env discovery -- env vars manually mapped in `env-parser.ts`
- TOML write doesn't preserve comments (smol-toml limitation)
- Zod v4 is newer -- smaller ecosystem than Joi/Yup (but growing rapidly)

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|--------------|
| **convict** (Mozilla) | Built-in env/file/defaults merging, validation, nested config | No TypeScript type inference from schema, custom validation format (not Zod), CJS-only, unmaintained since 2023 | No TS type inference; would need separate type declarations for every config field |
| **dotenv + Joi** | Popular combination, Joi has rich validation | Two libraries (dotenv + Joi), Joi types not inferrable to TS, dotenv only handles flat key=value (no nested sections) | Joi doesn't provide `z.infer` equivalent; dotenv can't represent `[api]` TOML sections |
| **cosmiconfig** | Auto-discovers config files (JSON, YAML, TOML, JS), widely used | File discovery only (no validation, no env var merging), requires separate validation library | Only solves file discovery; we already know the config path (`~/.prompsit/config.toml`) |

---

## Related Decisions

- ADR-001: CLI Framework (Commander.js) -- commands read typed settings from config
- ADR-002: HTTP Client (got) -- timeout/retry/pool settings from `[api]` section

---

**Last Updated:** 2026-02-15
