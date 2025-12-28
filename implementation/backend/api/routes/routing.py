"""
KOSMOS V2.0 Routing API

Endpoints for semantic routing dashboard and intent classification.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from core.intent_router import (
    IntentRouter,
    IntentRouterAPI,
    RouteRequest,
    get_intent_router
)
from core.semantic_router import (
    SemanticRouter,
    RoutingContext,
    IntentRoute,
    KeywordRule,
    get_semantic_router
)

router = APIRouter(prefix="/api/v1/routing", tags=["routing"])


# ============================================================================
# Request/Response Models
# ============================================================================

class RouteIntentRequest(BaseModel):
    """Request to route an intent."""
    text: str = Field(..., description="User input text to route", min_length=1)
    tenant_id: Optional[str] = Field(None, description="Tenant ID for multi-tenancy")
    user_id: Optional[str] = Field(None, description="User ID for context")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for context")
    previous_agent: Optional[str] = Field(None, description="Previously active agent")
    previous_intent: Optional[str] = Field(None, description="Previous intent for context")


class RouteIntentResponse(BaseModel):
    """Response from routing an intent."""
    agent_id: str
    agent_name: str
    confidence: float
    method: str
    intent_id: Optional[str]
    intent_name: Optional[str]
    alternative_agents: List[Dict[str, Any]]
    recommended_tools: List[Dict[str, Any]]
    all_tools_count: int
    latency_ms: float
    explanation: str
    timestamp: datetime


class IntentDefinition(BaseModel):
    """Intent definition for the taxonomy."""
    id: str
    name: str
    description: str
    category: str
    example_utterances: List[str]
    target_agent: str
    secondary_agents: List[str]
    confidence_threshold: float
    priority: int
    is_active: bool


class CreateIntentRequest(BaseModel):
    """Request to create a new intent."""
    id: str = Field(..., description="Unique intent ID", pattern=r"^[a-z][a-z0-9_.]*$")
    name: str = Field(..., description="Human-readable name")
    description: str = Field(..., description="Intent description")
    category: str = Field(..., description="Category ID")
    example_utterances: List[str] = Field(..., min_items=3, description="Example utterances")
    target_agent: str = Field(..., description="Primary target agent")
    secondary_agents: List[str] = Field(default=[], description="Secondary agents")
    confidence_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    priority: int = Field(default=5, ge=1, le=10)


class KeywordRuleDefinition(BaseModel):
    """Keyword rule definition."""
    pattern: str
    pattern_type: str
    target_agent: str
    priority: int
    confidence_boost: float


class CreateKeywordRuleRequest(BaseModel):
    """Request to create a keyword rule."""
    pattern: str = Field(..., description="Pattern to match")
    pattern_type: str = Field(..., pattern="^(regex|exact|contains)$")
    target_agent: str = Field(..., description="Target agent when matched")
    priority: int = Field(default=5, ge=1, le=10)
    confidence_boost: float = Field(default=0.1, ge=0.0, le=0.5)


class RoutingMetrics(BaseModel):
    """Routing metrics."""
    total_routes: int
    semantic_routes: int
    keyword_routes: int
    context_routes: int
    fallback_routes: int
    semantic_rate: float
    keyword_rate: float
    fallback_rate: float
    avg_latency_ms: float
    routes_count: int
    active_routes: int
    keyword_rules: int


class DashboardStats(BaseModel):
    """Dashboard statistics."""
    routing_metrics: RoutingMetrics
    top_intents: List[Dict[str, Any]]
    agent_distribution: Dict[str, int]
    recent_routes: List[Dict[str, Any]]
    system_health: Dict[str, Any]


# ============================================================================
# Dependencies
# ============================================================================

async def get_router() -> IntentRouter:
    """Dependency to get intent router."""
    return await get_intent_router()


async def get_semantic() -> SemanticRouter:
    """Dependency to get semantic router."""
    return await get_semantic_router()


# ============================================================================
# Route Endpoints
# ============================================================================

@router.post("/route", response_model=RouteIntentResponse)
async def route_intent(
    request: RouteIntentRequest,
    intent_router: IntentRouter = Depends(get_router)
):
    """
    Route user input to the appropriate agent.

    This is the main entry point for intent classification.
    Returns the selected agent, confidence, and recommended tools.
    """
    context = RoutingContext(
        tenant_id=request.tenant_id,
        user_id=request.user_id,
        conversation_id=request.conversation_id,
        previous_agent=request.previous_agent,
        previous_intent=request.previous_intent
    )

    resolution = await intent_router.resolve_intent(request.text, context)

    return RouteIntentResponse(
        agent_id=resolution.agent_id,
        agent_name=resolution.agent_name,
        confidence=resolution.routing_result.confidence,
        method=resolution.routing_result.method.value,
        intent_id=resolution.routing_result.matched_intent_id,
        intent_name=resolution.routing_result.matched_intent_name,
        alternative_agents=resolution.routing_result.alternative_agents,
        recommended_tools=[
            {
                "path": f"{t.server}.{t.name}",
                "name": t.name,
                "server": t.server,
                "description": t.description,
                "category": t.category.value
            }
            for t in resolution.recommended_tools
        ],
        all_tools_count=len(resolution.all_available_tools),
        latency_ms=resolution.resolution_latency_ms,
        explanation=resolution.routing_result.explanation,
        timestamp=datetime.utcnow()
    )


@router.post("/route/batch")
async def route_batch(
    texts: List[str],
    tenant_id: Optional[str] = None,
    intent_router: IntentRouter = Depends(get_router)
):
    """
    Route multiple inputs in batch.

    Useful for analyzing historical messages or testing.
    """
    if len(texts) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 texts per batch")

    results = []
    context = RoutingContext(tenant_id=tenant_id)

    for text in texts:
        resolution = await intent_router.resolve_intent(text, context)
        results.append({
            "text": text,
            "agent_id": resolution.agent_id,
            "confidence": resolution.routing_result.confidence,
            "intent_id": resolution.routing_result.matched_intent_id,
            "method": resolution.routing_result.method.value
        })

    return {"results": results, "count": len(results)}


# ============================================================================
# Intent Management
# ============================================================================

@router.get("/intents", response_model=List[IntentDefinition])
async def list_intents(
    category: Optional[str] = None,
    agent: Optional[str] = None,
    active_only: bool = True,
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """
    List all intent definitions.

    Supports filtering by category, agent, and active status.
    """
    intents = semantic_router.get_all_routes()

    if category:
        intents = [i for i in intents if i.category == category or i.category.startswith(category)]

    if agent:
        intents = [i for i in intents if i.target_agent == agent or agent in i.secondary_agents]

    if active_only:
        intents = [i for i in intents if i.is_active]

    return [
        IntentDefinition(
            id=i.id,
            name=i.name,
            description=i.description,
            category=i.category,
            example_utterances=i.example_utterances,
            target_agent=i.target_agent,
            secondary_agents=i.secondary_agents,
            confidence_threshold=i.confidence_threshold,
            priority=i.priority,
            is_active=i.is_active
        )
        for i in intents
    ]


@router.get("/intents/{intent_id}", response_model=IntentDefinition)
async def get_intent(
    intent_id: str,
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """Get a specific intent definition."""
    intents = semantic_router.get_all_routes()
    for intent in intents:
        if intent.id == intent_id:
            return IntentDefinition(
                id=intent.id,
                name=intent.name,
                description=intent.description,
                category=intent.category,
                example_utterances=intent.example_utterances,
                target_agent=intent.target_agent,
                secondary_agents=intent.secondary_agents,
                confidence_threshold=intent.confidence_threshold,
                priority=intent.priority,
                is_active=intent.is_active
            )

    raise HTTPException(status_code=404, detail=f"Intent not found: {intent_id}")


@router.post("/intents", response_model=IntentDefinition)
async def create_intent(
    request: CreateIntentRequest,
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """
    Create a new intent definition.

    The intent will be indexed for semantic matching.
    """
    # Check if intent already exists
    existing = semantic_router.get_all_routes()
    if any(i.id == request.id for i in existing):
        raise HTTPException(status_code=400, detail=f"Intent already exists: {request.id}")

    # Create new intent route
    new_route = IntentRoute(
        id=request.id,
        name=request.name,
        description=request.description,
        category=request.category,
        example_utterances=request.example_utterances,
        target_agent=request.target_agent,
        secondary_agents=request.secondary_agents,
        confidence_threshold=request.confidence_threshold,
        priority=request.priority,
        is_active=True
    )

    semantic_router.add_route(new_route)

    return IntentDefinition(
        id=new_route.id,
        name=new_route.name,
        description=new_route.description,
        category=new_route.category,
        example_utterances=new_route.example_utterances,
        target_agent=new_route.target_agent,
        secondary_agents=new_route.secondary_agents,
        confidence_threshold=new_route.confidence_threshold,
        priority=new_route.priority,
        is_active=new_route.is_active
    )


@router.put("/intents/{intent_id}/enable")
async def enable_intent(
    intent_id: str,
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """Enable an intent."""
    if semantic_router.enable_route(intent_id):
        return {"status": "enabled", "intent_id": intent_id}
    raise HTTPException(status_code=404, detail=f"Intent not found: {intent_id}")


@router.put("/intents/{intent_id}/disable")
async def disable_intent(
    intent_id: str,
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """Disable an intent."""
    if semantic_router.disable_route(intent_id):
        return {"status": "disabled", "intent_id": intent_id}
    raise HTTPException(status_code=404, detail=f"Intent not found: {intent_id}")


@router.delete("/intents/{intent_id}")
async def delete_intent(
    intent_id: str,
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """Delete an intent."""
    if semantic_router.remove_route(intent_id):
        return {"status": "deleted", "intent_id": intent_id}
    raise HTTPException(status_code=404, detail=f"Intent not found: {intent_id}")


# ============================================================================
# Keyword Rules
# ============================================================================

@router.get("/keyword-rules", response_model=List[KeywordRuleDefinition])
async def list_keyword_rules(
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """List all keyword fallback rules."""
    return [
        KeywordRuleDefinition(
            pattern=r.pattern,
            pattern_type=r.pattern_type,
            target_agent=r.target_agent,
            priority=r.priority,
            confidence_boost=r.confidence_boost
        )
        for r in semantic_router._keyword_rules
    ]


@router.post("/keyword-rules", response_model=KeywordRuleDefinition)
async def create_keyword_rule(
    request: CreateKeywordRuleRequest,
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """Create a new keyword rule."""
    rule = KeywordRule(
        pattern=request.pattern,
        pattern_type=request.pattern_type,
        target_agent=request.target_agent,
        priority=request.priority,
        confidence_boost=request.confidence_boost
    )

    semantic_router.add_keyword_rule(rule)

    return KeywordRuleDefinition(
        pattern=rule.pattern,
        pattern_type=rule.pattern_type,
        target_agent=rule.target_agent,
        priority=rule.priority,
        confidence_boost=rule.confidence_boost
    )


# ============================================================================
# Metrics & Dashboard
# ============================================================================

@router.get("/metrics", response_model=RoutingMetrics)
async def get_routing_metrics(
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """Get routing metrics."""
    metrics = semantic_router.get_metrics()
    return RoutingMetrics(
        total_routes=metrics["total_routes"],
        semantic_routes=metrics["semantic_routes"],
        keyword_routes=metrics["keyword_routes"],
        context_routes=metrics["context_routes"],
        fallback_routes=metrics["fallback_routes"],
        semantic_rate=metrics["semantic_rate"],
        keyword_rate=metrics["keyword_rate"],
        fallback_rate=metrics["fallback_rate"],
        avg_latency_ms=metrics["avg_latency_ms"],
        routes_count=metrics["routes_count"],
        active_routes=metrics["active_routes"],
        keyword_rules=metrics["keyword_rules"]
    )


@router.get("/dashboard")
async def get_dashboard_stats(
    intent_router: IntentRouter = Depends(get_router),
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """
    Get comprehensive dashboard statistics.

    Returns metrics, top intents, agent distribution, and system health.
    """
    router_metrics = intent_router.get_metrics()
    semantic_metrics = semantic_router.get_metrics()

    # Get intents by agent
    agent_distribution = {}
    for intent in semantic_router.get_all_routes():
        agent = intent.target_agent
        agent_distribution[agent] = agent_distribution.get(agent, 0) + 1

    return {
        "routing_metrics": semantic_metrics,
        "intent_router_metrics": router_metrics,
        "agent_distribution": agent_distribution,
        "total_intents": len(semantic_router.get_all_routes()),
        "total_agents": len(intent_router.agent_capabilities),
        "circuit_breaker": semantic_metrics.get("circuit_breaker", {}),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/test")
async def test_routing(
    texts: List[str],
    intent_router: IntentRouter = Depends(get_router)
):
    """
    Test routing with multiple example texts.

    Useful for validating intent definitions.
    """
    results = []
    for text in texts[:20]:  # Limit to 20
        resolution = await intent_router.resolve_intent(text, RoutingContext())
        results.append({
            "input": text,
            "agent": resolution.agent_id,
            "intent": resolution.routing_result.matched_intent_id,
            "confidence": resolution.routing_result.confidence,
            "method": resolution.routing_result.method.value
        })

    return {"results": results}


@router.get("/health")
async def routing_health(
    semantic_router: SemanticRouter = Depends(get_semantic)
):
    """Check routing system health."""
    metrics = semantic_router.get_metrics()
    circuit_breaker = metrics.get("circuit_breaker", {})

    is_healthy = (
        circuit_breaker.get("state") != "open" and
        metrics["active_routes"] > 0
    )

    return {
        "healthy": is_healthy,
        "circuit_breaker_state": circuit_breaker.get("state", "unknown"),
        "active_routes": metrics["active_routes"],
        "total_routes": metrics["routes_count"],
        "keyword_rules": metrics["keyword_rules"],
        "timestamp": datetime.utcnow().isoformat()
    }
