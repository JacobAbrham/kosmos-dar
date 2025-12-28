#!/usr/bin/env python3
"""
Extract agent documentation from Python source code.

This script:
1. Parses agent Python files using AST
2. Extracts docstrings, classes, methods, enums, dataclasses
3. Generates Markdown documentation for each agent
4. Writes to docs-site/docs/03-agents/
"""

import ast
import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
AGENTS_SRC = PROJECT_ROOT / "implementation" / "backend" / "agents"
DOCS_OUTPUT = PROJECT_ROOT / "docs-site" / "docs" / "03-agents"

# Agent metadata (Greek mythology theme)
AGENT_METADATA = {
    "zeus": {
        "title": "Zeus",
        "subtitle": "Master Orchestrator",
        "domain": "Orchestration",
        "description": "The supreme orchestrator that coordinates all other agents, handles intent classification, and routes requests.",
        "pentarchy": False,
        "veto": False,
        "icon": "⚡"
    },
    "hermes": {
        "title": "Hermes",
        "subtitle": "Data Integration Agent",
        "domain": "Data",
        "description": "Messenger of the agents, handling data transformation, ETL operations, and cross-system integration.",
        "pentarchy": False,
        "veto": False,
        "icon": "📨"
    },
    "aegis": {
        "title": "AEGIS",
        "subtitle": "Security Guardian",
        "domain": "Security",
        "description": "The protective shield with security veto power, handling authentication, authorization, and threat detection.",
        "pentarchy": False,
        "veto": True,
        "icon": "🛡️"
    },
    "athena": {
        "title": "Athena",
        "subtitle": "Analytics & Wisdom Agent",
        "domain": "Analytics",
        "description": "Goddess of wisdom providing RAG capabilities, knowledge retrieval, and analytical insights.",
        "pentarchy": True,
        "veto": False,
        "icon": "🦉"
    },
    "chronos": {
        "title": "Chronos",
        "subtitle": "Time & Scheduling Agent",
        "domain": "Scheduling",
        "description": "Master of time handling calendar management, scheduling, reminders, and time-based orchestration.",
        "pentarchy": False,
        "veto": False,
        "icon": "⏰"
    },
    "hephaestus": {
        "title": "Hephaestus",
        "subtitle": "Development & Engineering Agent",
        "domain": "Development",
        "description": "The divine craftsman managing code generation, CI/CD, DevOps, and engineering tasks.",
        "pentarchy": True,
        "veto": False,
        "icon": "🔧"
    },
    "nur_prometheus": {
        "title": "Nur PROMETHEUS",
        "subtitle": "Financial Intelligence Agent",
        "domain": "Finance",
        "description": "Bearer of light for financial operations, cost analysis, budgeting, and economic insights.",
        "pentarchy": True,
        "veto": False,
        "icon": "💰"
    },
    "iris": {
        "title": "Iris",
        "subtitle": "Communication Agent",
        "domain": "Communication",
        "description": "Rainbow messenger handling notifications, alerts, cross-platform messaging, and escalations.",
        "pentarchy": False,
        "veto": False,
        "icon": "🌈"
    },
    "memorix": {
        "title": "MEMORIX",
        "subtitle": "Memory & Knowledge Agent",
        "domain": "Memory",
        "description": "Keeper of memories managing conversation context, knowledge graphs, and persistent memory.",
        "pentarchy": False,
        "veto": False,
        "icon": "🧠"
    },
    "hestia": {
        "title": "Hestia",
        "subtitle": "Operations & Infrastructure Agent",
        "domain": "Operations",
        "description": "Guardian of the hearth monitoring system health, infrastructure, and operational metrics.",
        "pentarchy": False,
        "veto": False,
        "icon": "🏠"
    },
    "morpheus": {
        "title": "Morpheus",
        "subtitle": "Prediction & Forecasting Agent",
        "domain": "Prediction",
        "description": "God of dreams providing predictive analytics, pattern recognition, and future insights.",
        "pentarchy": False,
        "veto": False,
        "icon": "🔮"
    },
    "base": {
        "title": "BaseAgent",
        "subtitle": "Abstract Base Class",
        "domain": "Core",
        "description": "Abstract base class that all KOSMOS agents inherit from, defining the common interface and lifecycle.",
        "pentarchy": False,
        "veto": False,
        "icon": "🏗️"
    },
    "governance": {
        "title": "Pentarchy Governance",
        "subtitle": "Voting System",
        "domain": "Governance",
        "description": "The governance system implementing 3-agent voting for medium-stakes decisions.",
        "pentarchy": False,
        "veto": False,
        "icon": "🗳️"
    },
    "registry": {
        "title": "Agent Registry",
        "subtitle": "Lifecycle Management",
        "domain": "Core",
        "description": "Central registry managing agent lifecycle, health checks, and coordination.",
        "pentarchy": False,
        "veto": False,
        "icon": "📋"
    },
    "langgraph_base": {
        "title": "LangGraph Base",
        "subtitle": "State Machine Template",
        "domain": "Core",
        "description": "Abstract base class for LangGraph-powered agents with state persistence, checkpointing, and HITL support.",
        "pentarchy": False,
        "veto": False,
        "icon": "🔄"
    }
}


