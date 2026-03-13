# Testing Strategy

Universal testing philosophy and strategy for modern software projects: principles, organization, and best practices.

<!-- SCOPE: Universal testing philosophy (Risk-Based Testing, test pyramid, isolation patterns) -->
<!-- DO NOT add here: project structure, framework-specific patterns, CI/CD configuration, test tooling setup -->

## Quick Navigation

- **Tests Organization:** [tests/README.md](../../../tests/README.md) - Directory structure, running tests
- **Architecture:** [docs/project/architecture.md](../../project/architecture.md) - System design

---

## Core Philosophy

### Test YOUR Code, Not Frameworks

**Focus testing effort on YOUR business logic and integration usage.** Do not retest database constraints, ORM internals, framework validation, or third-party library mechanics.

**Rule of thumb:** If deleting your code wouldn't fail the test, you're testing someone else's code.

### Examples

| Verdict | Test Description | Rationale |
|---------|-----------------|-----------|
| GOOD | Custom validation logic raises exception for invalid input | Tests YOUR validation rules |
| GOOD | Repository query returns filtered results based on business criteria | Tests YOUR query construction |
| GOOD | API endpoint returns correct HTTP status for error scenarios | Tests YOUR error handling |
| BAD | Database enforces UNIQUE constraint on email column | Tests database, not your code |
| BAD | ORM model has correct column types and lengths | Tests ORM configuration, not logic |
| BAD | Framework validates request body matches schema | Tests framework validation |

---

## Risk-Based Testing Strategy

### Priority Matrix

**Automate only high-value scenarios** using Business Impact (1-5) x Probability (1-5).

| Priority Score | Action | Example Scenarios |
|----------------|--------|-------------------|
| >=15 | MUST test | Payment processing, authentication, data loss scenarios |
| 10-14 | Consider testing | Edge cases with moderate impact |
| <10 | Skip automated tests | Low-probability edge cases, framework behavior |

### Test Caps (per Story)

**Enforce caps to prevent test bloat:**

- **E2E:** 2-5 tests
- **Integration:** 3-8 tests
- **Unit:** 5-15 tests
- **Total:** 10-28 tests per Story

**Key principles:**
- **No minimum limits** - Can be 0 tests if no Priority >=15 scenarios exist
- **No test pyramids** - Test distribution based on risk, not arbitrary ratios
- **Every test must add value** - Each test should validate unique Priority >=15 scenario

---

## Story-Level Testing Pattern

### When to Write Tests

**Consolidate ALL tests in Story's final test task** AFTER implementation + manual verification.

| Task Type | Contains Tests? | Rationale |
|-----------|----------------|-----------|
| **Implementation Tasks** | NO tests | Focus on implementation only |
| **Final Test Task** | ALL tests | Complete Story coverage after manual verification |

### Benefits

1. **Complete context** - Tests written when all code implemented
2. **No duplication** - E2E covers integration paths, no need to retest same code
3. **Better prioritization** - Manual testing identifies Priority >=15 scenarios before automation
4. **Atomic delivery** - Story delivers working code + comprehensive tests together

---

## Test Levels

### E2E (End-to-End) Tests

**Definition:** Full system tests with real external services and complete data flow.

**Characteristics:**
- Real external APIs/services
- Real database
- Full request-response cycle
- Validates complete user journeys

**When to write:**
- Critical user workflows (authentication, payments, core features)
- Integration with external services
- Priority >=15 scenarios that span multiple systems

### Integration Tests

**Definition:** Tests multiple components together with real dependencies (database, cache, file system).

**Characteristics:**
- Real database/cache/file system
- Multiple components interact
- May mock external APIs
- Validates component integration

**When to write:**
- Database query behavior
- Service orchestration
- Component interaction
- API endpoint behavior (without external services)

### Unit Tests

**Definition:** Tests single component in isolation with mocked dependencies.

**Characteristics:**
- Fast execution (<1ms per test)
- No external dependencies
- Mocked collaborators
- Validates single responsibility

**When to write:**
- Business logic validation
- Complex calculations
- Error handling logic
- Custom transformations

---

## Isolation Patterns

### Pattern Comparison

| Pattern | Speed | Complexity | Best For |
|---------|-------|------------|----------|
| **Data Deletion** | Fastest | Simple | Default choice (90% of projects) |
| **Transaction Rollback** | Fast | Moderate | Transaction semantics testing |
| **Database Recreation** | Slow | Simple | Maximum isolation paranoia |

### Data Deletion (Default)

**How it works:**
1. Create schema once at test session start
2. Delete data after each test
3. Drop schema at test session end

**When to use:** Default choice for most projects

### Transaction Rollback

**How it works:**
1. Start transaction before each test
2. Run test code
3. Rollback transaction after test

**When to use:** Testing transaction behavior, savepoints, isolation levels

### Database Recreation

**How it works:**
1. Drop and recreate database before each test
2. Apply migrations
3. Run test

**When to use:** Paranoia about shared state, testing migrations

---

## What To Test vs NOT Test

### Test (GOOD)

