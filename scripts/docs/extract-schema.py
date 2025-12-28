#!/usr/bin/env python3
"""
Extract database schema documentation from SQL migrations.

This script:
1. Parses SQL schema files
2. Extracts tables, columns, types, and relationships
3. Generates Markdown documentation with ER diagrams
4. Writes to docs-site/docs/07-database/
"""

import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
MIGRATIONS_DIR = PROJECT_ROOT / "implementation" / "database" / "migrations"
DOCS_OUTPUT = PROJECT_ROOT / "docs-site" / "docs" / "07-database"


@dataclass
class Column:
    """Database column definition."""
    name: str
    data_type: str
    nullable: bool = True
    default: Optional[str] = None
    primary_key: bool = False
    references: Optional[str] = None


@dataclass
class Table:
    """Database table definition."""
    schema_name: str
    table_name: str
    columns: List[Column] = field(default_factory=list)
    description: Optional[str] = None


@dataclass
class Index:
    """Database index definition."""
    name: str
    table: str
    columns: List[str]
    index_type: Optional[str] = None


def parse_sql_files(migrations_dir: Path) -> Dict[str, Any]:
    """Parse all SQL migration files."""
    if not migrations_dir.exists():
        return {"exists": False}

    tables = []
    indexes = []
    schemas = set()

    sql_files = sorted(migrations_dir.glob("*.sql"))

    for sql_file in sql_files:
        with open(sql_file, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract schemas
        schema_matches = re.findall(r'CREATE SCHEMA IF NOT EXISTS (\w+)', content)
        schemas.update(schema_matches)

        # Extract tables
        table_pattern = r'CREATE TABLE (\w+)\.(\w+) \(([\s\S]*?)\);'
        for match in re.finditer(table_pattern, content):
            schema_name = match.group(1)
            table_name = match.group(2)
            columns_str = match.group(3)

            # Get comment before table if exists
            table_start = match.start()
            preceding_text = content[max(0, table_start - 200):table_start]
            desc_match = re.search(r'-- (.+?)$', preceding_text, re.MULTILINE)
            description = desc_match.group(1) if desc_match else None

            columns = parse_columns(columns_str)
            tables.append(Table(
                schema_name=schema_name,
                table_name=table_name,
                columns=columns,
                description=description
            ))

        # Extract indexes
        index_pattern = r'CREATE INDEX (\w+) ON (\w+\.\w+)\(([\w, ]+)\)'
        for match in re.finditer(index_pattern, content):
            index_name = match.group(1)
            table = match.group(2)
            columns = [c.strip() for c in match.group(3).split(',')]
            indexes.append(Index(name=index_name, table=table, columns=columns))

    return {
        "exists": True,
        "schemas": list(schemas),
        "tables": tables,
        "indexes": indexes
    }


def parse_columns(columns_str: str) -> List[Column]:
    """Parse column definitions from CREATE TABLE."""
    columns = []
    lines = columns_str.strip().split('\n')

    for line in lines:
        line = line.strip().rstrip(',')
        if not line or line.startswith('--'):
            continue

        # Skip constraints
        if any(kw in line.upper() for kw in ['UNIQUE(', 'CHECK ', 'CONSTRAINT ']):
            continue

        # Parse column definition
        match = re.match(r'^(\w+)\s+(.+)$', line)
        if not match:
            continue

        col_name = match.group(1)
        rest = match.group(2)

        # Skip if it's PRIMARY KEY line for table
        if col_name.upper() == 'PRIMARY':
            continue

        # Extract data type (first word/phrase)
        type_match = re.match(r'^([\w\[\]\(\)\d,\s]+?)(?:\s+(?:NOT|NULL|DEFAULT|PRIMARY|REFERENCES|CHECK|UNIQUE)|$)', rest, re.IGNORECASE)
        data_type = type_match.group(1).strip() if type_match else rest.split()[0]

        nullable = 'NOT NULL' not in rest.upper()
        primary_key = 'PRIMARY KEY' in rest.upper()

        # Extract default value
        default = None
        default_match = re.search(r'DEFAULT\s+([^\s,]+(?:\([^)]+\))?)', rest, re.IGNORECASE)
        if default_match:
            default = default_match.group(1)

        # Extract references
        references = None
        ref_match = re.search(r'REFERENCES\s+(\w+\.\w+)\((\w+)\)', rest)
        if ref_match:
            references = f"{ref_match.group(1)}.{ref_match.group(2)}"

        columns.append(Column(
            name=col_name,
            data_type=data_type,
            nullable=nullable,
            default=default,
            primary_key=primary_key,
            references=references
        ))

    return columns


def generate_schema_doc(parsed: Dict[str, Any]) -> str:
    """Generate Markdown documentation for database schema."""
    doc = """---
sidebar_position: 1
title: Database Schema
description: Complete PostgreSQL schema reference for KOSMOS V2.0
---

# Database Schema

Complete reference for the KOSMOS PostgreSQL database schema.

:::info Auto-Generated
This documentation is automatically extracted from SQL migration files.
:::

"""

    if not parsed.get("exists"):
        doc += """
:::warning Not Found
Database migration files not found. See [Gap Analysis](/docs/09-governance/gap-analysis) for implementation status.
:::
"""
        return doc

    # Overview with Mermaid ER diagram
    doc += """## Entity Relationship Diagram

```mermaid
erDiagram
    TENANTS ||--o{ USERS : has
    TENANTS ||--o{ CONVERSATIONS : has
    USERS ||--o{ CONVERSATIONS : creates
    CONVERSATIONS ||--o{ MESSAGES : contains

    PROPOSALS ||--o{ VOTES : receives
    PROPOSALS ||--o{ COST_TRACKING : tracks

    DOCUMENTS ||--o{ CHUNKS : splits_into
    ENTITIES ||--o{ RELATIONS : has

    AGENTS ||--o{ STATE : maintains
    AGENTS ||--o{ METRICS : generates
```

"""

    # List schemas
    schemas = parsed.get("schemas", [])
    if schemas:
        doc += "## Database Schemas\n\n"
        doc += "KOSMOS uses a multi-schema PostgreSQL design for logical separation:\n\n"
        doc += "| Schema | Purpose |\n"
        doc += "|--------|--------|\n"

        schema_descriptions = {
            "core": "Users, tenants, conversations, messages",
            "agents": "Agent registry, state, and metrics",
            "governance": "Pentarchy voting, proposals, cost tracking",
            "knowledge": "RAG documents, embeddings, knowledge graph",
            "metrics": "Performance and operational metrics",
            "audit": "Immutable audit logging"
        }

        for schema in sorted(schemas):
            desc = schema_descriptions.get(schema, "Application data")
            doc += f"| `{schema}` | {desc} |\n"

        doc += "\n"

    # Generate docs for each table grouped by schema
    tables = parsed.get("tables", [])
    tables_by_schema = {}
    for table in tables:
        if table.schema_name not in tables_by_schema:
            tables_by_schema[table.schema_name] = []
        tables_by_schema[table.schema_name].append(table)

    for schema_name in sorted(tables_by_schema.keys()):
        schema_tables = tables_by_schema[schema_name]
        doc += f"## `{schema_name}` Schema\n\n"

        for table in schema_tables:
            doc += f"### {table.table_name}\n\n"
            if table.description:
                doc += f"{table.description}\n\n"

            doc += "| Column | Type | Nullable | Default | References |\n"
            doc += "|--------|------|----------|---------|------------|\n"

            for col in table.columns:
                nullable = "YES" if col.nullable else "NO"
                default = f"`{col.default}`" if col.default else "-"
                references = f"`{col.references}`" if col.references else "-"
                pk_marker = " **PK**" if col.primary_key else ""

                doc += f"| `{col.name}`{pk_marker} | `{col.data_type}` | {nullable} | {default} | {references} |\n"

            doc += "\n"

    # Indexes section
    indexes = parsed.get("indexes", [])
    if indexes:
        doc += "## Indexes\n\n"
        doc += "Performance-optimized indexes:\n\n"
        doc += "| Index | Table | Columns |\n"
        doc += "|-------|-------|--------|\n"

        for idx in indexes:
            cols = ", ".join(f"`{c}`" for c in idx.columns)
            doc += f"| `{idx.name}` | `{idx.table}` | {cols} |\n"

        doc += "\n"

    # Add RLS note
    doc += """## Row Level Security

KOSMOS implements multi-tenancy using PostgreSQL Row Level Security (RLS):

```sql
-- Example: Tenant isolation policy
CREATE POLICY tenant_isolation_users ON core.users
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

All tenant-scoped tables have RLS enabled to ensure data isolation.

## Extensions

Required PostgreSQL extensions:

| Extension | Purpose |
|-----------|---------|
| `uuid-ossp` | UUID generation |
| `pgvector` | Vector embeddings for RAG |
| `pg_trgm` | Fuzzy text search |

"""

    return doc


def main():
    print("=" * 60)
    print("KOSMOS Database Schema Documentation Extractor")
    print("=" * 60)
    print(f"\nSource: {MIGRATIONS_DIR}")
    print(f"Output: {DOCS_OUTPUT}\n")

    # Ensure output directory exists
    DOCS_OUTPUT.mkdir(parents=True, exist_ok=True)

    parsed = parse_sql_files(MIGRATIONS_DIR)
    doc_content = generate_schema_doc(parsed)

    output_file = DOCS_OUTPUT / "schema.md"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(doc_content)

    if parsed.get("exists"):
        table_count = len(parsed.get("tables", []))
        index_count = len(parsed.get("indexes", []))
        print(f"[OK] Extracted {table_count} tables, {index_count} indexes")
    else:
        print("[WARN] Migration files not found")

    print(f"[OK] Written to: {output_file}")


if __name__ == "__main__":
    main()
