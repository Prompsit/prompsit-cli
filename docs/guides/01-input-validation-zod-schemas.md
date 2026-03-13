# Input Validation with Zod Schemas

<!-- SCOPE: Pattern documentation for Zod-based input validation ONLY.
     Contains: principle, project implementation, Do/Don't/When patterns, sources.
     DO NOT add here: Full API reference -> manual, Architecture decisions -> ADR -->

## Principle

Validate external data at system boundaries using schema-first design (Zod v4). Types are inferred from schemas, not defined separately -- single source of truth for both runtime validation and TypeScript types. Industry standard: validate at entry points (file I/O, env vars, API responses), trust internal code.

## Our Implementation

prompsit-cli uses Zod v4 schemas as the foundation for configuration validation. Schemas defined in `src/config/schemas.ts` serve as contracts for TOML parsing (`readConfigToml()`), env var override (`parseEnvOverrides()`), and credential JSON storage. All external data passes through `Schema.parse()` at boundary -- Zod fills missing fields with `.default()` values, ensuring type-safe `Settings` objects throughout the application. Internal code never re-validates.

## Patterns

| Do This | Don't Do This | When to Use |
|---------|---------------|-------------|
| Define schema first, infer types with `z.infer<typeof Schema>` | Define TypeScript interfaces separately from validation | Every new data structure from external source |
| Use `.default()` on every field for graceful degradation | Require all fields -- crash on missing optional config | Config schemas where partial input is valid |
| Use `Schema.parse()` at boundary, trust result internally | Re-validate same data in multiple layers | File read, env parse, API response entry points |
| Use `.safeParse()` when error recovery needed | Use `.parse()` inside try/catch for flow control | User-facing input where errors are expected |
| Use snake_case keys in schemas matching TOML/JSON contract | Use camelCase in schemas, transform later | TOML/JSON convention consistency |
| Compose with `z.object({ section: SectionSchema })` | Flatten all fields into one giant schema | Nested config with logical sections (api, cli, telemetry) |
| Use top-level validators `z.email()`, `z.url()`, `z.uuid()` | Use deprecated `.string().email()` chained methods | Common string formats (Zod v4 tree-shakable API) |
| Use `z.prettifyError(error)` for user-facing errors | Log raw `ZodError.issues` to users | Displaying validation errors in CLI or logs |

## Sources

- [Zod v4 Documentation](https://zod.dev/v4) (2025-2026)
- [Zod v4 Changelog -- Default Value Changes](https://zod.dev/v4/changelog) (v4.0.1)
- 12-Factor App, Section III: Config -- store config in environment
- Internal: [Architecture.md](../project/architecture.md)

## Related

**ADRs:** None yet
**Guides:** None yet

---
**Last Updated:** 2026-02-13

## Maintenance

**Update Triggers:**
- When Zod version changes (v4.x -> v5.x)
- When new validation boundaries added to project
- When schema patterns change

**Verification:**
- [ ] All patterns reflect current Zod v4 API
- [ ] Sources have dates >= 2025
- [ ] SCOPE tag present
