"""
Unit tests for AgentService.

Tests agent service layer functionality.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from services.agent_service import AgentService
from services.base import ServiceContext
from agents.base import AgentMessage


@pytest.fixture
def mock_agent_registry():
    """Mock agent registry."""
    registry = AsyncMock()
    agent = MagicMock()
    agent.id = "athena"
    agent.name = "Athena"
    agent.domain = "Knowledge"
    agent.description = "Knowledge agent"
    agent.metrics.requests_total = 100
    agent.metrics.requests_success = 95
    agent.metrics.requests_failed = 5
    agent.metrics.total_latency_ms = 5000.0
    registry.get_agent.return_value = agent
    registry.list_agents.return_value = [agent]
    return registry


@pytest.fixture
def mock_tool_registry():
    """Mock tool registry."""
    registry = AsyncMock()
    registry.list_tools_by_category.return_value = []
    return registry


@pytest.fixture
def service_context():
    """Create service context."""
    return ServiceContext(
        tenant_id=str(uuid4()),
        user_id=str(uuid4()),
        session_id=str(uuid4())
    )


@pytest.fixture
def agent_service(mock_agent_registry, mock_tool_registry):
    """Create agent service instance."""
    service = AgentService()
    service._agent_registry = mock_agent_registry
    service._tool_registry = mock_tool_registry
    return service


@pytest.mark.asyncio
async def test_list_agents(agent_service, service_context):
    """Test listing agents."""
    agents = await agent_service.list_agents(service_context)

    assert len(agents) == 1
    assert agents[0]["id"] == "athena"
    assert agents[0]["name"] == "Athena"
    assert agents[0]["domain"] == "Knowledge"
    assert "metrics" in agents[0]


@pytest.mark.asyncio
async def test_get_agent(agent_service, service_context):
    """Test getting agent by ID."""
    agent = await agent_service.get_agent(service_context, "athena")

    assert agent is not None
    assert agent["id"] == "athena"
    assert agent["name"] == "Athena"


@pytest.mark.asyncio
async def test_get_agent_not_found(agent_service, service_context):
    """Test getting non-existent agent."""
    agent_service._agent_registry.get_agent.return_value = None
    agent = await agent_service.get_agent(service_context, "nonexistent")

    assert agent is None


@pytest.mark.asyncio
async def test_execute_agent(agent_service, service_context):
    """Test executing an agent."""
    agent_service._agent_registry.get_agent.return_value.process = AsyncMock(
        return_value={"result": "test result"}
    )

    result = await agent_service.execute_agent(
        service_context,
        "athena",
        "Test task",
        context={"key": "value"}
    )

    assert result["success"] is True
    assert result["agent_id"] == "athena"
    assert "result" in result
    assert "latency_ms" in result


@pytest.mark.asyncio
async def test_execute_agent_not_found(agent_service, service_context):
    """Test executing non-existent agent."""
    agent_service._agent_registry.get_agent.return_value = None

    with pytest.raises(ValueError, match="Agent athena not found"):
        await agent_service.execute_agent(
            service_context,
            "athena",
            "Test task"
        )


@pytest.mark.asyncio
async def test_execute_agent_error(agent_service, service_context):
    """Test agent execution error handling."""
    agent = MagicMock()
    agent.process = AsyncMock(side_effect=Exception("Test error"))
    agent_service._agent_registry.get_agent.return_value = agent

    with pytest.raises(Exception, match="Test error"):
        await agent_service.execute_agent(
            service_context,
            "athena",
            "Test task"
        )


@pytest.mark.asyncio
async def test_get_agent_capabilities(agent_service, service_context):
    """Test getting agent capabilities."""
    agent_service._tool_registry.list_tools_by_category.return_value = [
        MagicMock(name="tool1", description="Tool 1"),
        MagicMock(name="tool2", description="Tool 2"),
    ]

    capabilities = await agent_service.get_agent_capabilities(service_context, "athena")

    assert "tools" in capabilities
    assert len(capabilities["tools"]) == 2


@pytest.mark.asyncio
async def test_route_intent(agent_service, service_context):
    """Test intent routing."""
    agent_service._intent_router = AsyncMock()
    agent_service._intent_router.route.return_value = {
        "agent_id": "athena",
        "confidence": 0.95
    }

    result = await agent_service.route_intent(service_context, "What is the weather?")

    assert result["agent_id"] == "athena"
    assert result["confidence"] == 0.95
