#!/usr/bin/env python3
"""
KOSMOS DAR Context Update Script

Extracts learnings from code changes, updates .memory.md with patterns,
updates CLAUDE.md with architecture changes, and generates context summaries.
"""

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any


def extract_code_patterns(code_path: Path) -> List[str]:
    """Extract patterns from code file."""
    patterns = []
    
    try:
        content = code_path.read_text()
        
        # Extract class definitions
        classes = re.findall(r'class (\w+)\([^)]+\):', content)
        for cls in classes:
            patterns.append(f"Class: {cls}")
        
        # Extract function definitions
        functions = re.findall(r'async def (\w+)\([^)]*\):', content)
        for func in functions:
            patterns.append(f"Function: {func}")
        
        # Extract TODO/FIXME comments
        todos = re.findall(r'(TODO|FIXME|XXX):\s*(.+)', content, re.IGNORECASE)
        for todo_type, message in todos:
            patterns.append(f"{todo_type}: {message.strip()}")
    
    except Exception as e:
        print(f"Warning: Failed to read {code_path}: {e}", file=sys.stderr)
    
    return patterns


def update_memory_file(memory_path: Path, patterns: List[str], learnings: List[str]) -> None:
    """Update .memory.md with new patterns and learnings."""
    if not memory_path.exists():
        # Create new file
        content = f"""# KOSMOS DAR - Development Memory

**Purpose:** Accumulated learnings, patterns, and solutions discovered during development sessions.

**Last Updated:** {datetime.utcnow().strftime('%Y-%m-%d')}

---

## Session Notes

### {datetime.utcnow().strftime('%Y-%m-%d')}: Code Changes

#### Patterns Discovered
"""
        for pattern in patterns:
            content += f"- {pattern}\n"
        
        content += "\n#### Learnings\n"
        for learning in learnings:
            content += f"- {learning}\n"
        
        memory_path.write_text(content)
    else:
        # Append to existing file
        content = memory_path.read_text()
        
        # Find session notes section
        if "## Session Notes" in content:
            # Append new session
            new_session = f"""
### {datetime.utcnow().strftime('%Y-%m-%d')}: Code Changes

#### Patterns Discovered
"""
            for pattern in patterns:
                new_session += f"- {pattern}\n"
            
            new_session += "\n#### Learnings\n"
            for learning in learnings:
                new_session += f"- {learning}\n"
            
            # Insert before last section
            content = content.replace("## Session Notes", f"## Session Notes{new_session}")
        else:
            # Add session notes section
            content += f"""

## Session Notes

### {datetime.utcnow().strftime('%Y-%m-%d')}: Code Changes

#### Patterns Discovered
"""
            for pattern in patterns:
                content += f"- {pattern}\n"
            
            content += "\n#### Learnings\n"
            for learning in learnings:
                content += f"- {learning}\n"
        
        # Update last updated date
        content = re.sub(
            r'\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}',
            f'**Last Updated:** {datetime.utcnow().strftime("%Y-%m-%d")}',
            content
        )
        
        memory_path.write_text(content)


def update_claude_file(claude_path: Path, architecture_changes: List[str]) -> None:
    """Update CLAUDE.md with architecture changes."""
    if not claude_path.exists():
        print(f"Warning: CLAUDE.md not found at {claude_path}", file=sys.stderr)
        return
    
    content = claude_path.read_text()
    
    # Find architecture section
    if "## Architecture Overview" in content:
        # Append changes to architecture section
        arch_section_end = content.find("---", content.find("## Architecture Overview") + 100)
        if arch_section_end > 0:
            changes_text = "\n### Recent Changes\n"
            for change in architecture_changes:
                changes_text += f"- {change}\n"
            changes_text += f"\n*Updated: {datetime.utcnow().strftime('%Y-%m-%d')}*\n\n---"
            content = content[:arch_section_end] + changes_text + content[arch_section_end:]
    
    # Update version/date
    content = re.sub(
        r'\*\*Last Updated:\*\* \w+ \d{4}',
        f'**Last Updated:** {datetime.utcnow().strftime("%B %Y")}',
        content
    )
    
    claude_path.write_text(content)


def main():
    parser = argparse.ArgumentParser(description="Update context files with learnings")
    parser.add_argument("--code-dir", type=Path, default=Path("implementation"), help="Code directory to analyze")
    parser.add_argument("--memory", type=Path, default=Path(".memory.md"), help="Memory file path")
    parser.add_argument("--claude", type=Path, default=Path("CLAUDE.md"), help="CLAUDE.md file path")
    parser.add_argument("--learnings", nargs="+", help="Manual learnings to add")
    parser.add_argument("--arch-changes", nargs="+", help="Architecture changes to document")
    
    args = parser.parse_args()
    
    # Extract patterns from code
    patterns = []
    if args.code_dir.exists():
        for code_file in args.code_dir.rglob("*.py"):
            if "test" not in str(code_file) and "__pycache__" not in str(code_file):
                file_patterns = extract_code_patterns(code_file)
                patterns.extend(file_patterns)
    
    # Update memory file
    learnings = args.learnings or []
    update_memory_file(args.memory, patterns[:20], learnings)  # Limit to 20 patterns
    print(f"✅ Updated {args.memory}")
    
    # Update CLAUDE.md
    arch_changes = args.arch_changes or []
    if arch_changes:
        update_claude_file(args.claude, arch_changes)
        print(f"✅ Updated {args.claude}")
    
    print("\n✅ Context update complete!")


if __name__ == "__main__":
    main()