@dataclass
class ClassInfo:
    """Information about a Python class."""
    name: str
    docstring: Optional[str]
    bases: List[str]
    methods: List['MethodInfo']
    is_dataclass: bool = False
    is_enum: bool = False
    decorators: List[str] = None


@dataclass
class MethodInfo:
    """Information about a class method."""
    name: str
    docstring: Optional[str]
    args: List[str]
    returns: Optional[str]
    is_async: bool = False
    is_abstract: bool = False
    decorators: List[str] = None


@dataclass
class EnumInfo:
    """Information about an Enum class."""
    name: str
    docstring: Optional[str]
    members: Dict[str, str]


def parse_python_file(file_path: Path) -> Dict[str, Any]:
    """Parse a Python file and extract documentation info."""
    if not file_path.exists():
        return {"exists": False}

    with open(file_path, "r", encoding="utf-8") as f:
        source = f.read()

    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        return {"exists": True, "parse_error": str(e)}

    module_docstring = ast.get_docstring(tree)
    classes = []
    enums = []
    functions = []
    imports = []

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            class_info = extract_class_info(node)
            if class_info.is_enum:
                enums.append(class_info)
            else:
                classes.append(class_info)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append(node.module)

    return {
        "exists": True,
        "module_docstring": module_docstring,
        "classes": classes,
        "enums": enums,
        "imports": imports,
        "line_count": len(source.splitlines())
    }


def extract_class_info(node: ast.ClassDef) -> ClassInfo:
    """Extract information from a class definition."""
    decorators = [get_decorator_name(d) for d in node.decorator_list]
    is_dataclass = "dataclass" in decorators
    bases = [get_name(base) for base in node.bases]
    is_enum = "Enum" in bases or "str, Enum" in ", ".join(bases)

    methods = []
    members = {}

    for item in node.body:
        if isinstance(item, ast.FunctionDef) or isinstance(item, ast.AsyncFunctionDef):
            methods.append(extract_method_info(item))
        elif isinstance(item, ast.Assign):
            # For enum members
            for target in item.targets:
                if isinstance(target, ast.Name):
                    if isinstance(item.value, ast.Constant):
                        members[target.id] = str(item.value.value)

    return ClassInfo(
        name=node.name,
        docstring=ast.get_docstring(node),
        bases=bases,
        methods=methods,
        is_dataclass=is_dataclass,
        is_enum=is_enum,
        decorators=decorators
    )


def extract_method_info(node) -> MethodInfo:
    """Extract information from a method definition."""
    decorators = [get_decorator_name(d) for d in node.decorator_list]
    is_async = isinstance(node, ast.AsyncFunctionDef)
    is_abstract = "abstractmethod" in decorators

    args = []
    for arg in node.args.args:
        if arg.arg != "self":
            arg_str = arg.arg
            if arg.annotation:
                arg_str += f": {get_annotation(arg.annotation)}"
            args.append(arg_str)

    returns = None
    if node.returns:
        returns = get_annotation(node.returns)

    return MethodInfo(
        name=node.name,
        docstring=ast.get_docstring(node),
        args=args,
        returns=returns,
        is_async=is_async,
        is_abstract=is_abstract,
        decorators=decorators
    )


def get_decorator_name(node) -> str:
    """Get decorator name from AST node."""
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Attribute):
        return node.attr
    elif isinstance(node, ast.Call):
        return get_decorator_name(node.func)
    return str(node)


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


def escape_mdx(text: str) -> str:
    """Escape curly braces for MDX compatibility."""
    if not text:
        return text
    # Escape { and } to prevent MDX from treating them as JSX expressions
    # Use HTML entities or backtick escaping
    return text.replace("{", "\\{").replace("}", "\\}")


