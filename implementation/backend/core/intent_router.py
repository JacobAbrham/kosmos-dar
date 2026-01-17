"""
KOSMOS V2.0 Intent Router

Unified system that combines Semantic Router with Global Tool Registry.
Maps user intents to appropriate agents AND their available tools.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Set, Tuple

import structlog

# NOTE: core.semantic_router imports are done lazily within methods to avoid circular imports
# The chain: intent_router -> semantic_router -> services -> agent_service -> agents -> langgraph_base -> intent_router

# Type-only imports (not evaluated at runtime)
if TYPE_CHECKING:
    from core.semantic_router import (
        RoutingContext,
        RoutingMethod,
        RoutingResult,
        SemanticRouter,
    )

from core.tool_registry import (
    GlobalToolRegistry,
    MCPTool,
    ToolCallResult,
    ToolCategory,
    get_tool_registry,
)

logger = structlog.get_logger()


@dataclass
class AgentCapability:
    """Describes an agent's capabilities and associated tools."""

    agent_id: str
    name: str
    domain: str
    description: str
    tool_categories: List[ToolCategory]
    primary_mcp_servers: List[str]
    fallback_mcp_servers: List[str] = field(default_factory=list)


@dataclass
class IntentResolution:
    """Complete resolution of an intent to agent and tools."""

    # From semantic routing
    routing_result: RoutingResult

    # Agent details
    agent_id: str
    agent_name: str
    agent_description: str

    # Available tools for this intent
    recommended_tools: List[MCPTool]
    all_available_tools: List[MCPTool]

    # Metadata
    resolution_latency_ms: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)


# Agent capability definitions
AGENT_CAPABILITIES: Dict[str, AgentCapability] = {
    "zeus": AgentCapability(
        agent_id="zeus",
        name="Zeus",
        domain="Orchestration & Supervision",
        description="Master orchestrator coordinating all agents, handles complex multi-step tasks",
        tool_categories=[ToolCategory.PRODUCTIVITY, ToolCategory.AI_REASONING],
        primary_mcp_servers=["kosmos-tools", "memory-server", "sequential-thinking"],
    ),
    "hermes": AgentCapability(
        agent_id="hermes",
        name="Hermes",
        domain="Communications",
        description="Email, messaging, notifications integration across all channels",
        tool_categories=[ToolCategory.COMMUNICATION],
        primary_mcp_servers=[
            "email-mcp",
            "slack-mcp",
            "whatsapp-mcp",
            "teams-mcp",
            "twilio-mcp",
            "sendgrid-mcp",
        ],
    ),
    "aegis": AgentCapability(
        agent_id="aegis",
        name="AEGIS",
        domain="Security",
        description="Security monitoring, threat detection, access control, compliance",
        tool_categories=[ToolCategory.SECURITY],
        primary_mcp_servers=["vault-mcp", "zitadel-mcp", "sentry-mcp"],
    ),
    "chronos": AgentCapability(
        agent_id="chronos",
        name="Chronos",
        domain="Scheduling & Time Management",
        description="Calendar, meetings, reminders, time-based orchestration",
        tool_categories=[ToolCategory.PRODUCTIVITY],
        primary_mcp_servers=["gcal-mcp", "notion-mcp"],
    ),
    "athena": AgentCapability(
        agent_id="athena",
        name="Athena",
        domain="Knowledge & RAG",
        description="Document search, knowledge retrieval, RAG operations, summarization",
        tool_categories=[ToolCategory.AI_REASONING, ToolCategory.DATABASE],
        primary_mcp_servers=[
            "postgres-mcp",
            "elasticsearch-mcp",
            "embeddings-mcp",
            "mongodb-mcp",
        ],
    ),
    "hephaestus": AgentCapability(
        agent_id="hephaestus",
        name="Hephaestus",
        domain="DevOps & Tooling",
        description="CI/CD, deployments, infrastructure, code operations",
        tool_categories=[ToolCategory.DEVOPS],
        primary_mcp_servers=[
            "github-mcp",
            "docker-mcp",
            "kubernetes-mcp",
            "terraform-mcp",
            "filesystem-mcp",
            "prometheus-mcp",
            "grafana-mcp",
        ],
    ),
    "nur_prometheus": AgentCapability(
        agent_id="nur_prometheus",
        name="Nur PROMETHEUS",
        domain="Analytics & Finance",
        description="Data analysis, business intelligence, payments, financial operations",
        tool_categories=[ToolCategory.ANALYTICS, ToolCategory.FINANCE],
        primary_mcp_servers=["stripe-mcp", "shopify-mcp", "square-mcp", "postgres-mcp"],
    ),
    "iris": AgentCapability(
        agent_id="iris",
        name="Iris",
        domain="Notifications & Alerts",
        description="Alert management, notification routing, escalation, urgent communications",
        tool_categories=[ToolCategory.COMMUNICATION],
        primary_mcp_servers=["slack-mcp", "email-mcp", "twilio-mcp"],
    ),
    "memorix": AgentCapability(
        agent_id="memorix",
        name="MEMORIX",
        domain="Memory & Context",
        description="Conversation memory, knowledge graph, context persistence",
        tool_categories=[ToolCategory.AI_REASONING, ToolCategory.DATABASE],
        primary_mcp_servers=["memory-server", "neo4j-mcp", "redis-mcp"],
    ),
    "hestia": AgentCapability(
        agent_id="hestia",
        name="Hestia",
        domain="Personal & Wellness",
        description="Personal data, preferences, wellness, ergonomic recommendations",
        tool_categories=[ToolCategory.PRODUCTIVITY],
        primary_mcp_servers=["notion-mcp"],
    ),
    "morpheus": AgentCapability(
        agent_id="morpheus",
        name="Morpheus",
        domain="Learning & Adaptation",
        description="User learning patterns, forecasting, personalization",
        tool_categories=[ToolCategory.AI_REASONING, ToolCategory.ANALYTICS],
        primary_mcp_servers=["langfuse-mcp", "openai-mcp", "anthropic-mcp"],
    ),
}


