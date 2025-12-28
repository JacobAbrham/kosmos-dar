"""
KOSMOS V2.0 Global Tool Registry

Central registry for dynamic MCP tool discovery and management.
Enables plug-and-play integration of new services without code changes.
"""

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set

import structlog
from core.circuit_breaker import CircuitBreaker, CircuitState
from core.config import settings
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = structlog.get_logger()


class ToolCategory(str, Enum):
    """Categories for MCP tools."""

    COMMUNICATION = "communication"
    FINANCE = "finance"
    PRODUCTIVITY = "productivity"
    DEVOPS = "devops"
    AI_REASONING = "ai_reasoning"
    DATABASE = "database"
    SECURITY = "security"
    ANALYTICS = "analytics"
    SYSTEM = "system"
    STORAGE = "storage"
    CALENDAR = "calendar"
    DEVELOPMENT = "development"
    FILESYSTEM = "filesystem"
    DATA_PROCESSING = "data_processing"


@dataclass
class MCPServerConfig:
    """Configuration for an MCP server."""

    name: str
    command: str
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    cwd: Optional[str] = None
    category: ToolCategory = ToolCategory.PRODUCTIVITY
    description: str = ""
    timeout_seconds: int = 30
    max_retries: int = 3
    enabled: bool = True


@dataclass
class MCPTool:
    """Represents a discovered MCP tool."""

    name: str
    server: str
    description: str
    input_schema: Dict[str, Any]
    category: ToolCategory
    discovered_at: datetime = field(default_factory=datetime.utcnow)
    call_count: int = 0
    avg_latency_ms: float = 0.0
    last_error: Optional[str] = None

    @property
    def path(self) -> str:
        """Return the full path to the tool (server/name)."""
        return f"{self.server}/{self.name}"


@dataclass
class ToolCallResult:
    """Result of a tool call."""

    success: bool
    result: Any
    latency_ms: float
    error: Optional[str] = None
    retries: int = 0


