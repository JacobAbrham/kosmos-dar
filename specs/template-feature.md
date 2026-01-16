# Feature Specification Template

**Feature Name:** [Feature Name]  
**Created:** [Date]  
**Status:** Draft | Review | Approved | Implemented  
**Related ACTION_PLAN.md Tasks:** [Task references]

---

## Overview

### Description
[Brief description of the feature and its purpose]

### Goals
- [ ] Goal 1
- [ ] Goal 2
- [ ] Goal 3

### Non-Goals
- [What this feature explicitly does NOT include]

---

## User Stories

### As a [user type], I want to [action] so that [benefit]

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

---

## Technical Design

### Architecture
[High-level architecture description and diagrams]

### Components
- **Component 1:** [Description]
- **Component 2:** [Description]

### Data Models
```python
# Example data model
class FeatureModel(BaseModel):
    field1: str
    field2: int
```

### API Endpoints
- `POST /api/feature/action` - [Description]
- `GET /api/feature/{id}` - [Description]

### Database Changes
- [ ] Migration: [Description]
- [ ] Schema changes: [Description]
- [ ] Indexes: [Description]

---

## Implementation Plan

### Phase 1: [Phase Name]
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Phase 2: [Phase Name]
- [ ] Task 1
- [ ] Task 2

---

## Testing Strategy

### Unit Tests
- [ ] Test case 1
- [ ] Test case 2

### Integration Tests
- [ ] Test scenario 1
- [ ] Test scenario 2

### E2E Tests
- [ ] User flow 1
- [ ] User flow 2

---

## Security Considerations

- [ ] Authentication required: Yes/No
- [ ] Authorization checks: [Description]
- [ ] Input validation: [Description]
- [ ] Rate limiting: [Description]
- [ ] Audit logging: [Description]

---

## Performance Requirements

- **Response Time:** < [X]ms (p95)
- **Throughput:** [X] requests/second
- **Caching:** [Strategy]
- **Database Queries:** [Optimization notes]

---

## Cost Impact

- **LLM Usage:** [Estimated tokens/cost]
- **Infrastructure:** [Estimated cost]
- **Development Time:** [Estimated hours]

---

## Dependencies

### Internal
- [ ] Dependency 1
- [ ] Dependency 2

### External
- [ ] External service/API
- [ ] MCP server integration

---

## Rollout Plan

### Phase 1: Development
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Code review approved

### Phase 2: Staging
- [ ] Deployed to staging
- [ ] QA testing complete
- [ ] Performance validated

### Phase 3: Production
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] Documentation updated

---

## Success Metrics

- **Metric 1:** [Target value]
- **Metric 2:** [Target value]
- **Metric 3:** [Target value]

---

## Open Questions

- [ ] Question 1
- [ ] Question 2

---

## References

- [Related documentation]
- [Related issues/PRs]
- [Related ACTION_PLAN.md tasks]

---

**Last Updated:** [Date]  
**Updated By:** [Name]
