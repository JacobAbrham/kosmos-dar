"""
Integration tests for agent-to-agent communication via NATS.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from agents.base import AgentMessage
from core.messaging import AgentBus


@pytest.fixture
def mock_agent_bus():
    """Mock agent bus."""
    bus = AsyncMock(spec=AgentBus)
    bus.publish = AsyncMock()
    bus.subscribe = AsyncMock()
    return bus


@pytest.mark.asyncio
async def test_agent_publishes_message(mock_agent_bus):
    """Test that agent can publish messages to bus."""
    message = AgentMessage(
        id=str(uuid4()),
        from_agent="athena",
        to_agent="hermes",
        payload={"message": "Test message"},
    )

    await mock_agent_bus.publish("hermes", message)

    mock_agent_bus.publish.assert_called_once_with("hermes", message)


@pytest.mark.asyncio
async def test_agent_subscribes_to_messages(mock_agent_bus):
    """Test that agent can subscribe to messages."""
    callback = AsyncMock()

    await mock_agent_bus.subscribe("athena", callback)

    mock_agent_bus.subscribe.assert_called_once_with("athena", callback)


@pytest.mark.asyncio
async def test_multi_agent_workflow():
    """Test multi-agent workflow communication."""
    # Mock bus
    bus = AsyncMock()
    received_messages = []

    async def message_handler(message):
        received_messages.append(message)

    bus.subscribe = AsyncMock()
    bus.publish = AsyncMock()

    # Simulate agent communication
    # Athena sends message to Hermes
    message1 = AgentMessage(
        id=str(uuid4()),
        from_agent="athena",
        to_agent="hermes",
        payload={"task": "Send email"},
    )

    await bus.publish("hermes", message1)

    # Hermes responds
    message2 = AgentMessage(
        id=str(uuid4()),
        from_agent="hermes",
        to_agent="athena",
        payload={"status": "email_sent"},
    )

    await bus.publish("athena", message2)

    # Verify messages were published
    assert bus.publish.call_count == 2


@pytest.mark.asyncio
async def test_agent_workflow_executor():
    """Test agent workflow executor with multiple agents."""
    from agents.workflows.agent_workflow_executor import AgentWorkflowExecutor

    # Mock dependencies
    mock_registry = AsyncMock()
    mock_tool_registry = AsyncMock()
    mock_bus = AsyncMock()

    executor = AgentWorkflowExecutor(
        agent_registry=mock_registry,
        tool_registry=mock_tool_registry,
        agent_bus=mock_bus,
    )

    # Mock agent
    mock_agent = AsyncMock()
    mock_agent.process = AsyncMock(
        return_value={
            "response": "Test response",
            "requires_additional_agents": False,
        }
    )
    mock_registry.get_agent.return_value = mock_agent

    # Mock intent router
    with patch("agents.workflows.agent_workflow_executor.get_intent_router") as mock_router:
        mock_router_instance = AsyncMock()
        mock_router_instance.route = AsyncMock(
            return_value={"agent_id": "athena", "confidence": 0.95}
        )
        mock_router.return_value = mock_router_instance

        # Execute workflow
        result = await executor.execute_workflow(
            workflow_id=str(uuid4()),
            initial_message="What is the weather?",
            tenant_id=str(uuid4()),
            user_id=str(uuid4()),
        )

        assert result["success"] is True
        assert "result" in result
        assert "athena" in result["result"]["agents_executed"]


@pytest.mark.asyncio
async def test_mcp_tool_execution_in_workflow():
    """Test MCP tool execution within agent workflow."""
    from agents.workflows.agent_workflow_executor import AgentWorkflowExecutor

    mock_tool_registry = AsyncMock()
    mock_tool_result = MagicMock()
    mock_tool_result.success = True
    mock_tool_result.result = {"status": "success"}
    mock_tool_result.latency_ms = 100

    mock_tool_registry.call_tool = AsyncMock(return_value=mock_tool_result)

    executor = AgentWorkflowExecutor(tool_registry=mock_tool_registry)
    await executor.initialize()

    # Execute with MCP tools
    result = await executor.execute_with_mcp_tools(
        agent_id="athena",
        tool_calls=[
            {
                "tool_path": "github-mcp.create_issue",
                "params": {"title": "Test", "body": "Test issue"},
            }
        ],
        tenant_id=str(uuid4()),
        user_id=str(uuid4()),
    )

    assert result["success"] is True
    assert "tool_results" in result
    assert "github-mcp.create_issue" in result["tool_results"]


@pytest.mark.asyncio
async def test_human_in_the_loop_checkpoint():
    """Test human-in-the-loop checkpoint."""
    from agents.workflows.agent_workflow_executor import AgentWorkflowExecutor

    executor = AgentWorkflowExecutor()
    await executor.initialize()

    workflow_id = str(uuid4())

    # Request human input
    request_result = await executor.request_human_input(
        workflow_id=workflow_id,
        prompt="Approve this action?",
        options=["Yes", "No"],
    )

    assert request_result["status"] == "waiting_for_input"
    assert request_result["prompt"] == "Approve this action?"

    # Submit human input
    response_result = await executor.submit_human_input(
        workflow_id=workflow_id,
        response="Yes",
    )

    assert response_result["status"] == "resumed"
    assert response_result["response"] == "Yes"
