#!/usr/bin/env python3
"""
KOSMOS DAR Specification Validator

Validates feature specifications against architecture constraints,
generates implementation checklists, and creates PR templates.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

import yaml


# ============================================================================
# VALIDATION RULES
# ============================================================================

ARCHITECTURE_CONSTRAINTS = {
    "backend": {
        "language": "Python 3.11+",
        "framework": "FastAPI",
        "patterns": ["async/await", "dependency injection", "service layer"],
        "testing": ["pytest", "pytest-asyncio"],
    },
    "frontend": {
        "language": "TypeScript",
        "framework": "Next.js 14+",
        "patterns": ["Server Components", "Zustand", "Jotai"],
        "testing": ["Vitest", "Playwright"],
    },
    "agents": {
        "framework": "LangGraph",
        "patterns": ["checkpointing", "human-in-the-loop", "state management"],
    },
    "mcp": {
        "protocol": "Model Context Protocol",
        "transport": ["stdio", "http", "websocket"],
    },
}

REQUIRED_SECTIONS = [
    "Overview",
    "Technical Design",
    "Implementation Plan",
    "Testing Strategy",
    "Security Considerations",
]

REQUIRED_TECHNICAL_FIELDS = [
    "Components",
    "Data Models",
    "API Endpoints",
    "Database Changes",
]


# ============================================================================
# VALIDATOR
# ============================================================================

class SpecValidator:
    """Validates specifications against architecture constraints."""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.info: List[str] = []
    
    def validate_spec(self, spec_path: Path) -> Dict[str, Any]:
        """Validate a specification file."""
        self.errors.clear()
        self.warnings.clear()
        self.info.clear()
        
        if not spec_path.exists():
            self.errors.append(f"Spec file not found: {spec_path}")
            return self._result()
        
        # Read spec
        try:
            if spec_path.suffix == ".yaml" or spec_path.suffix == ".yml":
                with open(spec_path) as f:
                    spec = yaml.safe_load(f)
            else:
                # Assume markdown, parse manually
                spec = self._parse_markdown_spec(spec_path)
        except Exception as e:
            self.errors.append(f"Failed to parse spec: {e}")
            return self._result()
        
        # Validate structure
        self._validate_structure(spec)
        
        # Validate technical design
        self._validate_technical_design(spec)
        
        # Validate against architecture
        self._validate_architecture(spec)
        
        # Check completeness
        self._check_completeness(spec)
        
        return self._result()
    
    def _parse_markdown_spec(self, spec_path: Path) -> Dict[str, Any]:
        """Parse markdown specification."""
        content = spec_path.read_text()
        spec = {
            "content": content,
            "sections": {},
        }
        
        # Extract sections
        current_section = None
        current_content = []
        
        for line in content.split("\n"):
            if line.startswith("#"):
                if current_section:
                    spec["sections"][current_section] = "\n".join(current_content)
                current_section = line.lstrip("#").strip()
                current_content = []
            else:
                current_content.append(line)
        
        if current_section:
            spec["sections"][current_section] = "\n".join(current_content)
        
        return spec
    
    def _validate_structure(self, spec: Dict[str, Any]) -> None:
        """Validate spec structure."""
        if "sections" in spec:
            sections = spec["sections"]
        else:
            # Try to extract from content
            content = spec.get("content", "")
            sections = {}
            for section in REQUIRED_SECTIONS:
                if section.lower() in content.lower():
                    sections[section] = True
        
        # Check required sections
        for section in REQUIRED_SECTIONS:
            if section not in sections:
                self.warnings.append(f"Missing section: {section}")
    
    def _validate_technical_design(self, spec: Dict[str, Any]) -> None:
        """Validate technical design section."""
        content = spec.get("content", "")
        sections = spec.get("sections", {})
        
        tech_design = sections.get("Technical Design", "") or content
        
        # Check for required fields
        for field in REQUIRED_TECHNICAL_FIELDS:
            if field.lower() not in tech_design.lower():
                self.warnings.append(f"Technical Design missing: {field}")
        
        # Check for API endpoints
        if "API Endpoints" in tech_design or "api" in tech_design.lower():
            # Validate endpoint format
            endpoints = re.findall(r'(GET|POST|PUT|DELETE|PATCH)\s+/api/[^\s]+', tech_design, re.IGNORECASE)
            if not endpoints:
                self.warnings.append("No API endpoints found in Technical Design")
    
    def _validate_architecture(self, spec: Dict[str, Any]) -> None:
        """Validate against architecture constraints."""
        content = spec.get("content", "").lower()
        
        # Check backend constraints
        if "backend" in content or "api" in content:
            if "fastapi" not in content:
                self.warnings.append("Backend should use FastAPI")
            if "async" not in content and "await" not in content:
                self.warnings.append("Backend should use async/await")
        
        # Check frontend constraints
        if "frontend" in content or "ui" in content or "component" in content:
            if "next.js" not in content and "nextjs" not in content:
                self.warnings.append("Frontend should use Next.js 14+")
            if "typescript" not in content:
                self.warnings.append("Frontend should use TypeScript")
        
        # Check agent constraints
        if "agent" in content:
            if "langgraph" not in content:
                self.warnings.append("Agents should use LangGraph")
    
    def _check_completeness(self, spec: Dict[str, Any]) -> None:
        """Check spec completeness."""
        content = spec.get("content", "")
        
        # Check for TODO/FIXME
        todos = re.findall(r'TODO|FIXME|XXX', content, re.IGNORECASE)
        if todos:
            self.warnings.append(f"Found {len(todos)} TODO/FIXME items - spec may be incomplete")
        
        # Check for implementation plan
        if "implementation plan" in content.lower():
            if "phase" not in content.lower() and "step" not in content.lower():
                self.warnings.append("Implementation Plan should include phases or steps")
        
        # Check for testing strategy
        if "testing" in content.lower():
            if "unit test" not in content.lower() and "integration test" not in content.lower():
                self.warnings.append("Testing Strategy should include unit and integration tests")
    
    def _result(self) -> Dict[str, Any]:
        """Get validation result."""
        return {
            "valid": len(self.errors) == 0,
            "errors": self.errors,
            "warnings": self.warnings,
            "info": self.info,
        }


# ============================================================================
# CHECKLIST GENERATOR
# ============================================================================

class ChecklistGenerator:
    """Generates implementation checklists from specifications."""
    
    def generate(self, spec_path: Path) -> List[str]:
        """Generate implementation checklist."""
        content = spec_path.read_text()
        checklist = []
        
        # Extract implementation plan
        if "## Implementation Plan" in content or "### Implementation Plan" in content:
            # Parse phases
            phases = re.findall(r'### Phase \d+[^\n]+\n(.*?)(?=###|$)', content, re.DOTALL)
            for i, phase in enumerate(phases, 1):
                tasks = re.findall(r'- \[ \] (.+)', phase)
                for task in tasks:
                    checklist.append(f"Phase {i}: {task.strip()}")
        
        # Extract API endpoints
        endpoints = re.findall(r'(GET|POST|PUT|DELETE|PATCH)\s+/api/[^\s]+', content, re.IGNORECASE)
        for endpoint in endpoints:
            method, path = endpoint.split() if len(endpoint.split()) >= 2 else (endpoint, "")
            checklist.append(f"API: Implement {method} {path}")
        
        # Extract database changes
        if "Database Changes" in content or "database" in content.lower():
            migrations = re.findall(r'migration[^:]*:\s*(.+)', content, re.IGNORECASE)
            for migration in migrations:
                checklist.append(f"Database: {migration.strip()}")
        
        # Extract components
        if "Components" in content:
            components = re.findall(r'- \*\*([^\*]+)\*\*:', content)
            for component in components:
                checklist.append(f"Component: Implement {component.strip()}")
        
        return checklist


# ============================================================================
# PR TEMPLATE GENERATOR
# ============================================================================

class PRTemplateGenerator:
    """Generates PR templates from specifications."""
    
    def generate(self, spec_path: Path, spec_data: Dict[str, Any]) -> str:
        """Generate PR template."""
        spec_name = spec_path.stem.replace("spec-", "").replace("template-", "")
        
        template = f"""# {spec_name.title()}

