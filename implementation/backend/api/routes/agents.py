"""
KOSMOS V2.0 Agents API

Endpoints for agent management and capability discovery.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from core.intent_router import (
    IntentRouter,
    AgentCapability,
    get_intent_router
)
from core.tool_registry import (
    GlobalToolRegistry,
    MCPTool,
    ToolCategory,
    get_tool_registry
)
from core.dependencies import (
    get_service_context_dep,
    get_agent_service_dependency
)
from services.agent_service import AgentService
from services.base import ServiceContext

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


# ============================================================================
# Request/Response Models
# ============================================================================

class AgentDefinition(BaseModel):
    """Agent definition with capabilities."""
    id: str
    name: str
    domain: str
    description: str
    tool_categories: List[str]
    primary_mcp_servers: List[str]
    fallback_mcp_servers: List[str]
    tools_count: int


class AgentTool(BaseModel):
    """Tool available to an agent."""
    path: str
    name: str
    server: str
    description: str
    category: str
    input_schema: Dict[str, Any]
    call_count: int
    avg_latency_ms: float


class AgentStats(BaseModel):
    """Agent statistics."""
    id: str
    name: str
    tools_count: int
    total_tool_calls: int
    avg_latency_ms: float
    active_routes: int


class AgentCapabilitySummary(BaseModel):
    """Summary of agent capabilities."""
    id: str
    name: str
    domain: str
    can_handle: List[str]  # List of intent categories


# ============================================================================
# Dependencies
# ============================================================================

async def get_router() -> IntentRouter:
    """Dependency to get intent router."""
    return await get_intent_router()


async def get_registry() -> GlobalToolRegistry:
    """Dependency to get tool registry."""
    return await get_tool_registry()


# ============================================================================
# Agent Endpoints
# ============================================================================

@router.get("/", response_model=List[AgentDefinition])
async def list_agents(
    request: Request,
    agent_service: AgentService = Depends(get_agent_service_dependency),
    include_stats: bool = Query(False, description="Include agent statistics"),
):
    """
    List all registered agents and their capabilities.

    Uses AgentService for clean separation of concerns.
    """
    ctx = ServiceContext.from_request(request)
    agents = await agent_service.list_agents(ctx, include_stats=include_stats)

    return [
        AgentDefinition(
            id=agent["id"],
            name=agent["name"],
            domain=agent["domain"],
            description=agent["description"],
            tool_categories=agent["tool_categories"],
            primary_mcp_servers=[],  # TODO: Add to service response
            fallback_mcp_servers=[],  # TODO: Add to service response
            tools_count=agent["tools_count"]
        )
        for agent in agents
    ]


@router.get("/{agent_id}", response_model=AgentDefinition)
async def get_agent(
    agent_id: str,
    request: Request,
    agent_service: AgentService = Depends(get_agent_service_dependency),
):
    """Get details for a specific agent."""
    ctx = ServiceContext.from_request(request)
    agent = await agent_service.get_agent(ctx, agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")

    return AgentDefinition(
        id=agent["id"],
        name=agent["name"],
        domain=agent["domain"],
        description=agent["description"],
        tool_categories=agent["tool_categories"],
        primary_mcp_servers=[],  # TODO: Add to service response
        fallback_mcp_servers=[],  # TODO: Add to service response
        tools_count=agent["tools_count"]
    )


@router.get("/{agent_id}/tools", response_model=List[AgentTool])
async def get_agent_tools(
    agent_id: str,
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in name/description"),
    intent_router: IntentRouter = Depends(get_router)
):
    """
    Get all tools available to a specific agent.
    """
    agent = intent_router.get_agent_capability(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")

    tools = intent_router.get_agent_tools(agent_id)

    # Filter by category
    if category:
        try:
            cat = ToolCategory(category)
            tools = [t for t in tools if t.category == cat]
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

    # Search filter
    if search:
        search_lower = search.lower()
        tools = [
            t for t in tools
            if search_lower in t.name.lower() or search_lower in t.description.lower()
        ]

    return [
        AgentTool(
            path=f"{t.server}.{t.name}",
            name=t.name,
            server=t.server,
            description=t.description,
            category=t.category.value,
            input_schema=t.input_schema,
            call_count=t.call_count,
            avg_latency_ms=t.avg_latency_ms
        )
        for t in tools
    ]


@router.get("/{agent_id}/stats", response_model=AgentStats)
async def get_agent_stats(
    agent_id: str,
    intent_router: IntentRouter = Depends(get_router)
):
    """
    Get statistics for a specific agent.
    """
    agent = intent_router.get_agent_capability(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")

    tools = intent_router.get_agent_tools(agent_id)

    # Calculate stats
    total_calls = sum(t.call_count for t in tools)
    avg_latency = (
        sum(t.avg_latency_ms for t in tools) / len(tools)
        if tools else 0
    )

    # Count routes for this agent
    routes = intent_router.semantic_router.get_routes_by_agent(agent_id) if intent_router.semantic_router else []

    return AgentStats(
        id=agent_id,
        name=agent.name,
        tools_count=len(tools),
        total_tool_calls=total_calls,
        avg_latency_ms=avg_latency,
        active_routes=len(routes)
    )


@router.get("/{agent_id}/intents")
async def get_agent_intents(
    agent_id: str,
    intent_router: IntentRouter = Depends(get_router)
):
    """
    Get all intents routed to a specific agent.
    """
    agent = intent_router.get_agent_capability(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")

    if not intent_router.semantic_router:
        return {"intents": []}

    routes = intent_router.semantic_router.get_routes_by_agent(agent_id)

    return {
        "agent_id": agent_id,
        "intents": [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "category": r.category,
                "example_utterances": r.example_utterances,
                "confidence_threshold": r.confidence_threshold,
                "priority": r.priority
            }
            for r in routes
        ],
        "count": len(routes)
    }


# ============================================================================
# Capability Discovery
# ============================================================================

@router.get("/capabilities/summary", response_model=List[AgentCapabilitySummary])
async def get_capabilities_summary(
    intent_router: IntentRouter = Depends(get_router)
):
    """
    Get a summary of what each agent can handle.

    Useful for understanding the agent ecosystem at a glance.
    """
    agents = intent_router.get_all_agents()
    summaries = []

    for agent in agents:
        # Get intent categories this agent handles
        routes = []
        if intent_router.semantic_router:
            routes = intent_router.semantic_router.get_routes_by_agent(agent.agent_id)

        categories = list(set(r.category.split(".")[0] for r in routes))

        summaries.append(AgentCapabilitySummary(
            id=agent.agent_id,
            name=agent.name,
            domain=agent.domain,
            can_handle=categories
        ))

    return summaries


@router.get("/capabilities/matrix")
async def get_capability_matrix(
    intent_router: IntentRouter = Depends(get_router)
):
    """
    Get a matrix of agents vs tool categories.

    Shows which agents have access to which tool categories.
    """
    agents = intent_router.get_all_agents()
    categories = [c.value for c in ToolCategory]

    matrix = {}
    for agent in agents:
        matrix[agent.agent_id] = {
            "name": agent.name,
            "categories": {
                cat: cat in [c.value for c in agent.tool_categories]
                for cat in categories
            },
            "tools_count": len(intent_router.get_agent_tools(agent.agent_id))
        }

    return {
        "agents": list(matrix.keys()),
        "categories": categories,
        "matrix": matrix
    }


# ============================================================================
# Agent Selection
# ============================================================================

@router.get("/recommend")
async def recommend_agent(
    task: str = Query(..., description="Task description"),
    intent_router: IntentRouter = Depends(get_router)
):
    """
    Recommend the best agent for a task.

    This uses the semantic router to find the best match.
    """
    from core.semantic_router import RoutingContext

    resolution = await intent_router.resolve_intent(task, RoutingContext())

    return {
        "recommended_agent": {
            "id": resolution.agent_id,
            "name": resolution.agent_name,
            "description": resolution.agent_description
        },
        "confidence": resolution.routing_result.confidence,
        "method": resolution.routing_result.method.value,
        "intent": {
            "id": resolution.routing_result.matched_intent_id,
            "name": resolution.routing_result.matched_intent_name
        },
        "alternative_agents": resolution.routing_result.alternative_agents,
        "recommended_tools": [
            {
                "path": f"{t.server}.{t.name}",
                "name": t.name,
                "description": t.description
            }
            for t in resolution.recommended_tools[:5]
        ],
        "explanation": resolution.routing_result.explanation
    }


# ============================================================================
# Health & Status
# ============================================================================

@router.get("/health")
async def agents_health(
    intent_router: IntentRouter = Depends(get_router),
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """Check health of all agents and their tool availability."""
    agents = intent_router.get_all_agents()

    agent_health = {}
    for agent in agents:
        tools = intent_router.get_agent_tools(agent.agent_id)
        tools_available = len(tools)

        # Check MCP server health
        servers_healthy = 0
        for server in agent.primary_mcp_servers:
            status = registry.get_server_status(server)
            if status.get("circuit_breaker") != "open":
                servers_healthy += 1

        agent_health[agent.agent_id] = {
            "name": agent.name,
            "healthy": servers_healthy > 0 or tools_available > 0,
            "tools_available": tools_available,
            "servers_total": len(agent.primary_mcp_servers),
            "servers_healthy": servers_healthy
        }

    all_healthy = all(h["healthy"] for h in agent_health.values())

    return {
        "all_healthy": all_healthy,
        "agents": agent_health,
        "total_agents": len(agents),
        "healthy_agents": sum(1 for h in agent_health.values() if h["healthy"]),
        "timestamp": datetime.utcnow().isoformat()
    }
