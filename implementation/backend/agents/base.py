"""
KOSMOS V2.0 Base Agent

Abstract base class that all KOSMOS agents inherit from.
Integrated with Global Tool Registry (GTR) for dynamic MCP tool discovery.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Callable, Set
from uuid import UUID, uuid4

import structlog
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END

from core.config import settings
from core.messaging import AgentBus
from core.tool_registry import GlobalToolRegistry, ToolCategory, MCPTool, ToolCallResult
from core.circuit_breaker import CircuitBreakerRegistry, CircuitState

logger = structlog.get_logger()


class AgentState(str, Enum):
    """Agent lifecycle states."""
    INITIALIZING = "initializing"
    READY = "ready"
    PROCESSING = "processing"
    WAITING = "waiting"
    ERROR = "error"
    SHUTTING_DOWN = "shutting_down"
    STOPPED = "stopped"


@dataclass
class AgentConfig:
    """Configuration for an agent."""
    id: str
    name: str
    domain: str
    description: str
    tools: List[str] = field(default_factory=list)
    mcp_servers: List[str] = field(default_factory=list)
    tool_categories: List[str] = field(default_factory=list)  # NEW: Tool categories this agent can access
    pentarchy_voter: bool = False
    security_veto: bool = False
    max_iterations: int = 10
    timeout_seconds: int = 120


@dataclass
class AgentMessage:
    """Message format for inter-agent communication."""
    id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    from_agent: str = ""
    to_agent: str = ""
    message_type: str = "request"  # request, response, event, vote
    payload: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)
    trace_id: Optional[str] = None
    priority: str = "normal"


@dataclass
class AgentMetrics:
    """Metrics for agent performance tracking."""
    requests_total: int = 0
    requests_success: int = 0
    requests_failed: int = 0
    total_latency_ms: float = 0.0
    tool_calls: Dict[str, int] = field(default_factory=dict)
    mcp_calls: Dict[str, int] = field(default_factory=dict)  # NEW: MCP-specific metrics
    circuit_breaker_trips: int = 0  # NEW: Track circuit breaker activations

    @property
    def avg_latency_ms(self) -> float:
        if self.requests_total == 0:
            return 0.0
        return self.total_latency_ms / self.requests_total

    @property
    def success_rate(self) -> float:
        if self.requests_total == 0:
            return 0.0
        return self.requests_success / self.requests_total


class BaseAgent(ABC):
    """
    Abstract base class for all KOSMOS agents.

    All 11 KOSMOS agents inherit from this class and implement
    the required abstract methods.

    Integrated with:
    - Global Tool Registry (GTR) for dynamic MCP tool discovery
    - Circuit Breaker pattern for resilient tool calls
    - Automatic tool capability filtering by category
    """

    # Class-level shared instances
    _gtr: Optional[GlobalToolRegistry] = None
    _circuit_registry: Optional[CircuitBreakerRegistry] = None
    _initialized: bool = False

    def __init__(self, config: AgentConfig):
        self.config = config
        self.id = config.id
        self.name = config.name
        self.state = AgentState.INITIALIZING
        self.metrics = AgentMetrics()
        self.mcp_clients: Dict[str, Any] = {}
        self.tools: Dict[str, Callable] = {}
        self.bus: Optional[AgentBus] = None
        self._graph: Optional[StateGraph] = None

        # Tool categories this agent can access
        self._allowed_categories: Set[ToolCategory] = set()
        for cat_name in config.tool_categories:
            try:
                self._allowed_categories.add(ToolCategory(cat_name))
            except ValueError:
                pass  # Ignore invalid category names

        # Cache of available MCP tools for this agent
        self._mcp_tools: Dict[str, MCPTool] = {}

        self.logger = logger.bind(agent_id=self.id, agent_name=self.name)

    @classmethod
    async def _ensure_gtr_initialized(cls) -> GlobalToolRegistry:
        """Ensure the Global Tool Registry is initialized (singleton)."""
        if cls._gtr is None:
            cls._gtr = GlobalToolRegistry()
            await cls._gtr.initialize()
            cls._circuit_registry = CircuitBreakerRegistry()
            cls._initialized = True
            logger.info("Global Tool Registry initialized for all agents")
        return cls._gtr

    async def initialize(self) -> None:
        """Initialize the agent and its dependencies."""
        self.logger.info("Initializing agent...")

        try:
            # Initialize message bus
            self.bus = AgentBus(self.id)
            await self.bus.subscribe_requests(self._handle_request)

            # Initialize Global Tool Registry (shared)
            await self._ensure_gtr_initialized()

            # Initialize MCP clients via GTR
            await self._init_mcp_clients()

            # Discover available MCP tools for this agent
            await self._discover_mcp_tools()

            # Register local tools
            await self._register_tools()

            # Build LangGraph workflow
            self._graph = await self._build_graph()

            self.state = AgentState.READY
            self.logger.info(
                "Agent initialized successfully",
                mcp_tools=len(self._mcp_tools),
                local_tools=len(self.tools)
            )

        except Exception as e:
            self.state = AgentState.ERROR
            self.logger.error("Failed to initialize agent", error=str(e))
            raise

    async def _init_mcp_clients(self) -> None:
        """Initialize MCP server connections via Global Tool Registry."""
        if not self._gtr:
            return

        for server in self.config.mcp_servers:
            try:
                # Check if server is already registered in GTR
                if server in self._gtr.servers:
                    self.mcp_clients[server] = self._gtr.servers[server]
                    self.logger.info(f"Connected to MCP server via GTR: {server}")
                else:
                    self.logger.warning(f"MCP server not found in GTR: {server}")
            except Exception as e:
                self.logger.warning(f"Failed to connect to MCP server {server}: {e}")

    async def _discover_mcp_tools(self) -> None:
        """Discover and cache available MCP tools for this agent."""
        if not self._gtr:
            return

        # Get all tools this agent can access based on categories
        for category in self._allowed_categories:
            tools = self._gtr.get_tools_by_category(category)
            for tool in tools:
                self._mcp_tools[tool.path] = tool
                self.logger.debug(f"Discovered MCP tool: {tool.path}")

        # Also add tools from explicitly configured MCP servers
        for server in self.config.mcp_servers:
            server_tools = self._gtr.get_tools_by_server(server)
            for tool in server_tools:
                if tool.path not in self._mcp_tools:
                    self._mcp_tools[tool.path] = tool

        self.logger.info(f"Discovered {len(self._mcp_tools)} MCP tools")

    async def _register_tools(self) -> None:
        """Register agent tools."""
        # Get tools from config and register them
        for tool_name in self.config.tools:
            tool = self._get_tool(tool_name)
            if tool:
                self.tools[tool_name] = tool

    def _get_tool(self, tool_name: str) -> Optional[Callable]:
        """Get a tool by name. Override in subclasses."""
        return None

    @abstractmethod
    async def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow for this agent."""
        pass

    @abstractmethod
    async def process(self, message: AgentMessage) -> Dict[str, Any]:
        """
        Process an incoming message.

        This is the main entry point for agent logic.
        Must be implemented by each agent.
        """
        pass

    async def _handle_request(self, payload: dict) -> dict:
        """Handle incoming request from message bus."""
        import time
        start_time = time.perf_counter()

        self.metrics.requests_total += 1
        self.state = AgentState.PROCESSING

        try:
            message = AgentMessage(**payload)
            result = await self.process(message)

            self.metrics.requests_success += 1
            return {"success": True, "result": result}

        except Exception as e:
            self.metrics.requests_failed += 1
            self.logger.error("Error processing request", error=str(e))
            return {"success": False, "error": str(e)}

        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000
            self.metrics.total_latency_ms += duration_ms
            self.state = AgentState.READY

    async def call_tool(
        self,
        tool_name: str,
        params: Dict[str, Any]
    ) -> Any:
        """Execute a local tool with automatic metrics tracking."""
        self.logger.info(f"Calling tool: {tool_name}")

        if tool_name not in self.tools:
            raise ValueError(f"Unknown tool: {tool_name}")

        # Track metrics
        self.metrics.tool_calls[tool_name] = \
            self.metrics.tool_calls.get(tool_name, 0) + 1

        # Execute tool
        tool = self.tools[tool_name]
        return await tool(**params)

    async def call_mcp(
        self,
        tool_path: str,
        params: Dict[str, Any],
        timeout: Optional[float] = None
    ) -> ToolCallResult:
        """
        Call an MCP tool via the Global Tool Registry.

        Args:
            tool_path: Full tool path (e.g., "postgres-mcp/query")
            params: Tool parameters
            timeout: Optional timeout in seconds

        Returns:
            ToolCallResult with success status and data/error
        """
        if not self._gtr:
            raise RuntimeError("Global Tool Registry not initialized")

        # Check if tool is accessible to this agent
        if tool_path not in self._mcp_tools:
            # Try to parse and check by server
            parts = tool_path.split("/", 1)
            if len(parts) == 2:
                server, tool = parts
                if server not in self.config.mcp_servers:
                    raise ValueError(
                        f"Tool '{tool_path}' not accessible to agent '{self.name}'. "
                        f"Add server '{server}' to mcp_servers or appropriate category to tool_categories."
                    )
            else:
                raise ValueError(f"Invalid tool path: {tool_path}")

        self.logger.info(f"Calling MCP tool: {tool_path}")

        # Track metrics
        self.metrics.mcp_calls[tool_path] = \
            self.metrics.mcp_calls.get(tool_path, 0) + 1

        # Check circuit breaker state
        if self._circuit_registry:
            server = tool_path.split("/")[0]
            breaker = self._circuit_registry.get(server)
            if breaker and breaker.state == CircuitState.OPEN:
                self.metrics.circuit_breaker_trips += 1
                self.logger.warning(f"Circuit breaker OPEN for server: {server}")
                return ToolCallResult(
                    success=False,
                    error=f"Circuit breaker is OPEN for {server}. Service temporarily unavailable.",
                    tool_path=tool_path
                )

        # Call via GTR (includes circuit breaker protection)
        result = await self._gtr.call_tool(
            tool_path=tool_path,
            params=params,
            timeout=timeout or self.config.timeout_seconds
        )

        if not result.success:
            self.logger.warning(f"MCP tool call failed: {tool_path}", error=result.error)

        return result

    async def call_mcp_simple(
        self,
        server: str,
        tool: str,
        params: Dict[str, Any]
    ) -> Any:
        """
        Simplified MCP call that returns data directly or raises exception.

        Args:
            server: MCP server name (e.g., "postgres-mcp")
            tool: Tool name (e.g., "query")
            params: Tool parameters

        Returns:
            Tool result data

        Raises:
            RuntimeError: If tool call fails
        """
        result = await self.call_mcp(f"{server}/{tool}", params)
        if not result.success:
            raise RuntimeError(f"MCP call failed: {result.error}")
        return result.data

    def get_available_mcp_tools(self) -> List[Dict[str, Any]]:
        """Get list of MCP tools available to this agent."""
        return [
            {
                "path": tool.path,
                "name": tool.name,
                "description": tool.description,
                "server": tool.server_name,
                "category": tool.category.value if tool.category else None,
                "schema": tool.input_schema
            }
            for tool in self._mcp_tools.values()
        ]

    def get_tools_for_llm(self) -> List[Dict[str, Any]]:
        """
        Get tool definitions formatted for LLM function calling.

        Returns list suitable for OpenAI/Anthropic tool definitions.
        """
        tools = []

        # Add local tools
        for name, func in self.tools.items():
            doc = func.__doc__ or f"Execute {name}"
            tools.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": doc.strip(),
                    "parameters": getattr(func, "_schema", {"type": "object", "properties": {}})
                }
            })

        # Add MCP tools
        for tool in self._mcp_tools.values():
            tools.append({
                "type": "function",
                "function": {
                    "name": tool.path.replace("/", "_"),  # Convert path to valid function name
                    "description": tool.description,
                    "parameters": tool.input_schema or {"type": "object", "properties": {}}
                }
            })

        return tools

    async def delegate_to(
        self,
        agent_id: str,
        payload: Dict[str, Any],
        timeout: float = 30.0
    ) -> Optional[Dict[str, Any]]:
        """Delegate a task to another agent."""
        if not self.bus:
            raise RuntimeError("Message bus not initialized")

        self.logger.info(f"Delegating to agent: {agent_id}")
        return await self.bus.publish_request(agent_id, payload, timeout)

    async def emit_event(
        self,
        event_type: str,
        payload: Dict[str, Any]
    ) -> None:
        """Emit an event to the event stream."""
        if not self.bus:
            raise RuntimeError("Message bus not initialized")

        await self.bus.publish_event(event_type, {
            "source_agent": self.id,
            "event_type": event_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat()
        })

    async def shutdown(self) -> None:
        """Gracefully shutdown the agent."""
        self.logger.info("Shutting down agent...")
        self.state = AgentState.SHUTTING_DOWN

        # Clear MCP tool cache
        self._mcp_tools.clear()

        # Close MCP connections (GTR manages actual connections)
        self.mcp_clients.clear()

        # Close message bus
        if self.bus:
            await self.bus.close()

        self.state = AgentState.STOPPED
        self.logger.info("Agent shutdown complete")

    def get_status(self) -> Dict[str, Any]:
        """Get agent status information."""
        return {
            "id": self.id,
            "name": self.name,
            "domain": self.config.domain,
            "state": self.state.value,
            "capabilities": {
                "mcp_servers": self.config.mcp_servers,
                "tool_categories": [c.value for c in self._allowed_categories],
                "available_mcp_tools": len(self._mcp_tools),
                "local_tools": len(self.tools)
            },
            "metrics": {
                "requests_total": self.metrics.requests_total,
                "requests_success": self.metrics.requests_success,
                "requests_failed": self.metrics.requests_failed,
                "avg_latency_ms": round(self.metrics.avg_latency_ms, 2),
                "success_rate": round(self.metrics.success_rate, 4),
                "tool_calls": self.metrics.tool_calls,
                "mcp_calls": self.metrics.mcp_calls,
                "circuit_breaker_trips": self.metrics.circuit_breaker_trips
            }
        }

    def get_circuit_breaker_status(self) -> Dict[str, Any]:
        """Get circuit breaker status for all MCP servers this agent uses."""
        if not self._circuit_registry:
            return {}

        status = {}
        for server in self.config.mcp_servers:
            breaker = self._circuit_registry.get(server)
            if breaker:
                status[server] = {
                    "state": breaker.state.value,
                    "failure_count": breaker.failure_count,
                    "success_count": breaker.success_count,
                    "last_failure": breaker.last_failure_time.isoformat() if breaker.last_failure_time else None
                }
        return status