## Description

[Based on specification: {spec_path.name}]

## Changes

### Backend
- [ ] Implementation
- [ ] Tests
- [ ] Documentation

### Frontend
- [ ] Implementation
- [ ] Tests
- [ ] Documentation

### Database
- [ ] Migrations
- [ ] Schema changes

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Security

- [ ] Input validation
- [ ] Authorization checks
- [ ] Audit logging

## Related

- Specification: `{spec_path}`
- Related ACTION_PLAN.md tasks: [List tasks]

## Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No secrets committed
- [ ] Breaking changes documented
"""
        return template


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Validate specifications")
    parser.add_argument("spec", type=Path, help="Specification file path")
    parser.add_argument("--checklist", action="store_true", help="Generate checklist")
    parser.add_argument("--pr-template", action="store_true", help="Generate PR template")
    parser.add_argument("--output", type=Path, help="Output file path")
    
    args = parser.parse_args()
    
    validator = SpecValidator()
    result = validator.validate_spec(args.spec)
    
    # Print validation results
    if result["errors"]:
        print("❌ ERRORS:", file=sys.stderr)
        for error in result["errors"]:
            print(f"  - {error}", file=sys.stderr)
    
    if result["warnings"]:
        print("⚠️  WARNINGS:", file=sys.stderr)
        for warning in result["warnings"]:
            print(f"  - {warning}", file=sys.stderr)
    
    if result["valid"]:
        print("✅ Specification is valid")
    else:
        print("❌ Specification has errors")
        sys.exit(1)
    
    # Generate checklist
    if args.checklist:
        generator = ChecklistGenerator()
        checklist = generator.generate(args.spec)
        
        if checklist:
            output = "\n".join(f"- [ ] {item}" for item in checklist)
            if args.output:
                args.output.write_text(output)
                print(f"\n✅ Checklist written to {args.output}")
            else:
                print("\n📋 Implementation Checklist:")
                print(output)
    
    # Generate PR template
    if args.pr_template:
        pr_gen = PRTemplateGenerator()
        template = pr_gen.generate(args.spec, result)
        
        if args.output:
            args.output.write_text(template)
            print(f"\n✅ PR template written to {args.output}")
        else:
            print("\n📝 PR Template:")
            print(template)


if __name__ == "__main__":
    main()
