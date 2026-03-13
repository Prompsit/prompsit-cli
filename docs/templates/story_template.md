# US00N: Story Title

**Epic:** [Epic N - Epic Name](link-to-epic)
**Priority:** High | Medium | Low

<!-- SCOPE: User Story document structure ONLY. Contains story statement, context, acceptance criteria, technical notes, tasks list. -->
<!-- DO NOT add here: task implementation → task docs, architecture decisions → ADRs, testing details → test docs -->

---

## Story

**As a** [role/persona - e.g., API client, developer, end user]

**I want** [feature/capability - what they want to do]

**So that** [business value/benefit - why it matters]

---

## Context

### Current Situation
- What exists now?
- What's the pain point?
- Why is this needed?

### Desired Outcome
- What should exist after completion?
- How will this improve user experience?
- What business value delivered?

---

## Acceptance Criteria

Use **Given-When-Then** format:

### Main Scenarios

- **Given** [initial context/state]
  **When** [action/event occurs]
  **Then** [expected outcome/result]

- **Given** [context]
  **When** [action]
  **Then** [outcome]

- **Given** [context]
  **When** [action]
  **Then** [outcome]

### Edge Cases

- **Given** [edge case context]
  **When** [edge case action]
  **Then** [expected handling]

### Error Handling

- **Given** [error condition]
  **When** [action attempted]
  **Then** [expected error response]

---

## Implementation Tasks

Tasks created separately (parentId -> this Story):
- [API-XX: Task Name](link) - Brief description
- [API-YY: Task Name](link) - Brief description

> [!NOTE]
> Order tasks Consumer -> Service -> Provider (API endpoint -> Service -> Repository -> Database). Consumer Tasks may mock provider layers until implemented.
> Test task is NOT created here - it will be added later by test planner after manual testing passes.

---

## Test Strategy

> [!NOTE]
> This section is intentionally **empty** at Story creation.
> Tests are planned later by **test planner** after manual testing passes (quality gate Pass 1).

*Test planning deferred to execution phase.*

---

## Technical Notes

### Architecture Considerations
- Which layers affected? (API, Service, Repository, Client)
- What patterns apply?
- Any constraints?

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| [name] | v[X.Y.Z] | [use case for Story domain] | [official docs URL] |

**Key APIs:**
- `[method_signature]` - [purpose and when to use]
- `[method_signature]` - [purpose and when to use]

**Key constraints:**
- [Constraint 1: e.g., no async support, memory limitations, multi-process caveats]
- [Constraint 2: e.g., compatibility requirements, deprecated features]

**Standards compliance:**
- [Standard/RFC]: [how Story complies - brief description, e.g., "RFC 6749 OAuth 2.0 - uses authorization code flow"]

> [!NOTE]
> This section populated by story coordinator during Library & Standards Research phase. Tasks reference these specifications in their Technical Approach sections.

### API Technical Aspects

> [!NOTE]
> Fill for Stories with API endpoints. Skip for internal/non-API Stories.

#### Rate Limiting
- **Policy:** [e.g., 100 requests/minute per API key, 1000/hour per user]
- **Strategy:** [Token bucket / Sliding window / Fixed window]
- **Headers:** [X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset]
- **429 Response:** [Retry-After header, error message format]

#### Authentication & Authorization
- **Auth pattern:** [Bearer token / API key / OAuth 2.0 flow]
- **Token management:** [Expiration, refresh strategy, revocation]
- **Authorization:** [RBAC / ABAC / Scope-based permissions]
- **Project-specific:** [Beyond RFC requirements specific to this project]

#### Error Handling Strategy
- **Error format:** [RFC 7807 Problem Details / Custom JSON schema]
- **Error codes:** [Business error codes taxonomy, HTTP status mapping]
- **Retry strategy:** [Which errors retryable, backoff parameters]
- **Circuit breaker:** [Failure thresholds, recovery timeout]

#### Logging & Observability
- **Log levels:** [DEBUG/INFO/WARN/ERROR usage guidelines]
- **Structured format:** [JSON fields: timestamp, level, service, correlation_id, message]
- **Audit trail:** [What events to track, retention policy]
- **Tracing:** [Correlation IDs, distributed tracing headers (X-Request-ID)]

### Integration Points
- **External Systems**: Which external APIs/services?
- **Internal Services**: Which app services interact?
- **Database**: Which tables/models involved?

### Performance & Security
- Response time targets
- Throughput requirements
- Security considerations

### Related Guides
- [Guide XX: Pattern Name](docs/guides/guide_XXX_pattern_name.md) - [when to use this pattern]
- [Guide YY: Pattern Name](docs/guides/guide_YYY_pattern_name.md) - [when to use this pattern]

> [!NOTE]
> Guide links inserted by story validator (auto-creates missing guides via best practices researcher, then links them here).

---

## Definition of Done

### Functionality
- [ ] All acceptance criteria met (main + edge cases + errors)
- [ ] Logging added appropriately

### Testing
- [ ] All implementation tasks completed
- [ ] Test task created and completed (by test planner)
- [ ] All tests passing

### Code Quality
- [ ] Code reviewed and approved
- [ ] Follows project patterns
- [ ] Performance meets requirements
- [ ] Documentation updated
- [ ] All affected existing code refactored (no backward compatibility / legacy code left)
- [ ] All existing tests updated and passing
- [ ] All affected existing documentation updated

---

## Dependencies

### Depends On
- **User Story:** [USXXX](link) - Description
- **External:** Third-party requirement

### Blocks
- **User Story:** [USXXX](link) - Description

---

## Template Placeholders

When copying this template to a project, replace these placeholders:

| Placeholder | Source | Example |
|-------------|--------|---------|
| `API` | docs/tasks/kanban_board.md | "API" |
| `docs` | Standard path | "docs" |

---

**Template Version:** 9.0.0 (Moved to shared/templates/, added placeholders, removed skill-specific references)
**Last Updated:** 2025-01-07
