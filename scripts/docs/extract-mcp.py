#!/usr/bin/env python3
"""
Extract MCP server documentation from source code and configuration.

This script:
1. Parses TypeScript MCP server source files
2. Extracts tool definitions, descriptions, and parameters
3. Generates Markdown documentation for each MCP domain
4. Writes to docs-site/docs/05-mcp-servers/
"""

import json
import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
MCP_SERVERS_DIR = PROJECT_ROOT / "implementation" / "mcp-servers"
DOCS_OUTPUT = PROJECT_ROOT / "docs-site" / "docs" / "05-mcp-servers"


@dataclass
class MCPTool:
    """Information about an MCP tool."""
    name: str
    description: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    required: List[str] = field(default_factory=list)


@dataclass
class MCPServer:
    """Information about an MCP server."""
    name: str
    version: str
    description: str
    source_path: Optional[str]
    tools: List[MCPTool] = field(default_factory=list)
    implemented: bool = False


# MCP domains and their servers (88 total across 9 domains)
MCP_DOMAINS = {
    "database": {
        "name": "Database & Storage",
        "icon": "database",
        "servers": [
            "mcp-postgresql", "mcp-vector", "mcp-redis", "mcp-minio",
            "mcp-elasticsearch", "mcp-neo4j", "mcp-timescale", "mcp-duckdb",
            "mcp-sqlite", "mcp-mongodb", "mcp-qdrant", "mcp-weaviate"
        ]
    },
    "ai-llm": {
        "name": "AI & Reasoning",
        "icon": "brain",
        "servers": [
            "mcp-litellm", "mcp-langfuse", "sequential-thinking", "memory-server",
            "context7-mcp", "mcp-anthropic", "mcp-openai", "mcp-huggingface",
            "mcp-ollama", "mcp-embeddings", "prompt-armor", "mcp-guardrails",
            "mcp-haystack", "mcp-llama-index", "mcp-ragas"
        ]
    },
    "productivity": {
        "name": "Productivity & Communication",
        "icon": "mail",
        "servers": [
            "mcp-gmail", "mcp-outlook", "mcp-slack", "mcp-teams", "mcp-discord",
            "mcp-google-calendar", "mcp-notion", "mcp-confluence", "mcp-jira",
            "mcp-linear", "mcp-asana", "mcp-zoom", "mcp-google-meet",
            "mcp-figma", "mcp-miro"
        ]
    },
    "development": {
        "name": "DevOps & Infrastructure",
        "icon": "code",
        "servers": [
            "mcp-github", "mcp-gitlab", "mcp-docker", "mcp-kubernetes",
            "mcp-terraform", "mcp-ansible", "mcp-argocd", "mcp-prometheus",
            "mcp-grafana", "mcp-datadog", "mcp-pagerduty", "mcp-opsgenie", "mcp-nats"
        ]
    },
    "security": {
        "name": "Security",
        "icon": "shield",
        "servers": [
            "mcp-zitadel", "mcp-infisical", "mcp-falco", "mcp-trivy",
            "mcp-snyk", "mcp-vault", "mcp-kyverno", "mcp-opa",
            "mcp-crowdstrike", "mcp-splunk"
        ]
    },
    "finance": {
        "name": "Finance & Analytics",
        "icon": "dollar-sign",
        "servers": [
            "mcp-quickbooks", "mcp-xero", "mcp-stripe", "mcp-plaid",
            "mcp-alpaca", "mcp-polygon"
        ]
    },
    "cloud": {
        "name": "Cloud Providers",
        "icon": "cloud",
        "servers": [
            "mcp-aws", "mcp-azure", "mcp-gcp", "mcp-alicloud",
            "mcp-cloudflare", "mcp-vercel"
        ]
    },
    "data": {
        "name": "Data & ETL",
        "icon": "database",
        "servers": [
            "mcp-airbyte", "mcp-prefect", "mcp-dagster", "mcp-dbt",
            "mcp-fivetran", "mcp-stitch"
        ]
    },
    "kosmos": {
        "name": "KOSMOS Native",
        "icon": "star",
        "servers": [
            "kosmos-tools", "kosmos-governance", "kosmos-memory",
            "kosmos-analytics", "kosmos-scheduler"
        ]
    }
}