class IntentRouter:
    """
    Unified Intent Router that combines semantic routing with tool selection.

    This is the main entry point for processing user intents in KOSMOS.
    It routes to the appropriate agent AND provides the relevant tools.
    """

    _instance: Optional["IntentRouter"] = None

    def __new__(cls) -> "IntentRouter":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.semantic_router: Optional[SemanticRouter] = None
        self.tool_registry: Optional[GlobalToolRegistry] = None
        self.agent_capabilities = AGENT_CAPABILITIES

        # Cache for agent tools
        self._agent_tool_cache: Dict[str, List[MCPTool]] = {}
        self._cache_timestamp: Optional[datetime] = None

        # Metrics
        self._total_resolutions = 0
        self._successful_resolutions = 0
        self._total_latency_ms = 0.0

        self.logger = logger.bind(component="IntentRouter")
        self._initialized = True

    async def initialize(self) -> None:
        """Initialize the intent router with semantic router and tool registry."""
        self.logger.info("Initializing Intent Router...")

        # Lazy import to avoid circular dependency
        from core.semantic_router import get_semantic_router

        # Initialize sub-components
        self.semantic_router = await get_semantic_router()
        self.tool_registry = await get_tool_registry()

        # Build agent tool cache
        await self._build_agent_tool_cache()

        self.logger.info(
            "Intent Router initialized",
            agents=len(self.agent_capabilities),
            total_tools=len(self.tool_registry.tools),
        )

    async def _build_agent_tool_cache(self) -> None:
        """Build cache mapping agents to their available tools."""
        for agent_id, capability in self.agent_capabilities.items():
            tools = []

            # Get tools from primary MCP servers
            for server_name in capability.primary_mcp_servers:
                server_status = self.tool_registry.get_server_status(server_name)
                if server_status and "tools" in server_status:
                    for tool_name in server_status["tools"]:
                        tool_path = f"{server_name}.{tool_name}"
                        tool = self.tool_registry.get_tool(tool_path)
                        if tool:
                            tools.append(tool)

            # Get tools by category
            for category in capability.tool_categories:
                category_tools = self.tool_registry.get_tools_by_category(category)
                for tool in category_tools:
                    if tool not in tools:
                        tools.append(tool)

            self._agent_tool_cache[agent_id] = tools

        self._cache_timestamp = datetime.utcnow()

    async def resolve_intent(
        self, input_text: str, context: Optional[RoutingContext] = None
    ) -> IntentResolution:
        """
        Resolve user intent to agent and available tools.

        This is the main method for processing user input.

        Args:
            input_text: User input text
            context: Optional routing context

        Returns:
            IntentResolution with agent and tools
        """
        import time

        start_time = time.perf_counter()
        self._total_resolutions += 1

        # Get routing decision
        routing_result = await self.semantic_router.route(input_text, context)

        # Get agent capability
        agent_id = routing_result.selected_agent
        capability = self.agent_capabilities.get(agent_id)

        if not capability:
            # Fallback to Zeus if unknown agent
            capability = self.agent_capabilities["zeus"]
            agent_id = "zeus"

        # Get available tools for this agent
        all_tools = self._agent_tool_cache.get(agent_id, [])

        # Recommend specific tools based on intent
        recommended_tools = await self._recommend_tools(
            input_text, routing_result, all_tools
        )

        latency_ms = (time.perf_counter() - start_time) * 1000
        self._total_latency_ms += latency_ms
        self._successful_resolutions += 1

        return IntentResolution(
            routing_result=routing_result,
            agent_id=agent_id,
            agent_name=capability.name,
            agent_description=capability.description,
            recommended_tools=recommended_tools,
            all_available_tools=all_tools,
            resolution_latency_ms=latency_ms,
        )

    async def _recommend_tools(
        self,
        input_text: str,
        routing_result: RoutingResult,
        available_tools: List[MCPTool],
    ) -> List[MCPTool]:
        """
        Recommend specific tools based on intent.

        Uses semantic similarity to match tools to intent.
        """
        if not available_tools:
            return []

        # Use intent name to help filter tools
        intent_keywords = set()
        if routing_result.matched_intent_id:
            parts = routing_result.matched_intent_id.split(".")
            intent_keywords.update(parts)

        if routing_result.matched_intent_name:
            words = routing_result.matched_intent_name.lower().split()
            intent_keywords.update(words)

        # Score tools by keyword relevance
        scored_tools = []
        for tool in available_tools:
            score = 0

            # Check tool name overlap
            tool_words = set(
                tool.name.lower().replace("_", " ").replace("-", " ").split()
            )
            overlap = len(intent_keywords & tool_words)
            score += overlap * 2

            # Check description overlap
            if tool.description:
                desc_words = set(tool.description.lower().split())
                desc_overlap = len(intent_keywords & desc_words)
                score += desc_overlap

            # Check input text overlap
            input_words = set(input_text.lower().split())
            input_overlap = len(tool_words & input_words)
            score += input_overlap * 1.5

            scored_tools.append((tool, score))

        # Sort by score and return top tools
        scored_tools.sort(key=lambda x: x[1], reverse=True)

        # Return top 5 with non-zero score, or top 3 anyway
        recommended = [t for t, s in scored_tools if s > 0][:5]
        if not recommended:
            recommended = [t for t, _ in scored_tools[:3]]

        return recommended

    async def execute_tool(
        self, tool_path: str, params: Dict[str, Any], timeout: Optional[float] = None
    ) -> ToolCallResult:
        """
        Execute a tool through the registry.

        Args:
            tool_path: Full tool path (server.tool_name)
            params: Tool parameters
            timeout: Optional timeout

        Returns:
            ToolCallResult with result or error
        """
        return await self.tool_registry.call_tool(tool_path, params, timeout)

    def get_agent_capability(self, agent_id: str) -> Optional[AgentCapability]:
        """Get capability info for an agent."""
        return self.agent_capabilities.get(agent_id)

    def get_all_agents(self) -> List[AgentCapability]:
        """Get all agent capabilities."""
        return list(self.agent_capabilities.values())

    def get_agent_tools(self, agent_id: str) -> List[MCPTool]:
        """Get all tools available to an agent."""
        return self._agent_tool_cache.get(agent_id, [])

    def get_tools_by_category(self, category: ToolCategory) -> List[MCPTool]:
        """Get all tools in a specific category."""
        if self.tool_registry is None:
            self.logger.warning(
                f"Tool registry not initialized, cannot get tools for category {category}"
            )
            return []
        return self.tool_registry.get_tools_by_category(category)

    def get_tools_by_server(self, server_name: str) -> List[MCPTool]:
        """Get all tools from a specific MCP server."""
        if self.tool_registry is None:
            self.logger.warning(
                f"Tool registry not initialized, cannot get tools for server {server_name}"
            )
            return []
        return self.tool_registry.get_tools_by_server(server_name)

    def get_metrics(self) -> Dict[str, Any]:
        """Get intent router metrics."""
        total = self._total_resolutions or 1

        return {
            "total_resolutions": self._total_resolutions,
            "successful_resolutions": self._successful_resolutions,
            "success_rate": self._successful_resolutions / total,
            "avg_latency_ms": self._total_latency_ms / total,
            "semantic_router_metrics": (
                self.semantic_router.get_metrics() if self.semantic_router else {}
            ),
            "tool_registry_stats": (
                self.tool_registry.get_registry_stats() if self.tool_registry else {}
            ),
            "agents": len(self.agent_capabilities),
            "cached_tool_count": sum(len(t) for t in self._agent_tool_cache.values()),
        }

    async def refresh_tool_cache(self) -> None:
        """Refresh the agent-tool cache."""
        await self._build_agent_tool_cache()
        self.logger.info("Agent tool cache refreshed")


