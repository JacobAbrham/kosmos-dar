#!/usr/bin/env python3
"""
Extract configuration documentation from Pydantic settings.

This script:
1. Parses Pydantic settings classes using AST
2. Extracts field names, types, defaults, and descriptions
3. Generates Markdown documentation for configuration reference
4. Writes to docs-site/docs/08-configuration/
"""

import ast
import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
CONFIG_SRC = PROJECT_ROOT / "implementation" / "backend" / "core" / "config.py"
DOCS_OUTPUT = PROJECT_ROOT / "docs-site" / "docs" / "08-configuration"


@dataclass
class ConfigField:
    """Information about a configuration field."""
    name: str
    type_hint: str
    default: Optional[str]
    description: Optional[str]
    env_var: str
    category: str


def parse_config_file(file_path: Path) -> Dict[str, Any]:
    """Parse the config file and extract settings."""
    if not file_path.exists():
        return {"exists": False}

    with open(file_path, "r", encoding="utf-8") as f:
        source = f.read()

    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        return {"exists": True, "parse_error": str(e)}

    module_docstring = ast.get_docstring(tree)
    settings_classes = []
    env_prefix = "KOSMOS_"

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            # Check if it's a Settings class
            bases = [get_name(base) for base in node.bases]
            if "BaseSettings" in str(bases):
                fields = extract_settings_fields(node, env_prefix)
                settings_classes.append({
                    "name": node.name,
                    "docstring": ast.get_docstring(node),
                    "fields": fields
                })

    return {
        "exists": True,
        "module_docstring": module_docstring,
        "settings_classes": settings_classes
    }


def extract_settings_fields(node: ast.ClassDef, env_prefix: str) -> List[ConfigField]:
    """Extract fields from a Settings class."""
    fields = []

    # Determine categories based on comments
    current_category = "General"

    for item in node.body:
        if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
            field_name = item.target.id
            type_hint = get_annotation(item.annotation) if item.annotation else "Any"

            default = None
            if item.value:
                default = get_value(item.value)

            # Determine category from field name patterns
            category = categorize_field(field_name)

            # Generate env var name
            env_var = f"{env_prefix}{field_name.upper()}"

            fields.append(ConfigField(
                name=field_name,
                type_hint=type_hint,
                default=default,
                description=None,  # Could be extracted from comments
                env_var=env_var,
                category=category
            ))

    return fields


def categorize_field(name: str) -> str:
    """Categorize a field based on its name."""
    categories = {
        "Core": ["env", "debug", "secret_key", "log_level"],
        "Database": ["database_url"],
        "Cache": ["redis_url"],
        "Messaging": ["nats_url"],
        "Storage": ["minio_"],
        "Authentication": ["zitadel_"],
        "LLM Providers": ["openai_", "anthropic_", "huggingface_", "litellm_"],
        "Observability": ["langfuse_", "jaeger_"],
        "CORS": ["cors_"],
        "Agent Settings": ["zeus_", "pentarchy_"],
        "Cost Governance": ["cost_"]
    }

    for category, prefixes in categories.items():
        for prefix in prefixes:
            if name.startswith(prefix) or name == prefix:
                return category

    return "General"


def get_name(node) -> str:
    """Get name from AST node."""
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Attribute):
        return f"{get_name(node.value)}.{node.attr}"
    return str(node)


def get_annotation(node) -> str:
    """Get type annotation as string."""
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Constant):
        return repr(node.value)
    elif isinstance(node, ast.Subscript):
        return f"{get_annotation(node.value)}[{get_annotation(node.slice)}]"
    elif isinstance(node, ast.Tuple):
        return ", ".join(get_annotation(el) for el in node.elts)
    elif isinstance(node, ast.Attribute):
        return f"{get_name(node.value)}.{node.attr}"
    return "Any"


def get_value(node) -> str:
    """Get default value as string."""
    if isinstance(node, ast.Constant):
        if isinstance(node.value, str):
            return f'"{node.value}"'
        return str(node.value)
    elif isinstance(node, ast.List):
        items = [get_value(el) for el in node.elts]
        return f"[{', '.join(items)}]"
    elif isinstance(node, ast.Dict):
        return "{}"
    elif isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Call):
        return f"{get_name(node.func)}(...)"
    return "..."


