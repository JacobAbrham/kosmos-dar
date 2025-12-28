"""
Tests for Zeus Agent - Master Orchestrator

Tests multi-step planning, parallel task execution, and agent delegation.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.unit
@pytest.mark.agent
class TestZeusAgent:
    """Tests for Zeus orchestrator agent."""

    def test_zeus_initialization(self, mock_tool_registry, mock_agent_bus):
        """Test Zeus agent initialization."""
        from agents.zeus import ZeusAgent

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                assert zeus.name == "zeus"
                assert "orchestrat" in zeus.description.lower()

    @pytest.mark.asyncio
    async def test_plan_simple_task(self, mock_tool_registry, mock_agent_bus, mock_agent_state):
        """Test planning a simple single-agent task."""
        from agents.zeus import ZeusAgent

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                mock_agent_state["messages"] = [{"role": "user", "content": "Schedule a meeting tomorrow"}]

                result = await zeus.plan(mock_agent_state)

                assert "plan" in result or "selected_tools" in result

    @pytest.mark.asyncio
    async def test_plan_complex_task(self, mock_tool_registry, mock_agent_bus, mock_agent_state):
        """Test planning a complex multi-agent task."""
        from agents.zeus import ZeusAgent

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                mock_agent_state["messages"] = [{
                    "role": "user",
                    "content": "Analyze last month's sales data, create a report, and email it to the team"
                }]

                result = await zeus.plan(mock_agent_state)

                # Complex task should identify multiple agents
                assert result is not None

    @pytest.mark.asyncio
    async def test_delegate_to_agent(self, mock_tool_registry, mock_agent_bus, mock_agent_state):
        """Test delegating task to another agent."""
        from agents.zeus import ZeusAgent

        mock_agent_bus.request.return_value = {"success": True, "result": "Task completed"}

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                result = await zeus.delegate_to_agent(
                    agent_name="chronos",
                    task="Schedule a meeting for tomorrow at 2pm",
                    context=mock_agent_state["context"]
                )

                mock_agent_bus.request.assert_called()
                assert result["success"] is True

    @pytest.mark.asyncio
    async def test_parallel_execution(self, mock_tool_registry, mock_agent_bus, mock_agent_state):
        """Test parallel task execution."""
        from agents.zeus import ZeusAgent

        mock_agent_bus.request.return_value = {"success": True, "result": "Done"}

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                tasks = [
                    {"agent": "hermes", "task": "Query sales data"},
                    {"agent": "athena", "task": "Analyze trends"},
                    {"agent": "iris", "task": "Prepare notification"}
                ]

                results = await zeus.execute_parallel(tasks)

                assert len(results) == 3

    @pytest.mark.asyncio
    async def test_aggregate_results(self, mock_tool_registry, mock_agent_bus):
        """Test aggregating results from multiple agents."""
        from agents.zeus import ZeusAgent

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                results = [
                    {"agent": "hermes", "data": {"sales": 1000}},
                    {"agent": "athena", "analysis": {"trend": "up"}},
                    {"agent": "morpheus", "prediction": {"next_month": 1200}}
                ]

                aggregated = zeus.aggregate_results(results)

                assert "sales" in str(aggregated) or "trend" in str(aggregated)

    @pytest.mark.asyncio
    async def test_handle_agent_failure(self, mock_tool_registry, mock_agent_bus, mock_agent_state):
        """Test handling agent failure gracefully."""
        from agents.zeus import ZeusAgent

        mock_agent_bus.request.side_effect = Exception("Agent unavailable")

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                result = await zeus.delegate_to_agent(
                    agent_name="failing_agent",
                    task="Do something",
                    context={}
                )

                assert result["success"] is False or "error" in result

    @pytest.mark.asyncio
    async def test_workflow_state_management(self, mock_tool_registry, mock_agent_bus, mock_agent_state):
        """Test workflow state management across steps."""
        from agents.zeus import ZeusAgent, WorkflowPhase

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                # Initial state
                assert mock_agent_state["phase"] == "planning"

                # Plan
                state = await zeus.plan(mock_agent_state)
                assert state["phase"] in ["executing", "planning"]

    @pytest.mark.asyncio
    async def test_priority_based_task_ordering(self, mock_tool_registry, mock_agent_bus):
        """Test that tasks are ordered by priority."""
        from agents.zeus import ZeusAgent

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                tasks = [
                    {"task": "Low priority", "priority": 1},
                    {"task": "High priority", "priority": 10},
                    {"task": "Medium priority", "priority": 5}
                ]

                ordered = zeus.order_tasks_by_priority(tasks)

                assert ordered[0]["priority"] == 10

    @pytest.mark.asyncio
    async def test_dependency_resolution(self, mock_tool_registry, mock_agent_bus):
        """Test task dependency resolution."""
        from agents.zeus import ZeusAgent

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                tasks = [
                    {"id": "task1", "depends_on": []},
                    {"id": "task2", "depends_on": ["task1"]},
                    {"id": "task3", "depends_on": ["task2"]}
                ]

                execution_order = zeus.resolve_dependencies(tasks)

                # task1 must come before task2, task2 before task3
                task1_idx = next(i for i, t in enumerate(execution_order) if t["id"] == "task1")
                task2_idx = next(i for i, t in enumerate(execution_order) if t["id"] == "task2")
                task3_idx = next(i for i, t in enumerate(execution_order) if t["id"] == "task3")

                assert task1_idx < task2_idx < task3_idx


@pytest.mark.unit
@pytest.mark.agent
class TestZeusContextAggregation:
    """Tests for Zeus context aggregation."""

    def test_merge_agent_contexts(self, mock_tool_registry, mock_agent_bus):
        """Test merging contexts from multiple agents."""
        from agents.zeus import ZeusAgent

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                contexts = [
                    {"agent": "hermes", "data_fetched": True},
                    {"agent": "athena", "analysis_complete": True},
                    {"agent": "chronos", "scheduled": True}
                ]

                merged = zeus.merge_contexts(contexts)

                assert merged["data_fetched"] is True
                assert merged["analysis_complete"] is True
                assert merged["scheduled"] is True

    def test_handle_context_conflicts(self, mock_tool_registry, mock_agent_bus):
        """Test handling conflicting context values."""
        from agents.zeus import ZeusAgent

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                contexts = [
                    {"agent": "hermes", "status": "success", "value": 100},
                    {"agent": "athena", "status": "warning", "value": 150}
                ]

                merged = zeus.merge_contexts(contexts, conflict_strategy="latest")

                # Should have resolved conflicts
                assert "status" in merged


@pytest.mark.unit
@pytest.mark.agent
class TestZeusErrorHandling:
    """Tests for Zeus error handling."""

    @pytest.mark.asyncio
    async def test_retry_failed_task(self, mock_tool_registry, mock_agent_bus):
        """Test retrying a failed task."""
        from agents.zeus import ZeusAgent

        call_count = 0

        async def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("Temporary failure")
            return {"success": True}

        mock_agent_bus.request = mock_request

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                result = await zeus.delegate_with_retry(
                    agent_name="test",
                    task="Do something",
                    max_retries=3
                )

                assert call_count == 3
                assert result["success"] is True

    @pytest.mark.asyncio
    async def test_fallback_agent(self, mock_tool_registry, mock_agent_bus):
        """Test falling back to alternative agent."""
        from agents.zeus import ZeusAgent

        mock_agent_bus.request.side_effect = [
            Exception("Primary agent failed"),
            {"success": True, "result": "Fallback succeeded"}
        ]

        with patch('agents.zeus.get_tool_registry', return_value=mock_tool_registry):
            with patch('agents.zeus.AgentBus', return_value=mock_agent_bus):
                zeus = ZeusAgent()

                result = await zeus.delegate_with_fallback(
                    primary_agent="hermes",
                    fallback_agent="athena",
                    task="Query data"
                )

                assert result["success"] is True