**Test YOUR code and integration usage:**

| Category | Examples |
|----------|----------|
| **Business logic** | Validation rules, orchestration, error handling, computed properties |
| **Query construction** | Filters, joins, aggregations, pagination |
| **API behavior** | Request validation, response shape, HTTP status codes |
| **Custom validators** | Complex validation logic, transformations |
| **Integration smoke** | Database connectivity, basic CRUD, configuration |

### Avoid (BAD)

**Don't test framework internals and third-party libraries:**

| Category | Examples |
|----------|----------|
| **Database constraints** | UNIQUE, FOREIGN KEY, NOT NULL, CHECK constraints |
| **ORM internals** | Column types, table creation, metadata, relationships |
| **Framework validation** | Request body validation, dependency injection, routing |
| **Third-party libraries** | HTTP client behavior, serialization libraries, cryptography |

---

## Testing Patterns

### Arrange-Act-Assert

**Structure tests clearly:**

```
test_example:
    # ARRANGE: Set up test data and dependencies
    setup_data()
    mock_dependencies()

    # ACT: Execute code under test
    result = execute_operation()

    # ASSERT: Verify outcomes
    assert result == expected
    verify_side_effects()
```

### Mock at the Seam

**Mock at component boundaries, not internals:**

| Test Type | What to Mock | What to Use Real |
|-----------|--------------|------------------|
| **Unit tests** | External dependencies (repositories, APIs, file system) | Business logic |
| **Integration tests** | External APIs, slow services | Database, cache, your code |
| **E2E tests** | Nothing (or minimal external services) | Everything |

**Anti-pattern:** Over-mocking your own code defeats the purpose of integration tests.

### Test Data Builders

**Create readable test data:**

```
# Builder pattern for test data
user = build_user(
    email="test@example.com",
    role="admin",
    active=True
)

# Easy to create edge cases
inactive_user = build_user(active=False)
guest_user = build_user(role="guest")
```

---

## Common Issues

### Flaky Tests

**Symptom:** Tests pass/fail randomly without code changes

**Common causes:**
- Shared state between tests (global variables, cached data)
- Time-dependent logic (timestamps, delays)
- External service instability
- Improper cleanup between tests

**Solutions:**
- Isolate test data (per-test creation, cleanup)
- Mock time-dependent code
- Use test-specific configurations
- Implement proper teardown

### Slow Tests

**Symptom:** Test suite takes too long (>30s for 50 tests)

**Common causes:**
- Database recreation per test
- Running migrations per test
- No connection pooling
- Too many E2E tests

**Solutions:**
- Use Data Deletion pattern
- Run migrations once per session
- Optimize test data creation
- Balance test levels (more Unit, fewer E2E)

### Test Coupling

**Symptom:** Changing one component breaks many unrelated tests

**Common causes:**
- Tests depend on implementation details
- Shared test fixtures across unrelated tests
- Testing framework internals instead of behavior

**Solutions:**
- Test behavior, not implementation
- Use independent test data per test
- Focus on public APIs, not internal state

---

## Coverage Guidelines

### Targets

| Layer | Target | Priority |
|-------|--------|----------|
| **Critical business logic** | 100% branch coverage | HIGH |
| **Repositories/Data access** | 90%+ line coverage | HIGH |
| **API endpoints** | 80%+ line coverage | MEDIUM |
| **Utilities/Helpers** | 80%+ line coverage | MEDIUM |
| **Overall** | 80%+ line coverage | MEDIUM |

### What Coverage Means

**Coverage is a tool, not a goal:**
- High coverage + focused tests = good quality signal
- High coverage + meaningless tests = false confidence
- Low coverage = blind spots in testing

**Focus on:**
- Critical paths covered
- Edge cases tested
- Error handling validated

**Not on:**
- Arbitrary percentage targets
- Testing getters/setters
- Framework code

---

## Verification Checklist

### Strategy

- [ ] Risk-based selection (Priority >=15)
- [ ] Test caps enforced (E2E 2-5, Integration 3-8, Unit 5-15)
- [ ] Total 10-28 tests per Story
- [ ] Tests target YOUR code, not framework internals
- [ ] E2E smoke tests for critical integrations

### Organization

- [ ] Story-Level Test Task Pattern followed
- [ ] Tests consolidated in final Story task
- [ ] Test directory structure follows conventions

### Isolation

- [ ] Isolation pattern chosen (Data Deletion recommended)
- [ ] Each test creates own data
- [ ] Proper cleanup between tests
- [ ] No shared state between tests

### Quality

- [ ] Tests are order-independent
- [ ] Tests run fast (<10s for 50 integration tests)
- [ ] No flaky tests
- [ ] Coverage >=80% overall, 100% for critical logic
- [ ] Meaningful test names and descriptions

---

## Maintenance

**Update Triggers:**
- New testing patterns discovered
- Framework version changes affecting tests
- Significant changes to test architecture
- New isolation issues identified

**Verification:** Review this strategy when starting new projects or experiencing test quality issues.

**Last Updated:** 2026-02-10 - Initial universal testing strategy
