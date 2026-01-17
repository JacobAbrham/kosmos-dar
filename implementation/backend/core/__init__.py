"""
KOSMOS V2.0 Core Module
"""

from .config import settings
from .database import get_db
from .cache import get_cache
from .messaging import get_nats
from .circuit_breaker import CircuitBreaker, CircuitState, get_circuit_breaker_registry
from .tool_registry import GlobalToolRegistry, MCPTool, ToolCategory, get_tool_registry
# NOTE: semantic_router and intent_router are NOT imported here to avoid circular imports
# Import them directly: from core.semantic_router import ... or from core.intent_router import ...
from .model_router import (
    ModelRouter,
    ComplexityClassifier,
    QueryComplexity,
    ModelTier,
    RoutingDecision,
    get_model_router,
    route_and_generate,
)
from .cost_tracking import (
    CostTracker,
    CostCategory,
    BudgetPeriod,
    AlertLevel,
    CostRecord,
    BudgetStatus,
    CostAlert,
    get_cost_tracker,
    record_cost,
)

__all__ = [
    "settings",
    "get_db",
    "get_cache",
    "get_nats",
    "CircuitBreaker",
    "CircuitState",
    "get_circuit_breaker_registry",
    "GlobalToolRegistry",
    "MCPTool",
    "ToolCategory",
    "get_tool_registry",
    # NOTE: SemanticRouter, RoutingResult, RoutingContext, get_semantic_router
    # and IntentRouter, IntentResolution, get_intent_router are not exported here
    # to avoid circular imports. Import them directly from core.semantic_router or core.intent_router
    "ModelRouter",
    "ComplexityClassifier",
    "QueryComplexity",
    "ModelTier",
    "RoutingDecision",
    "get_model_router",
    "route_and_generate",
    "CostTracker",
    "CostCategory",
    "BudgetPeriod",
    "AlertLevel",
    "CostRecord",
    "BudgetStatus",
    "CostAlert",
    "get_cost_tracker",
    "record_cost",
]
