# KOSMOS AEOS Development Container
# Multi-stage Dockerfile for GitHub Codespaces

FROM mcr.microsoft.com/devcontainers/python:1-3.11-bullseye

# Install system dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    build-essential \
    curl \
    git \
    libpq-dev \
    postgresql-client \
    redis-tools \
    jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest

# Install Python tools
RUN pip install --upgrade pip setuptools wheel \
    && pip install \
    poetry \
    black \
    isort \
    ruff \
    mypy \
    pytest \
    pytest-cov \
    pytest-asyncio \
    httpx

# Install global Node.js tools
RUN npm install -g \
    pnpm \
    typescript \
    tsx \
    turbo \
    @anthropic-ai/sdk \
    @modelcontextprotocol/sdk

# Create workspace directory
WORKDIR /workspaces

# Set Python path
ENV PYTHONPATH=/workspaces/kosmos/implementation/backend

# Default command
CMD ["sleep", "infinity"]
