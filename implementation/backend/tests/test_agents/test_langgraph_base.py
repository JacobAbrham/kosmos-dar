"""
Tests for LangGraph Base Template

Tests the base class for LangGraph-powered agents.
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.unit
@pytest.mark.agent
class TestWorkflowPhase:
    """Tests for WorkflowPhase enum."""

    def test_workflow_phases_exist(self):
        """Test that expected workflow phases exist."""
        from agents.langgraph_base import WorkflowPhase

        expected_phases = ["planning", "executing", "reviewing", "awaiting_input", "completed", "failed"]

        for phase in expected_phases:
            assert hasattr(WorkflowPhase, phase.upper())


@pytest.mark.unit
@pytest.mark.agent
class TestHumanInputType:
    """Tests for HumanInputType enum."""

    def test_human_input_types_exist(self):
        """Test that expected input types exist."""
        from agents.langgraph_base import HumanInputType

        expected_types = ["approval", "selection", "text_input", "confirmation", "clarification"]

        for input_type in expected_types:
            assert hasattr(HumanInputType, input_type.upper())


@pytest.mark.unit
@pytest.mark.agent
class TestHumanInputRequest:
    """Tests for HumanInputRequest dataclass."""

    def test_request_creation(self):
        """Test creating a human input request."""
        from agents.langgraph_base import HumanInputRequest, HumanInputType

        request = HumanInputRequest(
            id="test-request-1",
            type=HumanInputType.APPROVAL,
            prompt="Do you approve this action?",
            options=["Yes", "No"],
            required=True
        )

        assert request.id == "test-request-1"
        assert request.type == HumanInputType.APPROVAL
        assert "Yes" in request.options

    def test_request_with_defaults(self):
        """Test request with default values."""
        from agents.langgraph_base import HumanInputRequest, HumanInputType

        request = HumanInputRequest(
            id="test-request-2",
            type=HumanInputType.TEXT_INPUT,
            prompt="Enter your input"
        )

        assert request.options is None
        assert request.timeout_seconds == 300
        assert request.required is True


@pytest.mark.unit
@pytest.mark.agent
class TestHumanInputResponse:
    """Tests for HumanInputResponse dataclass."""

    def test_response_creation(self):
        """Test creating a human input response."""
        from agents.langgraph_base import HumanInputResponse

        response = HumanInputResponse(
            request_id="test-request-1",
            value="Yes"
        )

        assert response.request_id == "test-request-1"
        assert response.value == "Yes"
        assert response.skipped is False
        assert isinstance(response.timestamp, datetime)

    def test_skipped_response(self):
        """Test skipped response."""
        from agents.langgraph_base import HumanInputResponse

        response = HumanInputResponse(
            request_id="test-request-1",
            value=None,
            skipped=True
        )

        assert response.skipped is True
        assert response.value is None


@pytest.mark.unit
@pytest.mark.agent
class TestToolSelection:
    """Tests for ToolSelection dataclass."""

    def test_tool_selection_creation(self):
        """Test creating a tool selection."""
        from agents.langgraph_base import ToolSelection

        selection = ToolSelection(
            tool_path="postgres/query",
            tool_name="query",
            server="postgres",
            params={"sql": "SELECT * FROM users"},
            reason="Need to fetch user data"
        )

        assert selection.tool_path == "postgres/query"
        assert selection.params["sql"] == "SELECT * FROM users"


@pytest.mark.unit
@pytest.mark.agent
class TestAgentState:
    """Tests for agent state management."""

    def test_initial_state(self, mock_agent_state):
        """Test initial agent state."""
        assert mock_agent_state["phase"] == "planning"
        assert mock_agent_state["messages"] == []
        assert mock_agent_state["errors"] == []

    def test_state_transition(self, mock_agent_state):
        """Test state transitions."""
        from agents.langgraph_base import WorkflowPhase

        mock_agent_state["phase"] = WorkflowPhase.EXECUTING.value

        assert mock_agent_state["phase"] == "executing"


@pytest.mark.unit
@pytest.mark.agent
class TestLangGraphBaseAgent:
    """Tests for LangGraphBaseAgent abstract class."""

    def test_agent_is_abstract(self):
        """Test that base agent is abstract."""
        from agents.langgraph_base import LangGraphBaseAgent
        from abc import ABC

        assert issubclass(LangGraphBaseAgent, ABC)

    def test_agent_has_required_methods(self):
        """Test that base agent has required abstract methods."""
        from agents.langgraph_base import LangGraphBaseAgent

        # Check for abstract methods
        assert hasattr(LangGraphBaseAgent, 'plan')
        assert hasattr(LangGraphBaseAgent, 'execute')
        assert hasattr(LangGraphBaseAgent, 'review')

    def test_concrete_agent_creation(self, mock_tool_registry, mock_agent_bus):
        """Test creating a concrete agent implementation."""
        from agents.langgraph_base import LangGraphBaseAgent, WorkflowPhase

        class TestAgent(LangGraphBaseAgent):
            @property
            def name(self):
                return "test_agent"

            @property
            def description(self):
                return "A test agent"

            async def plan(self, state):
                state["phase"] = WorkflowPhase.EXECUTING.value
                return state

            async def execute(self, state):
                state["phase"] = WorkflowPhase.REVIEWING.value
                return state

            async def review(self, state):
                state["phase"] = WorkflowPhase.COMPLETED.value
                return state

        with patch('agents.langgraph_base.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.langgraph_base.AgentBus', return_value=mock_agent_bus):
                agent = TestAgent()

                assert agent.name == "test_agent"

    @pytest.mark.asyncio
    async def test_agent_workflow_execution(self, mock_tool_registry, mock_agent_bus):
        """Test agent workflow execution."""
        from agents.langgraph_base import LangGraphBaseAgent, WorkflowPhase

        class TestAgent(LangGraphBaseAgent):
            @property
            def name(self):
                return "test_agent"

            @property
            def description(self):
                return "A test agent"

            async def plan(self, state):
                state["phase"] = WorkflowPhase.EXECUTING.value
                state["plan"] = "Test plan"
                return state

            async def execute(self, state):
                state["phase"] = WorkflowPhase.COMPLETED.value
                state["result"] = "Test result"
                return state

            async def review(self, state):
                return state

        with patch('agents.langgraph_base.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.langgraph_base.AgentBus', return_value=mock_agent_bus):
                agent = TestAgent()

                result = await agent.run("Test input")

                assert result is not None


@pytest.mark.unit
@pytest.mark.agent
class TestAgentCheckpointing:
    """Tests for agent checkpointing."""

    @pytest.mark.asyncio
    async def test_checkpoint_save(self, mock_tool_registry, mock_agent_bus):
        """Test saving agent checkpoint."""
        from agents.langgraph_base import LangGraphBaseAgent, WorkflowPhase

        class TestAgent(LangGraphBaseAgent):
            @property
            def name(self):
                return "test_agent"

            @property
            def description(self):
                return "A test agent"

            async def plan(self, state):
                return state

            async def execute(self, state):
                return state

            async def review(self, state):
                return state

        with patch('agents.langgraph_base.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.langgraph_base.AgentBus', return_value=mock_agent_bus):
                agent = TestAgent()

                # Checkpoint should be saveable
                checkpoint_id = await agent.save_checkpoint(
                    state={"phase": "executing", "data": "test"},
                    thread_id="test-thread"
                )

                assert checkpoint_id is not None

    @pytest.mark.asyncio
    async def test_checkpoint_restore(self, mock_tool_registry, mock_agent_bus):
        """Test restoring agent from checkpoint."""
        from agents.langgraph_base import LangGraphBaseAgent

        class TestAgent(LangGraphBaseAgent):
            @property
            def name(self):
                return "test_agent"

            @property
            def description(self):
                return "A test agent"

            async def plan(self, state):
                return state

            async def execute(self, state):
                return state

            async def review(self, state):
                return state

        with patch('agents.langgraph_base.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.langgraph_base.AgentBus', return_value=mock_agent_bus):
                agent = TestAgent()

                # Mock checkpoint retrieval
                state = await agent.restore_checkpoint("test-checkpoint-id")

                # Should return state or None if not found
                assert state is None or isinstance(state, dict)


@pytest.mark.unit
@pytest.mark.agent
class TestAgentHumanInTheLoop:
    """Tests for human-in-the-loop functionality."""

    @pytest.mark.asyncio
    async def test_request_human_input(self, mock_tool_registry, mock_agent_bus):
        """Test requesting human input."""
        from agents.langgraph_base import LangGraphBaseAgent, HumanInputType, HumanInputRequest

        class TestAgent(LangGraphBaseAgent):
            @property
            def name(self):
                return "test_agent"

            @property
            def description(self):
                return "A test agent"

            async def plan(self, state):
                return state

            async def execute(self, state):
                return state

            async def review(self, state):
                return state

        with patch('agents.langgraph_base.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.langgraph_base.AgentBus', return_value=mock_agent_bus):
                agent = TestAgent()

                request = agent.create_human_input_request(
                    type=HumanInputType.APPROVAL,
                    prompt="Approve this action?"
                )

                assert isinstance(request, HumanInputRequest)
                assert request.type == HumanInputType.APPROVAL

    @pytest.mark.asyncio
    async def test_handle_human_response(self, mock_tool_registry, mock_agent_bus):
        """Test handling human input response."""
        from agents.langgraph_base import LangGraphBaseAgent, HumanInputResponse

        class TestAgent(LangGraphBaseAgent):
            @property
            def name(self):
                return "test_agent"

            @property
            def description(self):
                return "A test agent"

            async def plan(self, state):
                return state

            async def execute(self, state):
                return state

            async def review(self, state):
                return state

        with patch('agents.langgraph_base.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.langgraph_base.AgentBus', return_value=mock_agent_bus):
                agent = TestAgent()

                response = HumanInputResponse(
                    request_id="test-request",
                    value="Yes"
                )

                state = {"human_input_request": {"id": "test-request"}}
                updated_state = agent.handle_human_response(state, response)

                assert updated_state["human_input_response"] == response


@pytest.mark.unit
@pytest.mark.agent
class TestAgentToolSelection:
    """Tests for agent tool selection."""

    @pytest.mark.asyncio
    async def test_select_tools_for_intent(self, mock_tool_registry, mock_agent_bus):
        """Test selecting tools based on intent."""
        from agents.langgraph_base import LangGraphBaseAgent

        class TestAgent(LangGraphBaseAgent):
            @property
            def name(self):
                return "test_agent"

            @property
            def description(self):
                return "A test agent"

            async def plan(self, state):
                return state

            async def execute(self, state):
                return state

            async def review(self, state):
                return state

        with patch('agents.langgraph_base.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.langgraph_base.AgentBus', return_value=mock_agent_bus):
                agent = TestAgent()

                tools = await agent.select_tools(
                    intent="query_data",
                    context={"data_type": "sales"}
                )

                assert isinstance(tools, list)

    @pytest.mark.asyncio
    async def test_execute_tool(self, mock_tool_registry, mock_agent_bus):
        """Test executing a tool."""
        from agents.langgraph_base import LangGraphBaseAgent, ToolSelection

        class TestAgent(LangGraphBaseAgent):
            @property
            def name(self):
                return "test_agent"

            @property
            def description(self):
                return "A test agent"

            async def plan(self, state):
                return state

            async def execute(self, state):
                return state

            async def review(self, state):
                return state

        mock_tool_registry.execute_tool.return_value = MagicMock(
            success=True,
            result={"data": "test_result"},
            error=None
        )

        with patch('agents.langgraph_base.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.langgraph_base.AgentBus', return_value=mock_agent_bus):
                agent = TestAgent()

                selection = ToolSelection(
                    tool_path="test/tool",
                    tool_name="tool",
                    server="test",
                    params={"param1": "value1"},
                    reason="Testing"
                )

                result = await agent.execute_tool(selection)

                assert result.success is True


@pytest.mark.unit
@pytest.mark.agent
class TestAgentSDUIGeneration:
    """Tests for SDUI response generation."""

    @pytest.mark.asyncio
    async def test_generate_sdui_response(self, mock_tool_registry, mock_agent_bus, mock_sdui_controller):
        """Test generating SDUI response."""
        from agents.langgraph_base import LangGraphBaseAgent

        class TestAgent(LangGraphBaseAgent):
            @property
            def name(self):
                return "test_agent"

            @property
            def description(self):
                return "A test agent"

            async def plan(self, state):
                return state

            async def execute(self, state):
                return state

            async def review(self, state):
                return state

        with patch('agents.langgraph_base.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.langgraph_base.AgentBus', return_value=mock_agent_bus):
                with patch('agents.langgraph_base.SDUIController', return_value=mock_sdui_controller):
                    agent = TestAgent()

                    sdui_response = await agent.generate_sdui_response(
                        result={"message": "Task completed"},
                        layout="card"
                    )

                    assert sdui_response is not None
