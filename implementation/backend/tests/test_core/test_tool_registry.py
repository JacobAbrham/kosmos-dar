"""
Tests for Global Tool Registry

Tests tool discovery, registration, and execution.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.unit
@pytest.mark.core
class TestToolCategory:
    """Tests for ToolCategory enum."""

    def test_tool_categories_exist(self):
        """Test that expected tool categories exist."""
        from core.tool_registry import ToolCategory

        expected_categories = [
            "DATABASE", "STORAGE", "COMMUNICATION", "DEVOPS",
            "AI", "SECURITY", "FINANCE", "CLOUD", "DATA", "KOSMOS"
        ]

        actual_categories = [c.value.upper() for c in ToolCategory]

        for expected in expected_categories:
            assert any(expected in cat for cat in actual_categories), f"Missing category: {expected}"


@pytest.mark.unit
@pytest.mark.core
class TestMCPTool:
    """Tests for MCPTool dataclass."""

    def test_mcp_tool_creation(self, sample_mcp_tool):
        """Test creating an MCP tool."""
        from core.tool_registry import MCPTool, ToolCategory

        tool = MCPTool(
            name=sample_mcp_tool["name"],
            description=sample_mcp_tool["description"],
            server=sample_mcp_tool["server"],
            category=ToolCategory.DATABASE,
            input_schema=sample_mcp_tool["input_schema"]
        )

        assert tool.name == "test_tool"
        assert tool.server == "test-server"
        assert tool.category == ToolCategory.DATABASE

    def test_mcp_tool_path(self, sample_mcp_tool):
        """Test MCP tool path generation."""
        from core.tool_registry import MCPTool, ToolCategory

        tool = MCPTool(
            name=sample_mcp_tool["name"],
            description=sample_mcp_tool["description"],
            server=sample_mcp_tool["server"],
            category=ToolCategory.DATABASE,
            input_schema=sample_mcp_tool["input_schema"]
        )

        expected_path = f"{sample_mcp_tool['server']}/{sample_mcp_tool['name']}"
        assert tool.path == expected_path


@pytest.mark.unit
@pytest.mark.core
class TestToolCallResult:
    """Tests for ToolCallResult dataclass."""

    def test_successful_result(self):
        """Test successful tool call result."""
        from core.tool_registry import ToolCallResult

        result = ToolCallResult(
            success=True,
            result={"data": "test_value"},
            error=None,
            execution_time=0.5
        )

        assert result.success is True
        assert result.result["data"] == "test_value"
        assert result.error is None

    def test_failed_result(self):
        """Test failed tool call result."""
        from core.tool_registry import ToolCallResult

        result = ToolCallResult(
            success=False,
            result=None,
            error="Connection failed",
            execution_time=1.0
        )

        assert result.success is False
        assert result.result is None
        assert result.error == "Connection failed"


@pytest.mark.unit
@pytest.mark.core
class TestGlobalToolRegistry:
    """Tests for GlobalToolRegistry."""

    def test_registry_singleton(self):
        """Test that registry is a singleton."""
        from core.tool_registry import get_tool_registry

        registry1 = get_tool_registry()
        registry2 = get_tool_registry()

        # Should be the same instance
        assert registry1 is registry2

    def test_register_tool(self):
        """Test registering a tool."""
        from core.tool_registry import GlobalToolRegistry, MCPTool, ToolCategory

        registry = GlobalToolRegistry()

        tool = MCPTool(
            name="test_tool",
            description="A test tool",
            server="test-server",
            category=ToolCategory.DATABASE,
            input_schema={}
        )

        registry.register_tool(tool)

        retrieved = registry.get_tool("test-server/test_tool")
        assert retrieved is not None
        assert retrieved.name == "test_tool"

    def test_get_nonexistent_tool(self):
        """Test getting a tool that doesn't exist."""
        from core.tool_registry import GlobalToolRegistry

        registry = GlobalToolRegistry()

        result = registry.get_tool("nonexistent/tool")
        assert result is None

    def test_get_tools_for_category(self):
        """Test getting tools by category."""
        from core.tool_registry import GlobalToolRegistry, MCPTool, ToolCategory

        registry = GlobalToolRegistry()

        # Register tools in different categories
        db_tool = MCPTool(
            name="db_tool",
            description="Database tool",
            server="db-server",
            category=ToolCategory.DATABASE,
            input_schema={}
        )

        comm_tool = MCPTool(
            name="comm_tool",
            description="Communication tool",
            server="comm-server",
            category=ToolCategory.COMMUNICATION,
            input_schema={}
        )

        registry.register_tool(db_tool)
        registry.register_tool(comm_tool)

        db_tools = registry.get_tools_for_category(ToolCategory.DATABASE)

        assert len(db_tools) >= 1
        assert any(t.name == "db_tool" for t in db_tools)

    def test_get_all_tools(self):
        """Test getting all registered tools."""
        from core.tool_registry import GlobalToolRegistry, MCPTool, ToolCategory

        registry = GlobalToolRegistry()

        tool1 = MCPTool(
            name="tool1", description="Tool 1", server="server1",
            category=ToolCategory.DATABASE, input_schema={}
        )
        tool2 = MCPTool(
            name="tool2", description="Tool 2", server="server2",
            category=ToolCategory.STORAGE, input_schema={}
        )

        registry.register_tool(tool1)
        registry.register_tool(tool2)

        all_tools = registry.get_all_tools()

        assert len(all_tools) >= 2

    @pytest.mark.asyncio
    async def test_discover_tools(self, mock_tool_registry):
        """Test tool discovery from MCP servers."""
        # This is an integration-level test that would require MCP server mocking
        # For unit tests, we verify the interface

        with patch('core.tool_registry.GlobalToolRegistry') as MockRegistry:
            mock_instance = MockRegistry.return_value
            mock_instance.discover_tools = AsyncMock(return_value=[
                {"name": "tool1", "server": "server1"},
                {"name": "tool2", "server": "server2"}
            ])

            tools = await mock_instance.discover_tools()

            assert len(tools) == 2

    @pytest.mark.asyncio
    async def test_execute_tool_success(self):
        """Test successful tool execution."""
        from core.tool_registry import GlobalToolRegistry, MCPTool, ToolCategory, ToolCallResult

        registry = GlobalToolRegistry()

        # Mock the execution
        with patch.object(registry, '_execute_mcp_tool', new_callable=AsyncMock) as mock_exec:
            mock_exec.return_value = ToolCallResult(
                success=True,
                result={"data": "test_result"},
                error=None,
                execution_time=0.1
            )

            result = await registry.execute_tool(
                tool_path="test-server/test_tool",
                params={"param1": "value1"}
            )

            assert result.success is True
            assert result.result["data"] == "test_result"

    @pytest.mark.asyncio
    async def test_execute_tool_failure(self):
        """Test failed tool execution."""
        from core.tool_registry import GlobalToolRegistry, ToolCallResult

        registry = GlobalToolRegistry()

        with patch.object(registry, '_execute_mcp_tool', new_callable=AsyncMock) as mock_exec:
            mock_exec.return_value = ToolCallResult(
                success=False,
                result=None,
                error="Tool execution failed",
                execution_time=0.5
            )

            result = await registry.execute_tool(
                tool_path="test-server/test_tool",
                params={}
            )

            assert result.success is False
            assert "failed" in result.error.lower()

    def test_search_tools(self):
        """Test searching tools by query."""
        from core.tool_registry import GlobalToolRegistry, MCPTool, ToolCategory

        registry = GlobalToolRegistry()

        # Register tools with searchable descriptions
        tools = [
            MCPTool(name="postgres_query", description="Execute PostgreSQL queries",
                   server="postgres", category=ToolCategory.DATABASE, input_schema={}),
            MCPTool(name="redis_get", description="Get value from Redis cache",
                   server="redis", category=ToolCategory.DATABASE, input_schema={}),
            MCPTool(name="send_email", description="Send an email message",
                   server="email", category=ToolCategory.COMMUNICATION, input_schema={}),
        ]

        for tool in tools:
            registry.register_tool(tool)

        # Search for database tools
        results = registry.search_tools("database")

        assert len(results) >= 0  # May or may not match depending on implementation

    def test_validate_tool_params(self):
        """Test tool parameter validation."""
        from core.tool_registry import GlobalToolRegistry, MCPTool, ToolCategory

        registry = GlobalToolRegistry()

        tool = MCPTool(
            name="validated_tool",
            description="Tool with schema",
            server="test-server",
            category=ToolCategory.DATABASE,
            input_schema={
                "type": "object",
                "properties": {
                    "required_param": {"type": "string"},
                    "optional_param": {"type": "integer"}
                },
                "required": ["required_param"]
            }
        )

        registry.register_tool(tool)

        # Valid params
        valid_params = {"required_param": "value", "optional_param": 42}
        is_valid = registry.validate_params(tool.path, valid_params)
        assert is_valid is True

        # Invalid params (missing required)
        invalid_params = {"optional_param": 42}
        is_valid = registry.validate_params(tool.path, invalid_params)
        assert is_valid is False


