#!/usr/bin/env python3
"""
KOSMOS Backend Import Validator

Run this script before pushing to catch import errors early.
Usage: python scripts/validate_imports.py
"""

import sys
import importlib
import traceback
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# List of critical modules to validate
CRITICAL_MODULES = [
    # Core modules
    "core.config",
    "core.database",
    "core.cache",
    "core.messaging",
    "core.audit_logging",
    "core.cost_tracking",
    "core.tool_registry",
    "core.intent_router",
    "core.model_router",
    "core.circuit_breaker",
    
    # API routes
    "api.routes.health",
    "api.routes.chat",
    "api.routes.agents",
    "api.routes.tools",
    "api.routes.routing",
    "api.routes.jobs",
    
    # Services
    "services.base",
    "services.chat_service",
    "services.agent_service",
    
    # Workers
    "workers.queue",
    "workers.jobs",
    
    # Agents
    "agents.registry",
]

# Specific imports to validate
CRITICAL_IMPORTS = [
    ("core.audit_logging", "audit_logger"),
    ("core.audit_logging", "AuditLogger"),
    ("core.audit_logging", "get_audit_logger"),
    ("core.cost_tracking", "CostTracker"),
    ("core.cost_tracking", "get_cost_tracker"),
    ("core.intent_router", "IntentRouter"),
    ("core.intent_router", "get_intent_router"),
    ("fastapi", "Request"),
]


def validate_module(module_name: str) -> tuple[bool, str]:
    """Try to import a module and return success/failure."""
    try:
        importlib.import_module(module_name)
        return True, "OK"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def validate_import(module_name: str, attr_name: str) -> tuple[bool, str]:
    """Try to import a specific attribute from a module."""
    try:
        module = importlib.import_module(module_name)
        if not hasattr(module, attr_name):
            return False, f"Module has no attribute '{attr_name}'"
        return True, "OK"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def main():
    print("=" * 60)
    print("KOSMOS Backend Import Validator")
    print("=" * 60)
    print()
    
    errors = []
    warnings = []
    
    # Validate critical imports first
    print("Checking critical imports...")
    print("-" * 40)
    for module_name, attr_name in CRITICAL_IMPORTS:
        success, msg = validate_import(module_name, attr_name)
        status = "✓" if success else "✗"
        print(f"  {status} from {module_name} import {attr_name}: {msg}")
        if not success:
            errors.append(f"from {module_name} import {attr_name}: {msg}")
    print()
    
    # Validate module imports
    print("Checking module imports...")
    print("-" * 40)
    for module_name in CRITICAL_MODULES:
        success, msg = validate_module(module_name)
        status = "✓" if success else "✗"
        print(f"  {status} {module_name}: {msg}")
        if not success:
            if "ModuleNotFoundError" in msg:
                warnings.append(f"{module_name}: {msg}")
            else:
                errors.append(f"{module_name}: {msg}")
    print()
    
    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    if errors:
        print(f"\n❌ ERRORS ({len(errors)}):")
        for err in errors:
            print(f"   - {err}")
    
    if warnings:
        print(f"\n⚠️  WARNINGS ({len(warnings)}) - missing dependencies:")
        for warn in warnings:
            print(f"   - {warn}")
    
    if not errors:
        print("\n✅ All critical imports validated successfully!")
        print("   Safe to push to GitHub.")
        return 0
    else:
        print("\n❌ Import validation FAILED!")
        print("   Fix errors before pushing.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