def parse_typescript_mcp(source_path: Path) -> Optional[MCPServer]:
    """Parse a TypeScript MCP server source file."""
    if not source_path.exists():
        return None

    with open(source_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract server metadata
    server_name = source_path.parent.parent.name
    version = "1.0.0"

    # Try to extract from Server constructor
    server_match = re.search(r'new Server\(\s*\{\s*name:\s*["\']([^"\']+)["\'],?\s*version:\s*["\']([^"\']+)["\']', content)
    if server_match:
        server_name = server_match.group(1)
        version = server_match.group(2)

    # Extract description from file header
    desc_match = re.search(r'/\*\*\s*\n\s*\*\s*(.+?)\n', content)
    description = desc_match.group(1).strip() if desc_match else f"MCP Server: {server_name}"

    # Extract tools from TOOLS array
    tools = []
    tools_match = re.search(r'const TOOLS:\s*Tool\[\]\s*=\s*\[([\s\S]*?)\];', content)

    if tools_match:
        tools_content = tools_match.group(1)

        # Parse individual tool objects
        tool_pattern = r'\{\s*name:\s*["\']([^"\']+)["\'],\s*description:\s*["\']([^"\']+)["\'],?\s*inputSchema:\s*(\{[\s\S]*?\}),?\s*\}'
        for match in re.finditer(tool_pattern, tools_content):
            tool_name = match.group(1)
            tool_desc = match.group(2)
            schema_str = match.group(3)

            # Parse input schema for parameters
            params = {}
            required = []

            props_match = re.search(r'properties:\s*\{([\s\S]*?)\}', schema_str)
            if props_match:
                props_content = props_match.group(1)
                # Simple property extraction
                prop_pattern = r'(\w+):\s*\{\s*type:\s*["\'](\w+)["\'](?:,\s*description:\s*["\']([^"\']*)["\'])?'
                for prop_match in re.finditer(prop_pattern, props_content):
                    prop_name = prop_match.group(1)
                    prop_type = prop_match.group(2)
                    prop_desc = prop_match.group(3) or ""
                    params[prop_name] = {"type": prop_type, "description": prop_desc}

            req_match = re.search(r'required:\s*\[([\s\S]*?)\]', schema_str)
            if req_match:
                required = re.findall(r'["\'](\w+)["\']', req_match.group(1))

            tools.append(MCPTool(
                name=tool_name,
                description=tool_desc,
                parameters=params,
                required=required
            ))

    return MCPServer(
        name=server_name,
        version=version,
        description=description,
        source_path=str(source_path.relative_to(PROJECT_ROOT)),
        tools=tools,
        implemented=True
    )


def discover_implemented_servers() -> Dict[str, MCPServer]:
    """Discover implemented MCP servers from the source directory."""
    servers = {}

    if not MCP_SERVERS_DIR.exists():
        return servers

    for server_dir in MCP_SERVERS_DIR.iterdir():
        if not server_dir.is_dir():
            continue

        # Check for TypeScript source
        ts_source = server_dir / "src" / "index.ts"
        if ts_source.exists():
            server = parse_typescript_mcp(ts_source)
            if server:
                servers[server_dir.name] = server

    return servers


def generate_domain_doc(domain_key: str, domain_info: Dict, implemented: Dict[str, MCPServer]) -> str:
    """Generate Markdown documentation for an MCP domain."""
    servers = domain_info["servers"]
    server_count = len(servers)

    # Count implemented servers
    impl_count = sum(1 for s in servers if s in implemented)

    doc = f"""---
sidebar_position: {list(MCP_DOMAINS.keys()).index(domain_key) + 2}
title: {domain_info['name']}
description: {server_count} MCP servers for {domain_info['name'].lower()} operations
---

# {domain_info['name']} MCP Servers

{server_count} MCP servers in this domain ({impl_count} implemented).

:::info Auto-Generated
This documentation is automatically extracted from MCP server source code.
:::

## Server Registry

| Server | Status | Tools | Description |
|--------|--------|-------|-------------|
"""

    for server_name in servers:
        if server_name in implemented:
            server = implemented[server_name]
            tool_count = len(server.tools)
            status = "[check]Implemented[/check]"
            desc = server.description[:50] + "..." if len(server.description) > 50 else server.description
        else:
            tool_count = "-"
            status = "[planned]Planned[/planned]"
            desc = "Not yet implemented"

        doc += f"| `{server_name}` | {status} | {tool_count} | {desc} |\n"

    doc += "\n"

    # Add detailed docs for implemented servers
    for server_name in servers:
        if server_name in implemented:
            server = implemented[server_name]
            doc += f"## {server.name}\n\n"
            doc += f"{server.description}\n\n"
            doc += f"**Version:** {server.version}  \n"
            doc += f"**Source:** `{server.source_path}`\n\n"

            if server.tools:
                doc += "### Tools\n\n"

                for tool in server.tools:
                    doc += f"#### `{tool.name}`\n\n"
                    doc += f"{tool.description}\n\n"

                    if tool.parameters:
                        doc += "**Parameters:**\n\n"
                        doc += "| Name | Type | Required | Description |\n"
                        doc += "|------|------|----------|-------------|\n"

                        for param_name, param_info in tool.parameters.items():
                            required = "Yes" if param_name in tool.required else "No"
                            param_type = param_info.get("type", "any")
                            param_desc = param_info.get("description", "")
                            doc += f"| `{param_name}` | `{param_type}` | {required} | {param_desc} |\n"

                        doc += "\n"

    # Add example usage
    if servers:
        example_server = servers[0]
        doc += f"""## Example Usage

```python
# Using {example_server}
result = await agent.call_mcp(
    server="{example_server}",
    tool="example_tool",
    params={{"key": "value"}}
)
```

"""

    return doc


def generate_overview_doc(implemented: Dict[str, MCPServer]) -> str:
    """Generate the MCP overview document."""
    total_servers = sum(len(d["servers"]) for d in MCP_DOMAINS.values())
    total_implemented = len(implemented)
    total_tools = sum(len(s.tools) for s in implemented.values())

    doc = f"""---
sidebar_position: 1
title: MCP Servers Overview
description: 88 Model Context Protocol servers powering KOSMOS capabilities
---

# MCP Servers Overview

KOSMOS integrates **{total_servers} MCP servers** across **{len(MCP_DOMAINS)} domains** to provide comprehensive tool access for AI agents.

## Statistics

| Metric | Count |
|--------|-------|
| Total MCP Servers | {total_servers} |
| Implemented | {total_implemented} |
| Total Tools | {total_tools} |
| Domains | {len(MCP_DOMAINS)} |

## Domain Summary

| Domain | Servers | Implemented | Status |
|--------|---------|-------------|--------|
"""

    for domain_key, domain_info in MCP_DOMAINS.items():
        servers = domain_info["servers"]
        impl = sum(1 for s in servers if s in implemented)
        status = "Active" if impl > 0 else "Planned"
        doc += f"| [{domain_info['name']}](./{domain_key}) | {len(servers)} | {impl} | {status} |\n"

    doc += """

## Architecture

```mermaid
graph LR
    subgraph Agents
        Zeus[Zeus]
        Athena[Athena]
        Hephaestus[Hephaestus]
    end

    subgraph MCP Hub
        Hub[MCP Router]
    end

    subgraph MCP Servers
        DB[Database MCPs]
        AI[AI & LLM MCPs]
        Dev[DevOps MCPs]
        Prod[Productivity MCPs]
    end

    Zeus --> Hub
    Athena --> Hub
    Hephaestus --> Hub
    Hub --> DB
    Hub --> AI
    Hub --> Dev
    Hub --> Prod
```

## Tool Calling

Agents call MCP tools through a unified interface:

```python
class BaseAgent:
    async def call_mcp(
        self,
        server: str,
        tool: str,
        params: Dict[str, Any]
    ) -> Any:
        '''Call an MCP server tool.'''
        return await self.mcp_clients[server].call_tool(tool, params)
```

See individual domain pages for specific tool documentation.
"""

    return doc


def main():
    print("=" * 60)
    print("KOSMOS MCP Server Documentation Extractor")
    print("=" * 60)
    print(f"\nSource: {MCP_SERVERS_DIR}")
    print(f"Output: {DOCS_OUTPUT}\n")

    # Ensure output directory exists
    DOCS_OUTPUT.mkdir(parents=True, exist_ok=True)

    # Discover implemented servers
    implemented = discover_implemented_servers()
    print(f"Found {len(implemented)} implemented MCP servers\n")

    for name, server in implemented.items():
        print(f"   [OK] {name}: {len(server.tools)} tools")

    # Generate overview document
    overview_doc = generate_overview_doc(implemented)
    overview_file = DOCS_OUTPUT / "index.md"
    with open(overview_file, "w", encoding="utf-8") as f:
        f.write(overview_doc)
    print(f"\n[OK] Overview -> {overview_file.name}")

    # Generate domain documents
    total_servers = 0
    for domain_key, domain_info in MCP_DOMAINS.items():
        doc_content = generate_domain_doc(domain_key, domain_info, implemented)

        output_file = DOCS_OUTPUT / f"{domain_key}.md"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(doc_content)

        server_count = len(domain_info["servers"])
        total_servers += server_count
        print(f"[OK] {domain_info['name']}: {server_count} servers -> {output_file.name}")

    print(f"\n[OK] MCP documentation extraction complete")
    print(f"     Total servers: {total_servers}")
    print(f"     Implemented: {len(implemented)}")


if __name__ == "__main__":
    main()
