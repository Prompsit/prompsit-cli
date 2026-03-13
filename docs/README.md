# Documentation System

**Version:** 1.0.0
**Last Updated:** 2025-12-17
**Status:** Draft

<!-- SCOPE: Root documentation hub with general standards and navigation ONLY. Contains documentation structure overview, SCOPE tags rules, maintenance conventions, sequential numbering, placeholder conventions. NO content duplication - all details in subdirectory READMEs. -->
<!-- DO NOT add here: Project-specific details → project/README.md, Reference documentation → reference/README.md, Task management rules → tasks/README.md, Implementation code → Task descriptions -->

---

## Overview

This documentation system provides comprehensive technical and operational documentation following industry standards (ISO/IEC/IEEE 29148, arc42, C4 Model, Michael Nygard's ADR format).

**Documentation is organized into three main areas:**
- **Project Documentation** - Requirements, architecture, technical specifications
- **[Principles](principles.md)** - 9 core development principles and decision framework
- **Reference Documentation** - Architecture decisions (ADRs), reusable patterns (Guides), API references (Manuals)
- **Task Management** - Linear workflow, task tracking rules, kanban board

---

## General Documentation Standards

All documentation in this system follows these conventions:

### SCOPE Tags

Every document contains HTML comment tags defining its boundaries:

```html
<!-- SCOPE: What this document CONTAINS -->
<!-- DO NOT add here: What belongs elsewhere → where to find it -->
```

**Purpose**: Prevent content duplication, maintain single source of truth, redirect to correct location.

**Example**:
```html
<!-- SCOPE: Project requirements ONLY. Functional requirements ONLY. -->
<!-- DO NOT add here: Architecture details → architecture.md, Implementation → Task descriptions -->
```

### Maintenance Sections

All documents contain a **Maintenance** section with:

| Field | Description | Example |
|-------|-------------|---------|
| **Update Triggers** | When to update the document | "When changing acceptance criteria (Non-Functional Requirements are forbidden here)" |
| **Verification** | How to verify document is current | "Check all FR-XXX IDs referenced in tests exist" |
| **Last Updated** | Date of last modification | "2025-11-15" |

### Sequential Numbering

**Rule**: Phases/Sections/Steps use sequential integers: 1, 2, 3, 4 (NOT 1, 1.5, 2).

**Exceptions**:

| Case | Format | Example | When Valid |
|------|--------|---------|------------|
| **Conditional Branching** | Letter suffixes | Phase 4a (CREATE), Phase 4b (REPLAN), Phase 5 | Mutually exclusive paths (EITHER A OR B) |
| **Loop Internals** | Steps inside Phase | Phase 3: Loop → Step 1 → Step 2 → Repeat | Cyclic workflows with repeated sub-steps |

**Important**: When inserting new items, renumber all subsequent items.

### Placeholder Conventions

Documents use placeholders for registry updates:

| Placeholder | Location | Purpose | Updated By |
|-------------|----------|---------|------------|
| `{{ADR_LIST}}` | reference/README.md | ADR registry | ln-321-best-practices-researcher |
| `{{GUIDE_LIST}}` | reference/README.md | Guide registry | ln-321-best-practices-researcher |
| `{{MANUAL_LIST}}` | reference/README.md | Manual registry | ln-321-best-practices-researcher |

**Usage**: Skills automatically add new entries BEFORE the placeholder using Edit tool.

### Writing & Standards

**Full requirements:** [documentation_standards.md](documentation_standards.md) (82 requirements in 12 categories)

**Format priority:** Tables > Lists > Text. Compression targets: main docs < 500 lines, hubs < 200 lines, guides < 800 lines.

---

## Documentation Structure

### 1. [Project Documentation](project/README.md)

Core project documentation:

- **[requirements.md](project/requirements.md)** - Functional requirements (FR-XXX-NNN) with MoSCoW prioritization
- **[architecture.md](project/architecture.md)** - System architecture (C4 Model, arc42)
- **[tech_stack.md](project/tech_stack.md)** - Technology stack, dependencies, build system
- **[api_spec.md](project/api_spec.md)** - REST API specification

**Purpose**: Define WHAT we build and WHY.

---

### 2. [Reference Documentation](reference/README.md)

Reusable knowledge base and architecture decisions:

- **[ADRs](reference/adrs/)** - Architecture Decision Records (format: `adr-NNN-slug.md`)
- **[Guides](reference/guides/)** - Project patterns and best practices (format: `NN-pattern-name.md`)
- **[Manuals](reference/manuals/)** - Package API references (format: `package-version.md`)

**Purpose**: Document HOW we build (patterns, decisions, APIs).

**Created by**: ln-321-best-practices-researcher

---

---

## Standards Compliance

This documentation system follows:

| Standard | Application | Reference |
|----------|-------------|-----------|
| **ISO/IEC/IEEE 29148:2018** | Requirements Engineering | [requirements.md](project/requirements.md) |
| **ISO/IEC/IEEE 42010:2022** | Architecture Description | [architecture.md](project/architecture.md) |
| **arc42 Template** | Software architecture documentation | [architecture.md](project/architecture.md) |
| **C4 Model** | Software architecture visualization | [architecture.md](project/architecture.md) |
| **Michael Nygard's ADR Format** | Architecture Decision Records | [reference/adrs/](reference/adrs/) |
| **MoSCoW Prioritization** | Requirements prioritization | [requirements.md](project/requirements.md) |

---

## Contributing to Documentation

When updating documentation:

1. **Check SCOPE tags** at top of document to ensure changes belong there
2. **Update Maintenance > Last Updated** date in the modified document
3. **Update registry** if adding new documents:
   - ADRs, Guides, Manuals → automatically updated by skills
   - Project docs → update [project/README.md](project/README.md) manually
4. **Follow sequential numbering** rules (no decimals unless conditional branching)
5. **Add placeholders** if creating new document types
6. **Verify links** after structural changes

---

## Quick Navigation

| Area | Key Documents | Skills |
|------|---------------|--------|
| **Standards** | [documentation_standards.md](documentation_standards.md) | ln-111-root-docs-creator, ln-121-structure-validator |
| **Project** | [project/README.md](project/README.md), [requirements.md](project/requirements.md), [architecture.md](project/architecture.md) | ln-114-project-docs-creator, ln-122-content-updater |
| **Reference** | [ADRs](reference/adrs/), [Guides](reference/guides/), [Manuals](reference/manuals/) | ln-321-best-practices-researcher |
| **Tasks** | [kanban_board.md](tasks/kanban_board.md), [README.md](tasks/README.md) | ln-210-epic-coordinator, ln-220-story-coordinator, ln-310-story-decomposer |

---

## Maintenance

**Update Triggers**:
- When adding new documentation areas (new subdirectories)
- When changing general documentation standards (SCOPE, Maintenance, Sequential Numbering)
- When changing writing guidelines or documentation formatting standards
- When adding new placeholder conventions
- When updating compliance standards

**Verification**:
- All links to subdirectory READMEs are valid
- SCOPE tags accurately reflect document boundaries
- Placeholder conventions documented for all registries
- Standards Compliance table references correct documents

**Last Updated**: 2026-02-10

---

**Template Version:** 1.1.0
**Template Last Updated:** 2025-11-16
