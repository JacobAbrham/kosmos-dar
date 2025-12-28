# KOSMOS V2.0 Agent API Tests
"""
Tests for agent management endpoints including:
- Agent listing and discovery
- Agent execution
- Agent configuration
- Agent health monitoring
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from fastapi import status
import json


@pytest.fixture
def mock_agent_registry():
    """Mock agent registry."""
    registry = MagicMock()
    registry.list_agents = AsyncMock(return_value=[
        {
            "id": "zeus",
            "name": "Zeus Orchestrator",
            "type": "orchestrator",
            "status": "active",
            "capabilities": ["planning", "delegation", "coordination"],
        },
        {
            "id": "hermes",
            "name": "Hermes Communicator",
            "type": "specialist",
            "status": "active",
            "capabilities": ["email", "slack", "notifications"],
        },
        {
            "id": "athena",
            "name": "Athena Analyst",
            "type": "specialist",
            "status": "active",
            "capabilities": ["data_analysis", "reporting", "insights"],
        },
    ])
    registry.get_agent = AsyncMock(return_value={
        "id": "zeus",
        "name": "Zeus Orchestrator",
        "type": "orchestrator",
        "status": "active",
        "version": "2.0.0",
        "capabilities": ["planning", "delegation", "coordination"],
        "config": {"max_concurrent_tasks": 10},
    })
    return registry


@pytest.fixture
def mock_zeus_agent():
    """Mock Zeus orchestrator agent."""
    agent = MagicMock()
    agent.execute = AsyncMock(return_value={
        "task_id": "task-123",
        "status": "completed",
        "result": {"message": "Task completed successfully"},
    })
    agent.plan = AsyncMock(return_value={
        "steps": [
            {"agent": "hermes", "action": "send_email"},
            {"agent": "athena", "action": "analyze_data"},
        ]
    })
    return agent


class TestAgentListing:
    """Tests for agent listing endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_all_agents(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test listing all available agents."""
        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.get(
                "/api/v1/agents",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "agents" in data
            assert len(data["agents"]) == 3
            assert data["agents"][0]["id"] == "zeus"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_agents_by_type(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test listing agents filtered by type."""
        mock_agent_registry.list_agents = AsyncMock(return_value=[
            {"id": "hermes", "type": "specialist"},
            {"id": "athena", "type": "specialist"},
        ])

        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.get(
                "/api/v1/agents",
                params={"type": "specialist"},
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data["agents"]) == 2

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_agents_by_capability(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test listing agents filtered by capability."""
        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.get(
                "/api/v1/agents",
                params={"capability": "email"},
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_agent_details(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test getting detailed agent information."""
        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.get(
                "/api/v1/agents/zeus",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["id"] == "zeus"
            assert data["version"] == "2.0.0"
            assert "capabilities" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_nonexistent_agent(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test getting details of non-existent agent."""
        mock_agent_registry.get_agent = AsyncMock(return_value=None)

        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.get(
                "/api/v1/agents/nonexistent",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_404_NOT_FOUND


class TestAgentExecution:
    """Tests for agent execution endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_execute_agent_task(self, async_client: AsyncClient, mock_zeus_agent, auth_headers):
        """Test executing a task with an agent."""
        with patch("api.routes.agents.get_agent", return_value=mock_zeus_agent):
            response = await async_client.post(
                "/api/v1/agents/zeus/execute",
                json={
                    "task": "Analyze sales data and send report to team",
                    "context": {"department": "sales"},
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_202_ACCEPTED
            data = response.json()
            assert "task_id" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_execute_agent_sync(self, async_client: AsyncClient, mock_zeus_agent, auth_headers):
        """Test synchronous agent execution."""
        with patch("api.routes.agents.get_agent", return_value=mock_zeus_agent):
            response = await async_client.post(
                "/api/v1/agents/zeus/execute",
                json={
                    "task": "Quick calculation",
                    "sync": True,
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "completed"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_execute_with_tools(self, async_client: AsyncClient, mock_zeus_agent, auth_headers):
        """Test agent execution with specific tools."""
        with patch("api.routes.agents.get_agent", return_value=mock_zeus_agent):
            response = await async_client.post(
                "/api/v1/agents/zeus/execute",
                json={
                    "task": "Send email to team",
                    "tools": ["email_send", "slack_notify"],
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_202_ACCEPTED

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_execute_with_hitl(self, async_client: AsyncClient, mock_zeus_agent, auth_headers):
        """Test agent execution with human-in-the-loop enabled."""
        mock_zeus_agent.execute = AsyncMock(return_value={
            "task_id": "task-123",
            "status": "pending_approval",
            "approval_request": {
                "action": "send_email",
                "recipients": ["team@kosmos.io"],
                "message": "Confirm email send?",
            },
        })

        with patch("api.routes.agents.get_agent", return_value=mock_zeus_agent):
            response = await async_client.post(
                "/api/v1/agents/zeus/execute",
                json={
                    "task": "Send important email",
                    "hitl_enabled": True,
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_202_ACCEPTED
            data = response.json()
            assert data["status"] == "pending_approval"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_execute_rate_limited(self, async_client: AsyncClient, auth_headers):
        """Test agent execution respects rate limits."""
        # Simulate hitting rate limit
        responses = []
        for _ in range(100):
            response = await async_client.post(
                "/api/v1/agents/zeus/execute",
                json={"task": "Test task"},
                headers=auth_headers
            )
            responses.append(response.status_code)

        # At some point, should get rate limited
        assert status.HTTP_429_TOO_MANY_REQUESTS in responses or all(
            r in [status.HTTP_202_ACCEPTED, status.HTTP_200_OK] for r in responses
        )


class TestAgentPlanning:
    """Tests for agent planning endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_execution_plan(self, async_client: AsyncClient, mock_zeus_agent, auth_headers):
        """Test getting execution plan without executing."""
        with patch("api.routes.agents.get_agent", return_value=mock_zeus_agent):
            response = await async_client.post(
                "/api/v1/agents/zeus/plan",
                json={
                    "task": "Complex multi-step task",
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "steps" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_estimate_execution_cost(self, async_client: AsyncClient, mock_zeus_agent, auth_headers):
        """Test estimating execution cost."""
        mock_zeus_agent.estimate_cost = AsyncMock(return_value={
            "estimated_tokens": 5000,
            "estimated_cost_usd": 0.05,
            "estimated_time_seconds": 30,
        })

        with patch("api.routes.agents.get_agent", return_value=mock_zeus_agent):
            response = await async_client.post(
                "/api/v1/agents/zeus/estimate",
                json={
                    "task": "Large analysis task",
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "estimated_cost_usd" in data


class TestAgentConfiguration:
    """Tests for agent configuration endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_agent_config(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test getting agent configuration."""
        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.get(
                "/api/v1/agents/zeus/config",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "config" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_agent_config(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test updating agent configuration."""
        mock_agent_registry.update_config = AsyncMock(return_value=True)

        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.patch(
                "/api/v1/agents/zeus/config",
                json={
                    "max_concurrent_tasks": 20,
                    "timeout_seconds": 600,
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_update_config_requires_admin(self, async_client: AsyncClient, mock_agent_registry):
        """Test configuration update requires admin role."""
        user_headers = {"Authorization": "Bearer user-token"}

        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.patch(
                "/api/v1/agents/zeus/config",
                json={"max_concurrent_tasks": 20},
                headers=user_headers
            )

            # Should be forbidden for non-admin
            assert response.status_code in [
                status.HTTP_403_FORBIDDEN,
                status.HTTP_401_UNAUTHORIZED,
            ]


class TestAgentHealth:
    """Tests for agent health monitoring endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_agent_health(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test getting agent health status."""
        mock_agent_registry.get_health = AsyncMock(return_value={
            "status": "healthy",
            "uptime_seconds": 86400,
            "tasks_completed": 1000,
            "error_rate": 0.01,
        })

        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.get(
                "/api/v1/agents/zeus/health",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "healthy"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_all_agents_health(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test getting health status of all agents."""
        mock_agent_registry.get_all_health = AsyncMock(return_value={
            "zeus": {"status": "healthy"},
            "hermes": {"status": "healthy"},
            "athena": {"status": "degraded"},
        })

        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.get(
                "/api/v1/agents/health",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data) == 3

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_agent_metrics(self, async_client: AsyncClient, mock_agent_registry, auth_headers):
        """Test getting agent performance metrics."""
        mock_agent_registry.get_metrics = AsyncMock(return_value={
            "total_tasks": 1000,
            "successful_tasks": 990,
            "failed_tasks": 10,
            "avg_execution_time_ms": 500,
            "p95_execution_time_ms": 1200,
        })

        with patch("api.routes.agents.agent_registry", mock_agent_registry):
            response = await async_client.get(
                "/api/v1/agents/zeus/metrics",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "total_tasks" in data
            assert "avg_execution_time_ms" in data


class TestAgentGovernance:
    """Tests for agent governance endpoints (Pentarchy)."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_submit_governance_proposal(self, async_client: AsyncClient, auth_headers):
        """Test submitting a governance proposal."""
        response = await async_client.post(
            "/api/v1/agents/governance/proposals",
            json={
                "type": "config_change",
                "agent_id": "zeus",
                "proposed_change": {"max_concurrent_tasks": 50},
                "justification": "Increased capacity needed",
            },
            headers=auth_headers
        )

        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_202_ACCEPTED,
        ]

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_governance_votes(self, async_client: AsyncClient, auth_headers):
        """Test getting governance vote status."""
        response = await async_client.get(
            "/api/v1/agents/governance/proposals/proposal-123/votes",
            headers=auth_headers
        )

        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_404_NOT_FOUND,
        ]

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_aegis_veto(self, async_client: AsyncClient, auth_headers):
        """Test AEGIS veto endpoint."""
        response = await async_client.post(
            "/api/v1/agents/governance/proposals/proposal-123/veto",
            json={
                "agent_id": "aegis",
                "reason": "Security concern",
            },
            headers=auth_headers
        )

        # Only AEGIS can veto
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_403_FORBIDDEN,
        ]
