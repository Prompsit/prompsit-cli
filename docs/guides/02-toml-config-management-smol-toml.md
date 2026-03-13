# TOML Configuration Management with smol-toml

<!-- SCOPE: Pattern documentation for TOML-based configuration file management ONLY.
     Contains: principle, project implementation, Do/Don't/When patterns, sources.
     DO NOT add here: Full API reference -> manual, Architecture decisions -> ADR -->

## Principle

Store application configuration in TOML v1.0.0 files with schema validation at read boundary. Use a single library (smol-toml 1.6.x) for both parse and stringify operations, validated through typed schemas (Zod) on every read. Follows 12-Factor App Section III: strict separation of config from code, with env vars overriding file values.

## Our Implementation

prompsit-cli stores user configuration at `~/.prompsit/config.toml` with three nested sections: `[api]`, `[cli]`, `[telemetry]`. The file is read via `smol-toml.parse()` and validated through Zod schemas that fill missing fields with defaults. Writes use `smol-toml.stringify()` producing TOML v1.0.0 output. Config precedence: env vars (`PROMPSIT_*` with `__` nested delimiter) > TOML file > Zod schema defaults. Missing or corrupt files gracefully degrade to schema defaults.

## Patterns

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Use single library for read+write (`parse`/`stringify`) | Use separate libraries for read vs write (e.g., tomli + tomli-w) | Any TOML config file I/O |
| Validate through schema on every read, fill defaults | Trust raw parsed object without validation | Reading config from disk or external source |
| Return schema defaults on missing/corrupt file (graceful degradation) | Throw or crash on missing config file | First launch or file corruption scenarios |
| Use env var override with nested delimiter (`__`) for sections | Flatten all config into top-level env vars | Multi-section config with env override support |
| Write atomically (temp file + rename) when possible | Write directly to config file (risk of partial write) | Any config file write operation |
| Keep snake_case keys in TOML matching cross-platform consumers | Use camelCase in TOML files | When multiple language CLIs share the same config |

## Sources

- [TOML v1.0.0 Specification](https://toml.io/en/v1.0.0) - Official format specification
- [12-Factor App, Section III: Config](https://12factor.net/config) - Config separation principle
- [smol-toml GitHub](https://github.com/squirrelchat/smol-toml) - Parser/serializer documentation
- Internal: [Guide 01: Input Validation with Zod Schemas](01-input-validation-zod-schemas.md)

## Related

**ADRs:** None
**Guides:** [Guide 01: Input Validation with Zod Schemas](01-input-validation-zod-schemas.md) - Schema validation at boundaries

---
**Last Updated:** 2026-02-13
