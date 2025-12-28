---
sidebar_position: 6
title: Contributing
description: Guidelines for contributing to KOSMOS V2.0
---

# Contributing to KOSMOS

Thank you for your interest in contributing to KOSMOS V2.0! This guide will help you get started.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and constructive in discussions
- Focus on what is best for the project
- Accept constructive criticism gracefully
- Report unacceptable behavior to the maintainers

## How to Contribute

### Reporting Issues

Before creating an issue, please:

1. Search existing issues to avoid duplicates
2. Use the appropriate issue template
3. Include reproduction steps for bugs
4. Provide system information when relevant

```markdown
## Bug Report

**Description**: Brief description of the bug

**Steps to Reproduce**:
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happens

**Environment**:
- OS: [e.g., Ubuntu 22.04]
- Node: [e.g., 20.10.0]
- Python: [e.g., 3.11.5]
```

### Feature Requests

For new features:

1. Check if it aligns with KOSMOS goals
2. Describe the use case clearly
3. Propose a solution if possible
4. Be open to discussion and alternatives

### Pull Requests

#### 1. Fork and Clone

```bash
# Fork via GitHub UI, then:
git clone https://github.com/YOUR_USERNAME/kosmos-dar.git
cd kosmos-dar
git remote add upstream https://github.com/nuvanta-holding/kosmos-dar.git
```

#### 2. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

#### 3. Make Changes

Follow our coding standards (see below).

#### 4. Test Your Changes

```bash
# Backend tests
cd implementation/backend
pytest tests/ -v

# Frontend tests
cd implementation/frontend
npm test

# Lint checks
ruff check .
npm run lint
```

#### 5. Commit with Conventional Commits

```bash
git commit -m "feat(agents): add new capability to Hermes"
```

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `chore` | Maintenance, deps |
| `ci` | CI/CD changes |

#### 6. Push and Create PR

```bash
git push -u origin feature/your-feature-name
# Then create PR via GitHub
```

## Coding Standards

### Python (Backend/Agents)

```python
# Use type hints
def process_message(message: str, context: dict) -> AgentResponse:
    """Process an incoming message.

    Args:
        message: The user's message
        context: Conversation context

    Returns:
        AgentResponse with result and metadata
    """
    pass

# Use dataclasses or Pydantic
from pydantic import BaseModel

class AgentConfig(BaseModel):
    name: str
    model: str = "gpt-4"
    temperature: float = 0.7

# Async by default
async def fetch_data(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.json()
```

**Tools**:
- Formatter: `black`
- Linter: `ruff`
- Type checker: `mypy`

### TypeScript (Frontend/MCP)

```typescript
// Use TypeScript strictly
interface ConversationProps {
  id: string;
  messages: Message[];
  onSend: (message: string) => Promise<void>;
}

// Functional components with hooks
export function Conversation({ id, messages, onSend }: ConversationProps) {
  const [input, setInput] = useState('');

  const handleSubmit = async () => {
    await onSend(input);
    setInput('');
  };

  return (
    <div className="conversation">
      {/* ... */}
    </div>
  );
}

// Use async/await, not callbacks
async function fetchConversation(id: string): Promise<Conversation> {
  const response = await fetch(`/api/conversations/${id}`);
  return response.json();
}
```

**Tools**:
- Formatter: `prettier`
- Linter: `eslint`
- Type checker: TypeScript strict mode

### SQL (Migrations)

```sql
-- Use lowercase for keywords (optional but consistent)
-- Include comments for complex logic
-- Use explicit column names, not SELECT *

-- Good
SELECT
    c.id,
    c.title,
    c.created_at,
    u.name AS user_name
FROM conversations c
JOIN users u ON u.id = c.user_id
WHERE c.is_active = true
ORDER BY c.created_at DESC;

-- Migrations should be reversible
-- Up migration
ALTER TABLE conversations ADD COLUMN metadata JSONB DEFAULT '{}';

-- Down migration
ALTER TABLE conversations DROP COLUMN metadata;
```

## Project Structure

```
kosmos-dar/
├── implementation/
│   ├── backend/
│   │   ├── agents/          # One folder per agent
│   │   │   ├── zeus/
│   │   │   ├── hermes/
│   │   │   └── ...
│   │   ├── api/             # FastAPI routes
│   │   ├── core/            # Shared utilities
│   │   ├── models/          # Database models
│   │   └── services/        # Business logic
│   ├── frontend/
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   └── stores/          # State management
│   └── mcp-servers/
│       └── src/servers/     # MCP implementations
├── docs-site/               # Documentation (Docusaurus)
├── scripts/                 # Automation scripts
└── k8s/                     # Kubernetes manifests
```

## Adding New Features

### Adding a New Agent

1. Create agent folder: `backend/agents/new_agent/`
2. Implement agent class:

```python
# backend/agents/new_agent/agent.py
from kosmos.agents import BaseAgent, AgentCapability

class NewAgent(BaseAgent):
    """Description of what this agent does."""

    name = "new_agent"
    capabilities = [
        AgentCapability.SOME_CAPABILITY,
    ]

    async def process(self, message: str, context: dict) -> AgentResponse:
        # Implementation
        pass
```

3. Register in agent registry
4. Add tests in `tests/agents/test_new_agent.py`
5. Update documentation

### Adding an MCP Server

1. Create server file: `mcp-servers/src/servers/new-server.ts`
2. Implement tools:

```typescript
// mcp-servers/src/servers/new-server.ts
import { MCPServer, Tool } from '../core/mcp';

export class NewServer extends MCPServer {
  name = 'new-server';
  description = 'Description of what this server does';

  tools: Tool[] = [
    {
      name: 'tool_name',
      description: 'What this tool does',
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string', description: 'Parameter description' },
        },
        required: ['param'],
      },
      handler: async (input) => {
        // Implementation
        return { result: 'success' };
      },
    },
  ];
}
```

3. Register in server index
4. Add tests
5. Documentation auto-generates from code

## Review Process

1. **Automated Checks**: CI runs tests, linting, type checking
2. **Code Review**: At least one maintainer approval required
3. **Documentation**: Update docs if needed
4. **Changelog**: Add entry for user-facing changes

## Getting Help

- **Questions**: Open a Discussion on GitHub
- **Bugs**: Open an Issue
- **Security**: Email security@nuvanta-holding.com (don't open public issue)

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Annual contributor highlights

Thank you for contributing to KOSMOS!
