#!/usr/bin/env python3
"""
KOSMOS Documentation Generator

Master script that runs all documentation extractors to generate
auto-generated documentation from source code.

Usage:
    python scripts/docs/generate-all.py

This script is called by GitHub Actions on every push to main.
"""

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPTS_DIR.parent.parent


def run_extractor(script_name: str) -> bool:
    """Run a documentation extractor script."""
    script_path = SCRIPTS_DIR / script_name

    if not script_path.exists():
        print(f"[SKIP] {script_name} not found")
        return True

    print(f"\n{'=' * 60}")
    print(f"Running: {script_name}")
    print("=" * 60)

    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=PROJECT_ROOT,
        capture_output=False
    )

    return result.returncode == 0


def main():
    print("=" * 60)
    print("KOSMOS Documentation Generator")
    print("=" * 60)
    print(f"\nProject Root: {PROJECT_ROOT}")
    print(f"Scripts Dir: {SCRIPTS_DIR}")

    # List of extractors to run in order
    extractors = [
        "extract-agents.py",
        "extract-config.py",
        "extract-schema.py",
        "extract-mcp.py",
        "extract-api.py",
        "extract-frontend.py",
    ]

    results = {}
    for extractor in extractors:
        success = run_extractor(extractor)
        results[extractor] = success

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    all_success = True
    for script, success in results.items():
        status = "[OK]" if success else "[FAIL]"
        print(f"   {status} {script}")
        if not success:
            all_success = False

    if all_success:
        print("\n[OK] All documentation generated successfully!")
        return 0
    else:
        print("\n[ERROR] Some extractors failed. Check logs above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
