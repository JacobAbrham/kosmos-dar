# KOSMOS DAR Development Workflow

**Purpose:** Daily development workflow linking to ACTION_PLAN.md and Solo Developer Guide.

**Last Updated:** January 2026  
**Version:** 1.0

---

## Overview

This document describes the daily development workflow for KOSMOS DAR, integrating the Solo Developer Guide patterns with ACTION_PLAN.md implementation phases.

---

## Daily Workflow

### Morning (2 hours)

**1. Review Overnight Work**
```bash
# Run morning review script
./scripts/morning_review.sh
```

- Review completed async agent outputs
- Validate and merge completed work
- Check for errors or issues

**2. Plan Day's Tasks**
- Review ACTION_PLAN.md for current phase tasks
- Check SOLO_DEVELOPER_CHECKLIST.md for pending items
- Generate daily task list
- Prioritize by dependencies and complexity

**3. Create Specifications**
- For complex features, create specs in `specs/` directory
- Use templates: `specs/template-feature.md`, `specs/template-api.md`
- Validate specs: `python scripts/validate_spec.py specs/my-feature.md --checklist`

**4. Update Context**
- Review `.memory.md` for recent learnings
- Check `CLAUDE.md` for architecture decisions
- Update context files with overnight discoveries

---

### Midday (4 hours)

**1. Active Development**
- Use Cursor Pro for fast iteration
- Follow Director Model pattern:
  - Human approves architecture
  - AI implements from spec
  - Human reviews at checkpoints

**2. Implement Features**
- Follow ACTION_PLAN.md phases
- Use spec-driven development
- Implement with tests
- Follow coding standards (`.cursorrules`)

**3. Delegate Async Tasks**
- Queue complex tasks: `python scripts/task_queue.py add "Task title" "Description" --priority high`
- Agents process tasks asynchronously
- Monitor task queue: `python scripts/task_queue.py list`

**4. Iterate with AI**
- Use AI pair programming for implementation
- Request code reviews at checkpoints
- Integrate feedback and continue

---

### Afternoon (2 hours)

**1. Integration Testing**
- Run test suite: `pytest implementation/backend/tests/`
- Fix any issues found
- Update tests as needed

**2. Documentation Review**
- Review AI-generated documentation
- Update API docs if needed
- Update architecture docs for changes

**3. Update Context Files**
```bash
# Extract learnings from code changes
python scripts/update_context.py --code-dir implementation --learnings "Learning 1" "Learning 2"
```

- Update `.memory.md` with patterns discovered
- Update `CLAUDE.md` with architecture changes
- Document decisions made

**4. Queue Overnight Tasks**
- Add tasks to queue for async processing
- Set priorities and dependencies
- Agents will process overnight

---

## Weekly Workflow

### Monday: Planning & Architecture
- Review ACTION_PLAN.md for week's goals
- Create specifications for week's features
- Approve architecture decisions
- Set priorities

### Tuesday-Thursday: Implementation
- Active development following daily workflow
- Implement features from specs
- Review and merge completed work
- Update progress in ACTION_PLAN_CHECKLIST.md

### Friday: Review & Integration
- Review week's progress
- Run full test suite
- Update documentation
- Plan next week's work

---

## Integration with ACTION_PLAN.md

### Phase 1: Foundation (Weeks 1-2)
**Daily Tasks:**
- Implement authentication system
- Set up CI/CD pipeline
- Create database migrations
- Implement basic audit logging

**Workflow:**
1. Create spec for each feature
2. Human approves architecture
3. AI implements from spec
4. Human reviews at checkpoints
5. Deploy to staging

### Phase 2: Core Features (Weeks 3-4)
**Daily Tasks:**
- Implement agent orchestration
- Add MCP server integrations
- Build frontend components
- Add real-time updates

**Workflow:**
1. Queue complex features for async processing
2. Implement simpler features directly
3. Review and integrate async work
4. Test and deploy

### Phase 3: Advanced Features (Weeks 5+)
**Daily Tasks:**
- Implement advanced agent capabilities
- Add governance features
- Build workflow builder UI
- Optimize performance

**Workflow:**
1. Create detailed specs for complex features
2. Break into smaller tasks
3. Queue for async processing
4. Review and integrate incrementally

---

## Director Model Integration

### Approval Gates

**Automatic (<$50):**
- AI proceeds without approval
- Logged for review

**Human Approval ($50-$100):**
- AI requests approval
- Human reviews and approves/rejects
- AI proceeds based on decision

**Pentarchy Vote (>$100):**
- AI requests Pentarchy vote
- 5 agents vote
- Human can override
- AI proceeds based on vote

### Checkpoints

**Specification Checkpoint:**
- After generating spec
- Human reviews and approves
- AI proceeds to implementation

**Architecture Checkpoint:**
- Before implementing architecture
- Human approves architecture
- AI implements

**Code Review Checkpoint:**
- After major feature
- Human reviews code
- AI integrates feedback

**Cost Approval Checkpoint:**
- Before high-cost operation
- Human approves or rejects
- AI executes if approved

---

## Tools and Scripts

### Morning Review
```bash
./scripts/morning_review.sh
```
- Reviews overnight work
- Validates completed tasks
- Generates daily task list

### Task Queue
```bash
# Add task
python scripts/task_queue.py add "Task title" "Description" --priority high

# List tasks
python scripts/task_queue.py list

# Get next task
python scripts/task_queue.py next

# Update status
python scripts/task_queue.py update <task-id> completed
```

### Spec Validation
```bash
# Validate spec
python scripts/validate_spec.py specs/my-feature.md

# Generate checklist
python scripts/validate_spec.py specs/my-feature.md --checklist

# Generate PR template
python scripts/validate_spec.py specs/my-feature.md --pr-template --output .github/pull_request_template.md
```

### Context Update
```bash
# Update context files
python scripts/update_context.py --code-dir implementation --learnings "Learning 1" "Learning 2" --arch-changes "Change 1"
```

---

## Best Practices

### For Daily Development

1. **Start with Specs**: Always create specs for complex features
2. **Use Director Model**: Human approves, AI implements
3. **Review Early**: Review specs before implementation
4. **Test Continuously**: Run tests frequently
5. **Update Context**: Keep context files current

### For Async Tasks

1. **Queue Complex Tasks**: Use task queue for long-running tasks
2. **Set Dependencies**: Define task dependencies
3. **Monitor Progress**: Check task queue regularly
4. **Review Outputs**: Review async work before merging

### For Context Management

1. **Update Daily**: Update `.memory.md` daily
2. **Document Decisions**: Document architecture decisions in `CLAUDE.md`
3. **Extract Patterns**: Use `update_context.py` to extract patterns
4. **Keep Current**: Keep context files synchronized

---

## Related Documentation

- **ACTION_PLAN.md**: Implementation phases and tasks
- **SOLO_DEVELOPER_CHECKLIST.md**: Progress tracking
- **DIRECTOR_MODEL.md**: Human-AI collaboration pattern
- **CLAUDE.md**: Architecture and patterns
- **.cursorrules**: Development guidelines
- **.memory.md**: Session learnings

---

## Success Metrics

- **Spec Coverage**: 100% of complex features have specs
- **Test Coverage**: >70% (Phase 1), >80% (Phase 2+)
- **Context Freshness**: Context files updated daily
- **Task Completion**: 80%+ of queued tasks completed
- **Code Quality**: All code follows style guidelines

---

**Remember:** The daily workflow maximizes AI productivity while maintaining human control. Use approval gates liberally, especially for high-cost or high-risk operations.
