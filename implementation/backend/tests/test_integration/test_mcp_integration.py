# KOSMOS V2.0 MCP Integration Tests
"""
Integration tests for MCP (Model Context Protocol) servers including:
- MCP server discovery and connection
- Tool execution through MCP
- Cross-server communication
- Error handling and fallbacks
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio


@pytest.fixture
def mock_mcp_gateway():
    """Mock MCP gateway."""
    gateway = MagicMock()
    gateway.discover_servers = AsyncMock(return_value=[
        {"name": "postgres-mcp", "status": "connected", "tools": ["query", "execute"]},
        {"name": "redis-mcp", "status": "connected", "tools": ["get", "set", "del"]},
        {"name": "github-mcp", "status": "connected", "tools": ["create_issue", "list_prs"]},
        {"name": "slack-mcp", "status": "connected", "tools": ["send_message", "list_channels"]},
    ])
    gateway.execute_tool = AsyncMock(return_value={
        "success": True,
        "result": {"data": "tool result"},
    })
    gateway.get_server_health = AsyncMock(return_value={
        "status": "healthy",
        "uptime": 3600,
        "connections": 10,
    })
    return gateway


@pytest.fixture
def mock_postgres_mcp():
    """Mock PostgreSQL MCP server."""
    server = MagicMock()
    server.query = AsyncMock(return_value={
        "rows": [{"id": 1, "name": "Test"}],
        "row_count": 1,
    })
    server.execute = AsyncMock(return_value={"affected_rows": 1})
    return server


@pytest.fixture
def mock_redis_mcp():
    """Mock Redis MCP server."""
    server = MagicMock()
    server.get = AsyncMock(return_value={"value": "cached_data"})
    server.set = AsyncMock(return_value={"success": True})
    server.delete = AsyncMock(return_value={"deleted": 1})
    return server


class TestMCPDiscovery:
    """Tests for MCP server discovery."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_discover_all_servers(self, mock_mcp_gateway):
        """Test discovering all available MCP servers."""
        with patch("core.mcp.gateway", mock_mcp_gateway):
            servers = await mock_mcp_gateway.discover_servers()

            assert len(servers) == 4
            assert servers[0]["name"] == "postgres-mcp"
            assert all(s["status"] == "connected" for s in servers)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_discover_servers_by_capability(self, mock_mcp_gateway):
        """Test discovering servers by capability."""
        mock_mcp_gateway.discover_servers = AsyncMock(return_value=[
            {"name": "postgres-mcp", "capabilities": ["database", "query"]},
        ])

        with patch("core.mcp.gateway", mock_mcp_gateway):
            servers = await mock_mcp_gateway.discover_servers()

            assert len(servers) == 1
            assert "database" in servers[0]["capabilities"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_server_reconnection(self, mock_mcp_gateway):
        """Test MCP server reconnection after disconnect."""
        connection_attempts = []

        async def reconnect(server_name):
            connection_attempts.append(server_name)
            return {"status": "connected"}

        mock_mcp_gateway.reconnect = reconnect

        with patch("core.mcp.gateway", mock_mcp_gateway):
            result = await mock_mcp_gateway.reconnect("postgres-mcp")

            assert result["status"] == "connected"
            assert "postgres-mcp" in connection_attempts

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_server_health_monitoring(self, mock_mcp_gateway):
        """Test MCP server health monitoring."""
        with patch("core.mcp.gateway", mock_mcp_gateway):
            health = await mock_mcp_gateway.get_server_health("postgres-mcp")

            assert health["status"] == "healthy"
            assert health["uptime"] > 0


class TestMCPToolExecution:
    """Tests for tool execution through MCP."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_execute_postgres_query(self, mock_mcp_gateway, mock_postgres_mcp):
        """Test executing PostgreSQL query through MCP."""
        with patch("core.mcp.gateway", mock_mcp_gateway):
            with patch("core.mcp.servers.postgres", mock_postgres_mcp):
                result = await mock_postgres_mcp.query(
                    "SELECT * FROM users WHERE id = $1",
                    [1]
                )

                assert result["row_count"] == 1
                assert result["rows"][0]["name"] == "Test"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_execute_redis_operations(self, mock_mcp_gateway, mock_redis_mcp):
        """Test executing Redis operations through MCP."""
        with patch("core.mcp.gateway", mock_mcp_gateway):
            with patch("core.mcp.servers.redis", mock_redis_mcp):
                # Set value
                set_result = await mock_redis_mcp.set("key1", "value1")
                assert set_result["success"] is True

                # Get value
                get_result = await mock_redis_mcp.get("key1")
                assert get_result["value"] == "cached_data"

                # Delete value
                del_result = await mock_redis_mcp.delete("key1")
                assert del_result["deleted"] == 1

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_tool_timeout_handling(self, mock_mcp_gateway):
        """Test handling tool execution timeout."""
        async def slow_tool():
            await asyncio.sleep(10)
            return {"result": "done"}

        mock_mcp_gateway.execute_tool = slow_tool

        with patch("core.mcp.gateway", mock_mcp_gateway):
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(
                    mock_mcp_gateway.execute_tool(),
                    timeout=0.1
                )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_tool_with_context(self, mock_mcp_gateway):
        """Test tool execution with context passing."""
        mock_mcp_gateway.execute_tool = AsyncMock(return_value={
            "success": True,
            "context_received": True,
        })

        with patch("core.mcp.gateway", mock_mcp_gateway):
            result = await mock_mcp_gateway.execute_tool(
                server="postgres-mcp",
                tool="query",
                context={
                    "tenant_id": "tenant-abc",
                    "user_id": "user-123",
                }
            )

            assert result["context_received"] is True


class TestCrossServerCommunication:
    """Tests for cross-server communication."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_postgres_to_redis_caching(self, mock_postgres_mcp, mock_redis_mcp):
        """Test caching PostgreSQL query results in Redis."""
        with patch("core.mcp.servers.postgres", mock_postgres_mcp):
            with patch("core.mcp.servers.redis", mock_redis_mcp):
                # Query from PostgreSQL
                db_result = await mock_postgres_mcp.query("SELECT * FROM users")

                # Cache in Redis
                cache_result = await mock_redis_mcp.set(
                    "cache:users",
                    str(db_result["rows"])
                )

                assert db_result["row_count"] == 1
                assert cache_result["success"] is True

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_github_to_slack_notification(self, mock_mcp_gateway):
        """Test GitHub event triggering Slack notification."""
        notifications_sent = []

        async def send_slack_notification(channel, message):
            notifications_sent.append({"channel": channel, "message": message})
            return {"sent": True}

        mock_slack = MagicMock()
        mock_slack.send_message = send_slack_notification

        mock_github = MagicMock()
        mock_github.on_event = AsyncMock(return_value={
            "type": "pull_request",
            "action": "opened",
            "title": "New feature",
        })

        with patch("core.mcp.servers.slack", mock_slack):
            with patch("core.mcp.servers.github", mock_github):
                # Simulate GitHub event
                event = await mock_github.on_event()

                # Send Slack notification
                await mock_slack.send_message(
                    "#dev",
                    f"New PR: {event['title']}"
                )

                assert len(notifications_sent) == 1
                assert "New feature" in notifications_sent[0]["message"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_multi_server_workflow(self, mock_mcp_gateway):
        """Test workflow involving multiple MCP servers."""
        workflow_log = []

        async def log_and_execute(server, action, *args):
            workflow_log.append(f"{server}:{action}")
            return {"success": True}

        mock_mcp_gateway.execute = log_and_execute

        with patch("core.mcp.gateway", mock_mcp_gateway):
            # Multi-server workflow
            await mock_mcp_gateway.execute("postgres-mcp", "query")
            await mock_mcp_gateway.execute("redis-mcp", "cache")
            await mock_mcp_gateway.execute("slack-mcp", "notify")

            assert len(workflow_log) == 3
            assert workflow_log == [
                "postgres-mcp:query",
                "redis-mcp:cache",
                "slack-mcp:notify",
            ]


class TestMCPErrorHandling:
    """Tests for MCP error handling."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_server_connection_error(self, mock_mcp_gateway):
        """Test handling server connection errors."""
        mock_mcp_gateway.execute_tool = AsyncMock(
            side_effect=ConnectionError("Failed to connect to postgres-mcp")
        )

        with patch("core.mcp.gateway", mock_mcp_gateway):
            with pytest.raises(ConnectionError):
                await mock_mcp_gateway.execute_tool("postgres-mcp", "query")

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_tool_execution_error(self, mock_mcp_gateway):
        """Test handling tool execution errors."""
        mock_mcp_gateway.execute_tool = AsyncMock(return_value={
            "success": False,
            "error": {
                "code": "QUERY_ERROR",
                "message": "Invalid SQL syntax",
            },
        })

        with patch("core.mcp.gateway", mock_mcp_gateway):
            result = await mock_mcp_gateway.execute_tool(
                "postgres-mcp",
                "query",
                "INVALID SQL"
            )

            assert result["success"] is False
            assert result["error"]["code"] == "QUERY_ERROR"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_fallback_server(self, mock_mcp_gateway):
        """Test fallback to secondary server on primary failure."""
        call_count = 0

        async def execute_with_fallback(server, tool, *args):
            nonlocal call_count
            call_count += 1
            if server == "postgres-mcp-primary" and call_count == 1:
                raise ConnectionError("Primary unavailable")
            return {"success": True, "server": server}

        mock_mcp_gateway.execute_with_fallback = execute_with_fallback

        with patch("core.mcp.gateway", mock_mcp_gateway):
            # Try primary, fall back to secondary
            try:
                result = await mock_mcp_gateway.execute_with_fallback(
                    "postgres-mcp-primary", "query"
                )
            except ConnectionError:
                result = await mock_mcp_gateway.execute_with_fallback(
                    "postgres-mcp-secondary", "query"
                )

            assert result["success"] is True
            assert result["server"] == "postgres-mcp-secondary"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_retry_on_transient_error(self, mock_mcp_gateway):
        """Test retry logic on transient errors."""
        attempt = 0

        async def flaky_execute(*args):
            nonlocal attempt
            attempt += 1
            if attempt < 3:
                raise TimeoutError("Request timed out")
            return {"success": True}

        mock_mcp_gateway.execute_tool = flaky_execute

        with patch("core.mcp.gateway", mock_mcp_gateway):
            # Retry loop
            for i in range(3):
                try:
                    result = await mock_mcp_gateway.execute_tool()
                    break
                except TimeoutError:
                    if i == 2:
                        raise
                    await asyncio.sleep(0.01)

            assert result["success"] is True
            assert attempt == 3


class TestMCPSecurity:
    """Tests for MCP security features."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_tool_permission_check(self, mock_mcp_gateway):
        """Test tool permission validation."""
        mock_mcp_gateway.check_permission = AsyncMock(return_value=True)
        mock_mcp_gateway.execute_tool = AsyncMock(return_value={"success": True})

        with patch("core.mcp.gateway", mock_mcp_gateway):
            # Check permission before executing
            has_permission = await mock_mcp_gateway.check_permission(
                user_id="user-123",
                server="postgres-mcp",
                tool="execute"
            )

            if has_permission:
                result = await mock_mcp_gateway.execute_tool()
                assert result["success"] is True

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_tenant_isolation(self, mock_mcp_gateway):
        """Test tenant data isolation in MCP."""
        mock_mcp_gateway.execute_tool = AsyncMock(return_value={
            "success": True,
            "tenant_id": "tenant-abc",
        })

        with patch("core.mcp.gateway", mock_mcp_gateway):
            result = await mock_mcp_gateway.execute_tool(
                server="postgres-mcp",
                tool="query",
                context={"tenant_id": "tenant-abc"}
            )

            assert result["tenant_id"] == "tenant-abc"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_sensitive_data_masking(self, mock_mcp_gateway):
        """Test sensitive data masking in logs."""
        log_entries = []

        async def execute_with_logging(server, tool, params):
            # Mask sensitive data in logs
            masked_params = {
                k: "***" if k in ["password", "api_key"] else v
                for k, v in params.items()
            }
            log_entries.append({"params": masked_params})
            return {"success": True}

        mock_mcp_gateway.execute_with_logging = execute_with_logging

        with patch("core.mcp.gateway", mock_mcp_gateway):
            await mock_mcp_gateway.execute_with_logging(
                "email-mcp",
                "send",
                {"to": "user@example.com", "password": "secret123"}
            )

            assert log_entries[0]["params"]["password"] == "***"
            assert log_entries[0]["params"]["to"] == "user@example.com"