class GlobalToolRegistry:
    """
    Central registry for all MCP tools across the KOSMOS ecosystem.

    Features:
    - Dynamic tool discovery from MCP servers
    - Circuit breaker pattern for resilience
    - Tool caching and hot-reloading
    - Metrics and monitoring
    - Category-based tool filtering
    """

    _instance: Optional["GlobalToolRegistry"] = None

    def __new__(cls) -> "GlobalToolRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.servers: Dict[str, MCPServerConfig] = {}
        self.tools: Dict[str, MCPTool] = {}
        self.sessions: Dict[str, ClientSession] = {}
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self._tool_index: Dict[ToolCategory, Set[str]] = {
            cat: set() for cat in ToolCategory
        }
        self._discovery_lock = asyncio.Lock()
        self._initialized = True

        self.logger = logger.bind(component="GlobalToolRegistry")

    async def initialize(self) -> None:
        """Initialize the registry and discover all tools."""
        self.logger.info("Initializing Global Tool Registry...")

        # Load server configurations
        await self._load_server_configs()

        # Discover tools from all servers
        await self.discover_all_tools()

        self.logger.info(
            "Global Tool Registry initialized",
            servers=len(self.servers),
            tools=len(self.tools),
        )

    async def _load_server_configs(self) -> None:
        """Load MCP server configurations."""
        # Default server configurations
        default_servers = [
            # Core KOSMOS tools
            MCPServerConfig(
                name="kosmos-tools",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/kosmos-tools",
                category=ToolCategory.PRODUCTIVITY,
                description="Core KOSMOS tools for cost estimation, routing, and governance",
            ),
            MCPServerConfig(
                name="memory-server",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/memory-server",
                category=ToolCategory.AI_REASONING,
                description="Memory management for episodic, semantic, and procedural memory",
            ),
            # Database
            MCPServerConfig(
                name="postgres-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/postgres-mcp",
                category=ToolCategory.DATABASE,
                description="PostgreSQL database operations",
            ),
            # Communication
            MCPServerConfig(
                name="email-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/email-mcp",
                category=ToolCategory.COMMUNICATION,
                description="Email via IMAP/SMTP",
            ),
            MCPServerConfig(
                name="slack-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/slack-mcp",
                category=ToolCategory.COMMUNICATION,
                description="Slack workspace integration",
            ),
            MCPServerConfig(
                name="whatsapp-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/whatsapp-mcp",
                category=ToolCategory.COMMUNICATION,
                description="WhatsApp Business API",
            ),
            # Productivity
            MCPServerConfig(
                name="gcal-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/gcal-mcp",
                category=ToolCategory.PRODUCTIVITY,
                description="Google Calendar integration",
            ),
            MCPServerConfig(
                name="notion-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/notion-mcp",
                category=ToolCategory.PRODUCTIVITY,
                description="Notion workspace integration",
            ),
            MCPServerConfig(
                name="gdrive-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/gdrive-mcp",
                category=ToolCategory.PRODUCTIVITY,
                description="Google Drive file management",
            ),
            # DevOps
            MCPServerConfig(
                name="github-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/github-mcp",
                category=ToolCategory.DEVOPS,
                description="GitHub repository management",
            ),
            MCPServerConfig(
                name="filesystem-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/filesystem-mcp",
                category=ToolCategory.DEVOPS,
                description="Local filesystem operations",
            ),
            # Finance
            MCPServerConfig(
                name="finance-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/finance-mcp",
                category=ToolCategory.FINANCE,
                description="Banking and payment APIs",
            ),
            MCPServerConfig(
                name="timescale-mcp",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/timescale-mcp",
                category=ToolCategory.ANALYTICS,
                description="Time-series analytics",
            ),
            # AI/Reasoning
            MCPServerConfig(
                name="sequential-thinking",
                command="npx",
                args=["tsx", "src/index.ts"],
                cwd="../mcp-servers/sequential-thinking",
                category=ToolCategory.AI_REASONING,
                description="Step-by-step reasoning engine",
            ),
        ]

        for server in default_servers:
            self.servers[server.name] = server
            self.circuit_breakers[server.name] = CircuitBreaker(
                name=server.name,
                failure_threshold=5,
                recovery_timeout=timedelta(seconds=60),
            )

    async def discover_all_tools(self) -> None:
        """Discover tools from all registered MCP servers."""
        async with self._discovery_lock:
            tasks = []
            for server_name, config in self.servers.items():
                if config.enabled:
                    tasks.append(self._discover_server_tools(server_name, config))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for server_name, result in zip(self.servers.keys(), results):
                if isinstance(result, Exception):
                    self.logger.warning(
                        f"Failed to discover tools from {server_name}",
                        error=str(result),
                    )

    async def _discover_server_tools(
        self, server_name: str, config: MCPServerConfig
    ) -> List[MCPTool]:
        """Discover tools from a single MCP server."""
        try:
            # Check circuit breaker
            cb = self.circuit_breakers.get(server_name)
            if cb and cb.state == CircuitState.OPEN:
                self.logger.warning(f"Circuit breaker open for {server_name}")
                return []

            # Connect to MCP server
            server_params = StdioServerParameters(
                command=config.command,
                args=config.args,
                env=config.env or None,
                cwd=config.cwd,
            )

            async with stdio_client(server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    # Initialize and list tools
                    await session.initialize()
                    tools_response = await session.list_tools()

                    # Store session for later use
                    self.sessions[server_name] = session

                    # Register discovered tools
                    discovered = []
                    for tool in tools_response.tools:
                        mcp_tool = MCPTool(
                            name=tool.name,
                            server=server_name,
                            description=tool.description or "",
                            input_schema=tool.inputSchema or {},
                            category=config.category,
                        )

                        full_name = f"{server_name}.{tool.name}"
                        self.tools[full_name] = mcp_tool
                        self._tool_index[config.category].add(full_name)
                        discovered.append(mcp_tool)

                    self.logger.info(
                        f"Discovered {len(discovered)} tools from {server_name}"
                    )

                    if cb:
                        cb.record_success()

                    return discovered

        except Exception as e:
            self.logger.error(
                f"Error discovering tools from {server_name}", error=str(e)
            )
            if cb:
                cb.record_failure()
            raise

    async def call_tool(
        self, tool_path: str, params: Dict[str, Any], timeout: Optional[float] = None
    ) -> ToolCallResult:
        """
        Execute a tool by its full path (server.tool_name).

        Args:
            tool_path: Full tool path (e.g., "postgres-mcp.query")
            params: Tool parameters
            timeout: Optional timeout override

        Returns:
            ToolCallResult with success status and result
        """
        import time

        start_time = time.perf_counter()

        # Parse tool path
        if "." not in tool_path:
            return ToolCallResult(
                success=False,
                result=None,
                latency_ms=0,
                error=f"Invalid tool path: {tool_path}. Expected 'server.tool_name'",
            )

        server_name, tool_name = tool_path.rsplit(".", 1)

        # Check if tool exists
        if tool_path not in self.tools:
            return ToolCallResult(
                success=False,
                result=None,
                latency_ms=0,
                error=f"Unknown tool: {tool_path}",
            )

        # Check circuit breaker
        cb = self.circuit_breakers.get(server_name)
        if cb and cb.state == CircuitState.OPEN:
            return ToolCallResult(
                success=False,
                result=None,
                latency_ms=0,
                error=f"Circuit breaker open for {server_name}",
            )

        # Get tool metadata
        tool = self.tools[tool_path]
        config = self.servers.get(server_name)
        actual_timeout = timeout or (config.timeout_seconds if config else 30)

        try:
            # Get or create session
            session = self.sessions.get(server_name)
            if not session:
                # Reconnect to server
                await self._discover_server_tools(server_name, config)
                session = self.sessions.get(server_name)

            if not session:
                raise RuntimeError(f"Cannot connect to server: {server_name}")

            # Call the tool with timeout
            result = await asyncio.wait_for(
                session.call_tool(tool_name, params), timeout=actual_timeout
            )

            latency_ms = (time.perf_counter() - start_time) * 1000

            # Update metrics
            tool.call_count += 1
            tool.avg_latency_ms = (
                tool.avg_latency_ms * (tool.call_count - 1) + latency_ms
            ) / tool.call_count
            tool.last_error = None

            if cb:
                cb.record_success()

            # Parse result
            if result.content:
                content = result.content[0]
                if hasattr(content, "text"):
                    try:
                        parsed = json.loads(content.text)
                    except json.JSONDecodeError:
                        parsed = content.text
                else:
                    parsed = content
            else:
                parsed = None

            return ToolCallResult(success=True, result=parsed, latency_ms=latency_ms)

        except asyncio.TimeoutError:
            latency_ms = (time.perf_counter() - start_time) * 1000
            error = f"Tool call timed out after {actual_timeout}s"
            tool.last_error = error
            if cb:
                cb.record_failure()
            return ToolCallResult(
                success=False, result=None, latency_ms=latency_ms, error=error
            )

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            error = str(e)
            tool.last_error = error
            if cb:
                cb.record_failure()
            return ToolCallResult(
                success=False, result=None, latency_ms=latency_ms, error=error
            )

    def get_tools_by_category(self, category: ToolCategory) -> List[MCPTool]:
        """Get all tools in a category."""
        tool_names = self._tool_index.get(category, set())
        return [self.tools[name] for name in tool_names if name in self.tools]

    def get_tools_by_server(self, server_name: str) -> List[MCPTool]:
        """Get all tools from a specific server."""
        return [t for t in self.tools.values() if t.server == server_name]

    def get_tool(self, tool_path: str) -> Optional[MCPTool]:
        """Get a tool by its full path."""
        return self.tools.get(tool_path)

    def list_all_tools(self) -> List[MCPTool]:
        """List all registered tools."""
        return list(self.tools.values())

    def list_servers(self) -> List[MCPServerConfig]:
        """List all registered servers."""
        return list(self.servers.values())

    def get_server_status(self, server_name: str) -> Dict[str, Any]:
        """Get status of a specific server."""
        config = self.servers.get(server_name)
        cb = self.circuit_breakers.get(server_name)

        if not config:
            return {"error": f"Unknown server: {server_name}"}

        server_tools = [t for t in self.tools.values() if t.server == server_name]

        return {
            "name": server_name,
            "enabled": config.enabled,
            "category": config.category.value,
            "description": config.description,
            "circuit_breaker": cb.state.value if cb else "unknown",
            "tools_count": len(server_tools),
            "tools": [t.name for t in server_tools],
            "total_calls": sum(t.call_count for t in server_tools),
            "avg_latency_ms": (
                sum(t.avg_latency_ms for t in server_tools) / len(server_tools)
                if server_tools
                else 0
            ),
        }

    def get_registry_stats(self) -> Dict[str, Any]:
        """Get overall registry statistics."""
        return {
            "total_servers": len(self.servers),
            "enabled_servers": sum(1 for s in self.servers.values() if s.enabled),
            "total_tools": len(self.tools),
            "tools_by_category": {
                cat.value: len(tools) for cat, tools in self._tool_index.items()
            },
            "total_calls": sum(t.call_count for t in self.tools.values()),
            "circuit_breakers": {
                name: cb.state.value for name, cb in self.circuit_breakers.items()
            },
        }

    async def refresh_server(self, server_name: str) -> bool:
        """Refresh tools from a specific server."""
        config = self.servers.get(server_name)
        if not config:
            return False

        # Remove existing tools from this server
        tools_to_remove = [
            path for path, tool in self.tools.items() if tool.server == server_name
        ]
        for path in tools_to_remove:
            del self.tools[path]
            for cat_tools in self._tool_index.values():
                cat_tools.discard(path)

        # Close existing session
        if server_name in self.sessions:
            del self.sessions[server_name]

        # Rediscover
        try:
            await self._discover_server_tools(server_name, config)
            return True
        except Exception:
            return False

    async def shutdown(self) -> None:
        """Shutdown all connections."""
        self.logger.info("Shutting down Global Tool Registry...")

        for server_name, session in self.sessions.items():
            try:
                # Session cleanup if needed
                pass
            except Exception as e:
                self.logger.warning(
                    f"Error closing session for {server_name}", error=str(e)
                )

        self.sessions.clear()
        self.logger.info("Global Tool Registry shutdown complete")


# Singleton accessor
_registry: Optional[GlobalToolRegistry] = None


async def get_tool_registry() -> GlobalToolRegistry:
    """Get the global tool registry instance."""
    global _registry
    if _registry is None:
        _registry = GlobalToolRegistry()
        await _registry.initialize()
    return _registry