# API Models for FastAPI integration
@dataclass
class RouteRequest:
    """Request to route an intent."""

    text: str
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    previous_agent: Optional[str] = None


@dataclass
class RouteResponse:
    """Response from routing an intent."""

    agent_id: str
    agent_name: str
    confidence: float
    method: str
    intent_id: Optional[str]
    intent_name: Optional[str]
    recommended_tools: List[Dict[str, Any]]
    all_tools_count: int
    latency_ms: float
    explanation: str


class IntentRouterAPI:
    """
    API wrapper for IntentRouter to be used with FastAPI.

    Provides clean request/response models for HTTP endpoints.
    """

    def __init__(self, router: IntentRouter):
        self.router = router

    async def route(self, request: RouteRequest) -> RouteResponse:
        """Route an intent request."""
        # Lazy import to avoid circular dependency
        from core.semantic_router import RoutingContext

        context = RoutingContext(
            tenant_id=request.tenant_id,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            previous_agent=request.previous_agent,
        )

        resolution = await self.router.resolve_intent(request.text, context)

        return RouteResponse(
            agent_id=resolution.agent_id,
            agent_name=resolution.agent_name,
            confidence=resolution.routing_result.confidence,
            method=resolution.routing_result.method.value,
            intent_id=resolution.routing_result.matched_intent_id,
            intent_name=resolution.routing_result.matched_intent_name,
            recommended_tools=[
                {
                    "name": t.name,
                    "server": t.server,
                    "description": t.description,
                    "category": t.category.value,
                }
                for t in resolution.recommended_tools
            ],
            all_tools_count=len(resolution.all_available_tools),
            latency_ms=resolution.resolution_latency_ms,
            explanation=resolution.routing_result.explanation,
        )

    def get_agents(self) -> List[Dict[str, Any]]:
        """Get all agent capabilities."""
        return [
            {
                "id": cap.agent_id,
                "name": cap.name,
                "domain": cap.domain,
                "description": cap.description,
                "tool_categories": [c.value for c in cap.tool_categories],
                "mcp_servers": cap.primary_mcp_servers,
                "tools_count": len(self.router.get_agent_tools(cap.agent_id)),
            }
            for cap in self.router.get_all_agents()
        ]

    def get_agent_tools(self, agent_id: str) -> List[Dict[str, Any]]:
        """Get tools for a specific agent."""
        tools = self.router.get_agent_tools(agent_id)
        return [
            {
                "path": f"{t.server}.{t.name}",
                "name": t.name,
                "server": t.server,
                "description": t.description,
                "category": t.category.value,
                "input_schema": t.input_schema,
                "call_count": t.call_count,
                "avg_latency_ms": t.avg_latency_ms,
            }
            for t in tools
        ]

    def get_metrics(self) -> Dict[str, Any]:
        """Get router metrics."""
        return self.router.get_metrics()


# Singleton accessor
_intent_router: Optional[IntentRouter] = None


async def get_intent_router() -> IntentRouter:
    """Get the global intent router instance."""
    global _intent_router
    if _intent_router is None:
        _intent_router = IntentRouter()
        await _intent_router.initialize()
    return _intent_router
