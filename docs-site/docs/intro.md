---
sidebar_position: 1
slug: /
title: Welcome to KOSMOS V2.0
---

# KOSMOS V2.0 Documentation

**AI-Native Enterprise Operating System**

---

## Overview

KOSMOS (Knowledge-Orchestrated System for Multi-agent Operational Superintelligence) is an AI-native enterprise platform featuring **11 specialized agents**, **88 MCP servers**, and **Pentarchy governance**.

**Core Philosophy:** *"Agents Work. Humans Approve."*

## Key Features

| Feature | Description |
|---------|-------------|
| **11 Specialized Agents** | Zeus, Hermes, AEGIS, Chronos, Athena, Hephaestus, Nur PROMETHEUS, Iris, MEMORIX, Hestia, Morpheus |
| **88 MCP Servers** | Comprehensive tool integration across 9 domains |
| **Pentarchy Governance** | 3-agent voting for decisions $50-$100 |
| **Security Veto** | AEGIS can block any decision |
| **Multi-tenant** | Row-Level Security for tenant isolation |

## Quick Navigation

<div className="row">
  <div className="col col--4">
    <div className="card">
      <div className="card__header">
        <h3>Getting Started</h3>
      </div>
      <div className="card__body">
        <p>Installation, quick start, and configuration guides.</p>
      </div>
      <div className="card__footer">
        <a className="button button--primary button--block" href="/docs/01-getting-started/">Start Here</a>
      </div>
    </div>
  </div>
  <div className="col col--4">
    <div className="card">
      <div className="card__header">
        <h3>Architecture</h3>
      </div>
      <div className="card__body">
        <p>System design, governance, and technical architecture.</p>
      </div>
      <div className="card__footer">
        <a className="button button--secondary button--block" href="/docs/02-architecture/">Learn More</a>
      </div>
    </div>
  </div>
  <div className="col col--4">
    <div className="card">
      <div className="card__header">
        <h3>Agents</h3>
      </div>
      <div className="card__body">
        <p>11 specialized AI agents that power KOSMOS.</p>
      </div>
      <div className="card__footer">
        <a className="button button--secondary button--block" href="/docs/agents/">Explore Agents</a>
      </div>
    </div>
  </div>
</div>

## The 11 Agents

| Agent | Domain | Role |
|-------|--------|------|
| **Zeus** | Orchestration | Master orchestrator, routes requests |
| **Hermes** | Data | Fetch, transform, and deliver data |
| **AEGIS** | Security | Authentication, authorization, veto power |
| **Athena** | Analytics | Insights, RAG, knowledge base (Pentarchy) |
| **Chronos** | Scheduling | Calendar, time management, reminders |
| **Hephaestus** | Development | Code generation, DevOps (Pentarchy) |
| **Nur PROMETHEUS** | Finance | Cost estimation, budgeting (Pentarchy) |
| **Iris** | Communication | Notifications, messaging |
| **MEMORIX** | Memory | Knowledge management, context |
| **Hestia** | Operations | Monitoring, health checks |
| **Morpheus** | Prediction | Forecasting, ML inference |

## Documentation Structure

This documentation is organized into sections:

1. **[Getting Started](/docs/01-getting-started/)** - Installation and setup (manual)
2. **[Architecture](/docs/02-architecture/)** - System design and governance (manual)
3. **[Agents](/docs/agents/)** - 11 agent documentation (auto-generated)
4. **[API Reference](/docs/04-api/)** - REST API endpoints (auto-generated from FastAPI)
5. **[MCP Servers](/docs/05-mcp-servers/)** - 88 MCP servers (auto-generated)
6. **[Frontend](/docs/06-frontend/)** - React components (auto-generated)
7. **[Database](/docs/07-database/)** - Schema documentation (auto-generated)
8. **[Configuration](/docs/08-configuration/)** - Environment variables (auto-generated)
9. **[Governance](/docs/09-governance/)** - Gap analysis, roadmap, contributing (manual)

:::info Auto-Generated Documentation

Sections 3-8 are **automatically generated** from the codebase on every commit. This ensures documentation stays in sync with the implementation.

:::

## Quick Start

```bash
# Clone the repository
git clone https://github.com/nuvanta-holding/kosmos-dar.git
cd kosmos-dar

# Start with Docker
cd implementation
cp .env.example .env
docker-compose up -d
```

See the [Getting Started](/docs/01-getting-started/) guide for detailed instructions.

---

**Version:** 2.0.0-alpha
**Last Updated:** December 2025
**Copyright:** © 2025 Nuvanta Holding. All Rights Reserved.
