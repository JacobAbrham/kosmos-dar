"""
KOSMOS V2.0 Tools API

Endpoints for Global Tool Registry management and tool execution.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from core.tool_registry import (
    GlobalToolRegistry,
    MCPTool,
    ToolCategory,
    ToolCallResult,
    MCPServerConfig,
    get_tool_registry
)

router = APIRouter(prefix="/api/v1/tools", tags=["tools"])


# ============================================================================
# Request/Response Models
# ============================================================================

class ToolDefinition(BaseModel):
    """Tool definition."""
    path: str
    name: str
    server: str
    description: str
    category: str
    input_schema: Dict[str, Any]
    call_count: int
    avg_latency_ms: float
    last_error: Optional[str]


class ToolExecuteRequest(BaseModel):
    """Request to execute a tool."""
    tool_path: str = Field(..., description="Full tool path (server.tool_name)")
    params: Dict[str, Any] = Field(default={}, description="Tool parameters")
    timeout: Optional[float] = Field(None, description="Timeout in seconds")


class ToolExecuteResponse(BaseModel):
    """Response from tool execution."""
    success: bool
    result: Any
    latency_ms: float
    error: Optional[str]
    retries: int


class ServerStatus(BaseModel):
    """MCP server status."""
    name: str
    enabled: bool
    category: str
    description: str
    circuit_breaker: str
    tools_count: int
    tools: List[str]
    total_calls: int
    avg_latency_ms: float


class RegistryStats(BaseModel):
    """Tool registry statistics."""
    total_servers: int
    enabled_servers: int
    total_tools: int
    tools_by_category: Dict[str, int]
    total_calls: int
    circuit_breakers: Dict[str, str]


# ============================================================================
# Dependencies
# ============================================================================

async def get_registry() -> GlobalToolRegistry:
    """Dependency to get tool registry."""
    return await get_tool_registry()


# ============================================================================
# Tool Endpoints
# ============================================================================

@router.get("/", response_model=List[ToolDefinition])
async def list_tools(
    category: Optional[str] = Query(None, description="Filter by category"),
    server: Optional[str] = Query(None, description="Filter by server"),
    search: Optional[str] = Query(None, description="Search in name/description"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """
    List all registered tools.

    Supports filtering by category, server, and search term.
    """
    tools = registry.list_all_tools()

    # Filter by category
    if category:
        try:
            cat = ToolCategory(category)
            tools = [t for t in tools if t.category == cat]
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

    # Filter by server
    if server:
        tools = [t for t in tools if t.server == server]

    # Search filter
    if search:
        search_lower = search.lower()
        tools = [
            t for t in tools
            if search_lower in t.name.lower() or search_lower in t.description.lower()
        ]

    # Pagination
    total = len(tools)
    tools = tools[offset:offset + limit]

    return [
        ToolDefinition(
            path=f"{t.server}.{t.name}",
            name=t.name,
            server=t.server,
            description=t.description,
            category=t.category.value,
            input_schema=t.input_schema,
            call_count=t.call_count,
            avg_latency_ms=t.avg_latency_ms,
            last_error=t.last_error
        )
        for t in tools
    ]


@router.get("/{tool_path:path}", response_model=ToolDefinition)
async def get_tool(
    tool_path: str,
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """Get a specific tool by its path."""
    tool = registry.get_tool(tool_path)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool not found: {tool_path}")

    return ToolDefinition(
        path=f"{tool.server}.{tool.name}",
        name=tool.name,
        server=tool.server,
        description=tool.description,
        category=tool.category.value,
        input_schema=tool.input_schema,
        call_count=tool.call_count,
        avg_latency_ms=tool.avg_latency_ms,
        last_error=tool.last_error
    )


@router.post("/execute", response_model=ToolExecuteResponse)
async def execute_tool(
    request: ToolExecuteRequest,
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """
    Execute a tool.

    Calls the tool through the MCP server and returns the result.
    """
    result = await registry.call_tool(
        tool_path=request.tool_path,
        params=request.params,
        timeout=request.timeout
    )

    return ToolExecuteResponse(
        success=result.success,
        result=result.result,
        latency_ms=result.latency_ms,
        error=result.error,
        retries=result.retries
    )


@router.get("/categories/list")
async def list_categories():
    """List all tool categories."""
    return {
        "categories": [
            {"id": cat.value, "name": cat.name}
            for cat in ToolCategory
        ]
    }


@router.get("/categories/{category}", response_model=List[ToolDefinition])
async def get_tools_by_category(
    category: str,
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """Get all tools in a specific category."""
    try:
        cat = ToolCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

    tools = registry.get_tools_by_category(cat)

    return [
        ToolDefinition(
            path=f"{t.server}.{t.name}",
            name=t.name,
            server=t.server,
            description=t.description,
            category=t.category.value,
            input_schema=t.input_schema,
            call_count=t.call_count,
            avg_latency_ms=t.avg_latency_ms,
            last_error=t.last_error
        )
        for t in tools
    ]


# ============================================================================
# Server Endpoints
# ============================================================================

@router.get("/servers/list", response_model=List[ServerStatus])
async def list_servers(
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """List all MCP servers and their status."""
    servers = registry.list_servers()

    return [
        ServerStatus(**registry.get_server_status(s.name))
        for s in servers
    ]


@router.get("/servers/{server_name}", response_model=ServerStatus)
async def get_server_status(
    server_name: str,
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """Get status of a specific MCP server."""
    status = registry.get_server_status(server_name)
    if "error" in status:
        raise HTTPException(status_code=404, detail=status["error"])

    return ServerStatus(**status)


@router.post("/servers/{server_name}/refresh")
async def refresh_server(
    server_name: str,
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """Refresh tools from a specific MCP server."""
    success = await registry.refresh_server(server_name)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to refresh server: {server_name}")

    return {
        "status": "refreshed",
        "server": server_name,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/servers/refresh-all")
async def refresh_all_servers(
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """Refresh all MCP servers."""
    await registry.discover_all_tools()

    return {
        "status": "refreshed",
        "servers": len(registry.servers),
        "tools": len(registry.tools),
        "timestamp": datetime.utcnow().isoformat()
    }


# ============================================================================
# Registry Stats
# ============================================================================

@router.get("/stats", response_model=RegistryStats)
async def get_registry_stats(
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """Get overall registry statistics."""
    stats = registry.get_registry_stats()
    return RegistryStats(**stats)


@router.get("/health")
async def tools_health(
    registry: GlobalToolRegistry = Depends(get_registry)
):
    """Check tool registry health."""
    stats = registry.get_registry_stats()

    # Check for open circuit breakers
    open_circuits = [
        name for name, state in stats["circuit_breakers"].items()
        if state == "open"
    ]

    is_healthy = (
        stats["enabled_servers"] > 0 and
        stats["total_tools"] > 0 and
        len(open_circuits) < stats["enabled_servers"] / 2
    )

    return {
        "healthy": is_healthy,
        "total_servers": stats["total_servers"],
        "enabled_servers": stats["enabled_servers"],
        "total_tools": stats["total_tools"],
        "open_circuit_breakers": open_circuits,
        "timestamp": datetime.utcnow().isoformat()
    }