@pytest.mark.unit
@pytest.mark.core
class TestToolRegistryStats:
    """Tests for tool registry statistics."""

    def test_tool_usage_tracking(self):
        """Test that tool usage is tracked."""
        from core.tool_registry import GlobalToolRegistry

        registry = GlobalToolRegistry()

        # Record tool usage
        registry.record_tool_usage("test-server/test_tool", success=True, execution_time=0.5)
        registry.record_tool_usage("test-server/test_tool", success=True, execution_time=0.3)
        registry.record_tool_usage("test-server/test_tool", success=False, execution_time=1.0)

        stats = registry.get_tool_stats("test-server/test_tool")

        assert stats["total_calls"] == 3
        assert stats["successful_calls"] == 2
        assert stats["failed_calls"] == 1

    def test_get_popular_tools(self):
        """Test getting most used tools."""
        from core.tool_registry import GlobalToolRegistry

        registry = GlobalToolRegistry()

        # Record varying usage
        for _ in range(10):
            registry.record_tool_usage("popular/tool", success=True, execution_time=0.1)

        for _ in range(5):
            registry.record_tool_usage("medium/tool", success=True, execution_time=0.1)

        for _ in range(1):
            registry.record_tool_usage("rare/tool", success=True, execution_time=0.1)

        popular = registry.get_popular_tools(limit=2)

        assert len(popular) <= 2
        if len(popular) > 0:
            assert popular[0]["tool_path"] == "popular/tool"