def generate_config_doc(parsed: Dict[str, Any]) -> str:
    """Generate Markdown documentation for configuration."""
    doc = """---
sidebar_position: 1
title: Environment Variables
description: Complete configuration reference for KOSMOS V2.0
---

# Environment Variables

Complete reference for all KOSMOS configuration options.

:::info Auto-Generated
This documentation is automatically extracted from the Pydantic settings classes.
:::

"""

    if not parsed.get("exists"):
        doc += """
:::warning Not Found
Configuration source file not found. See [Gap Analysis](/docs/09-governance/gap-analysis) for implementation status.
:::
"""
        return doc

    if parsed.get("parse_error"):
        doc += f"""
:::danger Parse Error
Failed to parse configuration file: {parsed['parse_error']}
:::
"""
        return doc

    # Group fields by category
    for settings_class in parsed.get("settings_classes", []):
        if settings_class.get("docstring"):
            doc += f"{settings_class['docstring']}\n\n"

        # Group fields by category
        categories = {}
        for field in settings_class.get("fields", []):
            if field.category not in categories:
                categories[field.category] = []
            categories[field.category].append(field)

        # Generate docs for each category
        for category, fields in categories.items():
            doc += f"## {category}\n\n"
            doc += "| Variable | Type | Default | Description |\n"
            doc += "|----------|------|---------|-------------|\n"

            for field in fields:
                default = field.default if field.default else "*required*"
                description = field.description or f"Configure {field.name.replace('_', ' ')}"
                doc += f"| `{field.env_var}` | `{field.type_hint}` | `{default}` | {description} |\n"

            doc += "\n"

    # Add example .env file
    doc += """## Example `.env` File

```bash
# Core Settings
KOSMOS_ENV=production
KOSMOS_DEBUG=false
KOSMOS_SECRET_KEY=your-secret-key-here
KOSMOS_LOG_LEVEL=INFO

# Database
KOSMOS_DATABASE_URL=postgresql+asyncpg://user:pass@db.example.com:5432/kosmos

# Cache & Messaging
KOSMOS_REDIS_URL=redis://redis.example.com:6379
KOSMOS_NATS_URL=nats://nats.example.com:4222

# Storage
KOSMOS_MINIO_HOST=minio.example.com
KOSMOS_MINIO_PORT=9000
KOSMOS_MINIO_ACCESS_KEY=your-access-key
KOSMOS_MINIO_SECRET_KEY=your-secret-key
KOSMOS_MINIO_BUCKET=kosmos

# Authentication (Zitadel)
KOSMOS_ZITADEL_DOMAIN=auth.example.com
KOSMOS_ZITADEL_PROJECT_ID=your-project-id
KOSMOS_ZITADEL_CLIENT_ID=your-client-id
KOSMOS_ZITADEL_CLIENT_SECRET=your-client-secret

# LLM Providers
KOSMOS_OPENAI_API_KEY=sk-...
KOSMOS_ANTHROPIC_API_KEY=sk-ant-...
KOSMOS_LITELLM_URL=http://litellm:4000
KOSMOS_LITELLM_MASTER_KEY=sk-...

# Observability
KOSMOS_LANGFUSE_PUBLIC_KEY=pk-...
KOSMOS_LANGFUSE_SECRET_KEY=sk-...
KOSMOS_LANGFUSE_HOST=http://langfuse:3001
KOSMOS_JAEGER_AGENT_HOST=jaeger
KOSMOS_JAEGER_AGENT_PORT=6831

# Cost Governance
KOSMOS_COST_AUTO_APPROVE_MAX=50.0
KOSMOS_COST_PENTARCHY_VOTE_MAX=100.0
KOSMOS_COST_DAILY_LIMIT=500.0
KOSMOS_COST_MONTHLY_LIMIT=10000.0
```

:::tip Secrets Management
In production, use a secrets manager like HashiCorp Vault or cloud provider secrets service.
Store sensitive values as Kubernetes secrets or similar.
:::
"""

    return doc


def main():
    print("=" * 60)
    print("KOSMOS Configuration Documentation Extractor")
    print("=" * 60)
    print(f"\nSource: {CONFIG_SRC}")
    print(f"Output: {DOCS_OUTPUT}\n")

    # Ensure output directory exists
    DOCS_OUTPUT.mkdir(parents=True, exist_ok=True)

    parsed = parse_config_file(CONFIG_SRC)
    doc_content = generate_config_doc(parsed)

    output_file = DOCS_OUTPUT / "environment-variables.md"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(doc_content)

    if parsed.get("exists") and not parsed.get("parse_error"):
        field_count = sum(
            len(s.get("fields", []))
            for s in parsed.get("settings_classes", [])
        )
        print(f"[OK] Extracted {field_count} configuration variables")
    else:
        print("[WARN] Could not parse configuration file")

    print(f"[OK] Written to: {output_file}")


if __name__ == "__main__":
    main()