def generate_agent_doc(agent_name: str, parsed: Dict[str, Any]) -> str:
    """Generate Markdown documentation for an agent."""
    meta = AGENT_METADATA.get(agent_name, {
        "title": agent_name.replace("_", " ").title(),
        "subtitle": "Agent",
        "domain": "Unknown",
        "description": "No description available.",
        "pentarchy": False,
        "veto": False,
        "icon": "🤖"
    })

    # Determine sidebar position
    agent_order = list(AGENT_METADATA.keys())
    position = agent_order.index(agent_name) + 2 if agent_name in agent_order else 99

    # Build badges
    badges = []
    if meta.get("pentarchy"):
        badges.append("![Pentarchy Voter](https://img.shields.io/badge/Pentarchy-Voter-blue)")
    if meta.get("veto"):
        badges.append("![Security Veto](https://img.shields.io/badge/Security-Veto%20Power-red)")

    badge_line = " ".join(badges) if badges else ""

    # Start building document
    doc = f"""---
sidebar_position: {position}
title: {meta['title']}
description: {meta['description']}
---

# {meta['icon']} {meta['title']}

**{meta['subtitle']}** | Domain: {meta['domain']}

{badge_line}

{meta['description']}

"""

    if not parsed.get("exists"):
        doc += """
:::warning Not Implemented
This agent is documented but the source file was not found. See [Gap Analysis](/docs/09-governance/gap-analysis) for implementation status.
:::
"""
        return doc

    if parsed.get("parse_error"):
        doc += f"""
:::danger Parse Error
Failed to parse source file: {parsed['parse_error']}
:::
"""
        return doc

    # Module docstring
    if parsed.get("module_docstring"):
        doc += f"""
## Overview

{escape_mdx(parsed['module_docstring'])}

"""

    # Source info
    doc += f"""
:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/{agent_name}.py` ({parsed.get('line_count', 0)} lines)
:::

"""

    # Enums
    if parsed.get("enums"):
        doc += "## Enumerations\n\n"
        for enum_class in parsed["enums"]:
            doc += f"### {escape_mdx(enum_class.name)}\n\n"
            if enum_class.docstring:
                doc += f"{escape_mdx(enum_class.docstring)}\n\n"
            doc += "| Member | Value |\n|--------|-------|\n"
            for method in enum_class.methods:
                if not method.name.startswith("_"):
                    doc += f"| `{escape_mdx(method.name)}` | - |\n"
            doc += "\n"

    # Dataclasses
    dataclasses = [c for c in parsed.get("classes", []) if c.is_dataclass]
    if dataclasses:
        doc += "## Data Models\n\n"
        for dc in dataclasses:
            doc += f"### {escape_mdx(dc.name)}\n\n"
            if dc.docstring:
                doc += f"{escape_mdx(dc.docstring)}\n\n"
            doc += "```python\n@dataclass\n"
            doc += f"class {dc.name}:\n"
            for method in dc.methods:
                if method.args:
                    doc += f"    {method.name}: {method.args[0] if method.args else 'Any'}\n"
            doc += "```\n\n"

    # Main classes
    main_classes = [c for c in parsed.get("classes", []) if not c.is_dataclass and not c.is_enum]
    for cls in main_classes:
        doc += f"## {escape_mdx(cls.name)}\n\n"
        if cls.docstring:
            doc += f"{escape_mdx(cls.docstring)}\n\n"
        if cls.bases:
            doc += f"**Inherits from:** `{escape_mdx(', '.join(cls.bases))}`\n\n"

        # Methods
        public_methods = [m for m in cls.methods if not m.name.startswith("_") or m.name == "__init__"]
        if public_methods:
            doc += "### Methods\n\n"
            for method in public_methods:
                async_prefix = "async " if method.is_async else ""
                abstract_badge = " *(abstract)*" if method.is_abstract else ""
                args_str = ", ".join(method.args) if method.args else ""
                returns_str = f" → {method.returns}" if method.returns else ""

                # Escape the method signature for MDX
                method_sig = f"{async_prefix}{method.name}({args_str}){returns_str}"
                doc += f"#### `{escape_mdx(method_sig)}`{abstract_badge}\n\n"
                if method.docstring:
                    doc += f"{escape_mdx(method.docstring)}\n\n"

    return doc


def main():
    print("=" * 60)
    print("KOSMOS Agent Documentation Extractor")
    print("=" * 60)
    print(f"\nSource: {AGENTS_SRC}")
    print(f"Output: {DOCS_OUTPUT}\n")

    # Ensure output directory exists
    DOCS_OUTPUT.mkdir(parents=True, exist_ok=True)

    # Get list of agent files
    if not AGENTS_SRC.exists():
        print(f"[ERROR] Source directory not found: {AGENTS_SRC}")
        print("   Creating placeholder documentation...")

        # Create placeholders for known agents
        for agent_name in AGENT_METADATA.keys():
            doc_content = generate_agent_doc(agent_name, {"exists": False})
            output_file = DOCS_OUTPUT / f"{agent_name}.md"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(doc_content)
            print(f"   [+] {agent_name} (placeholder)")
        return

    # Process each Python file
    agent_files = list(AGENTS_SRC.glob("*.py"))
    print(f"Found {len(agent_files)} agent files\n")

    for agent_file in agent_files:
        if agent_file.name.startswith("__"):
            continue

        agent_name = agent_file.stem
        print(f"Processing: {agent_name}")

        parsed = parse_python_file(agent_file)
        doc_content = generate_agent_doc(agent_name, parsed)

        output_file = DOCS_OUTPUT / f"{agent_name}.md"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(doc_content)

        status = "[OK]" if parsed.get("exists") and not parsed.get("parse_error") else "[WARN]"
        line_count = parsed.get("line_count", 0)
        class_count = len(parsed.get("classes", []))
        print(f"   {status} {line_count} lines, {class_count} classes -> {output_file.name}")

    print(f"\n[OK] Agent documentation extraction complete")
    print(f"   Output: {DOCS_OUTPUT}")


if __name__ == "__main__":
    main()
