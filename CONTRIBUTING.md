# Contributing to KOSMOS

Thank you for your interest in contributing to KOSMOS! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the maintainers.

## Getting Started

### Prerequisites

- Node.js 20+ LTS
- Python 3.11+
- Docker Desktop (with WSL 2 backend on Windows)
- Git 2.x+

### Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/kosmos-dar.git
   cd kosmos-dar
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/JacobAbrham/kosmos-dar.git
   ```

4. **Set up environment**:
   ```bash
   cp .env.example .env
   cp implementation/frontend/.env.example implementation/frontend/.env.local
   cp implementation/backend/.env.example implementation/backend/.env
   ```

5. **Start development**:
   ```bash
   # Using Docker (recommended)
   docker compose up -d
   
   # Or locally
   cd implementation/frontend && npm install && npm run dev
   ```

## Development Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `staging` | Pre-production testing |
| `develop` | Integration branch |
| `feature/*` | New features |
| `bugfix/*` | Bug fixes |
| `hotfix/*` | Urgent production fixes |

### Creating a Feature Branch

```bash
# Sync with upstream
git fetch upstream
git checkout develop
git merge upstream/develop

# Create feature branch
git checkout -b feature/your-feature-name
```

### Running Tests

```bash
# Frontend tests
cd implementation/frontend
npm run test
npm run test:e2e

# Backend tests
cd implementation/backend
pytest

# Linting
npm run lint
ruff check .
```

## Pull Request Process

1. **Update your branch** with the latest upstream changes
2. **Run all tests** and ensure they pass
3. **Update documentation** if needed
4. **Create a Pull Request** with:
   - Clear title describing the change
   - Description of what and why
   - Link to related issues
   - Screenshots for UI changes

### PR Requirements

- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Reviewed by at least one maintainer

## Coding Standards

### Frontend (TypeScript/React)

- Use functional components with hooks
- Follow React best practices
- Use TypeScript strict mode
- Use Tailwind CSS for styling
- Follow the existing component patterns

### Backend (Python)

- Follow PEP 8 style guide
- Use type hints
- Use async/await for I/O operations
- Write docstrings for public functions
- Keep functions small and focused

### General

- Write meaningful comments for complex logic
- Keep files focused and modular
- Prefer composition over inheritance
- Write tests for new features

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(agents): add Apollo analytics agent

fix(frontend): resolve WebSocket reconnection issue

docs(readme): update installation instructions
```

## Questions?

If you have questions, please:
1. Check existing issues and documentation
2. Open a new issue with the `question` label
3. Join our community discussions

Thank you for contributing! 🚀
