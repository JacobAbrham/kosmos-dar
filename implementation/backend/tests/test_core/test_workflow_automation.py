"""
Tests for Workflow Automation System

Tests workflow recording, pattern recognition, and automation.
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.unit
@pytest.mark.core
class TestWorkflowRecorder:
    """Tests for WorkflowRecorder."""

    def test_recorder_initialization(self):
        """Test workflow recorder initialization."""
        from core.workflow_automation import WorkflowRecorder

        recorder = WorkflowRecorder()

        assert recorder is not None
        assert hasattr(recorder, 'start_recording')
        assert hasattr(recorder, 'stop_recording')

    def test_start_recording(self):
        """Test starting a recording session."""
        from core.workflow_automation import WorkflowRecorder

        recorder = WorkflowRecorder()

        session_id = recorder.start_recording(user_id="user-123")

        assert session_id is not None
        assert recorder.is_recording(session_id)

    def test_record_action(self):
        """Test recording an action."""
        from core.workflow_automation import WorkflowRecorder

        recorder = WorkflowRecorder()
        session_id = recorder.start_recording(user_id="user-123")

        recorder.record_action(
            session_id=session_id,
            action_type="tool_call",
            tool="postgres/query",
            params={"sql": "SELECT * FROM users"},
            result={"rows": 10}
        )

        actions = recorder.get_actions(session_id)

        assert len(actions) == 1
        assert actions[0]["tool"] == "postgres/query"

    def test_stop_recording(self):
        """Test stopping a recording session."""
        from core.workflow_automation import WorkflowRecorder

        recorder = WorkflowRecorder()
        session_id = recorder.start_recording(user_id="user-123")

        recorder.record_action(session_id, "tool_call", "test/tool", {})

        workflow = recorder.stop_recording(session_id)

        assert workflow is not None
        assert len(workflow["steps"]) == 1
        assert not recorder.is_recording(session_id)

    def test_multiple_actions(self):
        """Test recording multiple actions."""
        from core.workflow_automation import WorkflowRecorder

        recorder = WorkflowRecorder()
        session_id = recorder.start_recording(user_id="user-123")

        actions = [
            {"type": "tool_call", "tool": "tool1", "params": {}},
            {"type": "tool_call", "tool": "tool2", "params": {}},
            {"type": "agent_call", "agent": "athena", "params": {}},
        ]

        for action in actions:
            recorder.record_action(session_id, **action)

        recorded = recorder.get_actions(session_id)

        assert len(recorded) == 3


@pytest.mark.unit
@pytest.mark.core
class TestPatternRecognizer:
    """Tests for PatternRecognizer."""

    def test_recognizer_initialization(self):
        """Test pattern recognizer initialization."""
        from core.workflow_automation import PatternRecognizer

        recognizer = PatternRecognizer()

        assert recognizer is not None

    def test_identify_simple_pattern(self):
        """Test identifying a simple repeating pattern."""
        from core.workflow_automation import PatternRecognizer

        recognizer = PatternRecognizer()

        # Same sequence repeated
        workflows = [
            [{"tool": "tool1"}, {"tool": "tool2"}],
            [{"tool": "tool1"}, {"tool": "tool2"}],
            [{"tool": "tool1"}, {"tool": "tool2"}],
        ]

        patterns = recognizer.identify_patterns(workflows)

        assert len(patterns) > 0
        assert patterns[0]["confidence"] > 0.8

    def test_identify_partial_pattern(self):
        """Test identifying partial patterns."""
        from core.workflow_automation import PatternRecognizer

        recognizer = PatternRecognizer()

        workflows = [
            [{"tool": "tool1"}, {"tool": "tool2"}, {"tool": "tool3"}],
            [{"tool": "tool1"}, {"tool": "tool2"}, {"tool": "tool4"}],
            [{"tool": "tool1"}, {"tool": "tool2"}, {"tool": "tool5"}],
        ]

        patterns = recognizer.identify_patterns(workflows)

        # Should identify tool1 -> tool2 pattern
        assert any(
            p["sequence"][0]["tool"] == "tool1" and p["sequence"][1]["tool"] == "tool2"
            for p in patterns
        )

    def test_pattern_frequency(self):
        """Test pattern frequency calculation."""
        from core.workflow_automation import PatternRecognizer

        recognizer = PatternRecognizer()

        workflows = [
            [{"tool": "common_tool"}],
            [{"tool": "common_tool"}],
            [{"tool": "common_tool"}],
            [{"tool": "rare_tool"}],
        ]

        patterns = recognizer.identify_patterns(workflows)

        common_pattern = next((p for p in patterns if "common_tool" in str(p)), None)
        if common_pattern:
            assert common_pattern["frequency"] >= 3

    def test_no_pattern_detected(self):
        """Test when no clear pattern exists."""
        from core.workflow_automation import PatternRecognizer

        recognizer = PatternRecognizer()

        # Random, non-repeating workflows
        workflows = [
            [{"tool": "tool_a"}],
            [{"tool": "tool_b"}],
            [{"tool": "tool_c"}],
        ]

        patterns = recognizer.identify_patterns(workflows, min_frequency=2)

        # No pattern should meet minimum frequency
        assert len(patterns) == 0 or all(p["frequency"] < 2 for p in patterns)


@pytest.mark.unit
@pytest.mark.core
class TestWorkflowEngine:
    """Tests for WorkflowEngine."""

    def test_engine_initialization(self):
        """Test workflow engine initialization."""
        from core.workflow_automation import WorkflowEngine

        engine = WorkflowEngine()

        assert engine is not None

    @pytest.mark.asyncio
    async def test_execute_simple_workflow(self, mock_tool_registry):
        """Test executing a simple workflow."""
        from core.workflow_automation import WorkflowEngine

        mock_tool_registry.execute_tool.return_value = MagicMock(
            success=True,
            result={"data": "test"}
        )

        with patch('core.workflow_automation.get_tool_registry', return_value=mock_tool_registry):
            engine = WorkflowEngine()

            workflow = {
                "id": "wf-123",
                "steps": [
                    {"type": "tool_call", "tool": "test/tool", "params": {}}
                ]
            }

            result = await engine.execute(workflow)

            assert result["status"] == "completed"
            assert len(result["step_results"]) == 1

    @pytest.mark.asyncio
    async def test_execute_multi_step_workflow(self, mock_tool_registry):
        """Test executing a multi-step workflow."""
        from core.workflow_automation import WorkflowEngine

        mock_tool_registry.execute_tool.return_value = MagicMock(
            success=True,
            result={"data": "test"}
        )

        with patch('core.workflow_automation.get_tool_registry', return_value=mock_tool_registry):
            engine = WorkflowEngine()

            workflow = {
                "id": "wf-456",
                "steps": [
                    {"id": "step1", "type": "tool_call", "tool": "tool1", "params": {}},
                    {"id": "step2", "type": "tool_call", "tool": "tool2", "params": {}},
                    {"id": "step3", "type": "tool_call", "tool": "tool3", "params": {}},
                ]
            }

            result = await engine.execute(workflow)

            assert result["status"] == "completed"
            assert len(result["step_results"]) == 3

    @pytest.mark.asyncio
    async def test_execute_workflow_with_dependencies(self, mock_tool_registry):
        """Test executing workflow with step dependencies."""
        from core.workflow_automation import WorkflowEngine

        call_order = []

        async def mock_execute(tool_path, params):
            call_order.append(tool_path)
            return MagicMock(success=True, result={})

        mock_tool_registry.execute_tool = mock_execute

        with patch('core.workflow_automation.get_tool_registry', return_value=mock_tool_registry):
            engine = WorkflowEngine()

            workflow = {
                "id": "wf-789",
                "steps": [
                    {"id": "step1", "tool": "tool1", "depends_on": []},
                    {"id": "step2", "tool": "tool2", "depends_on": ["step1"]},
                    {"id": "step3", "tool": "tool3", "depends_on": ["step2"]},
                ]
            }

            await engine.execute(workflow)

            # Verify execution order respects dependencies
            assert call_order.index("tool1") < call_order.index("tool2")
            assert call_order.index("tool2") < call_order.index("tool3")

    @pytest.mark.asyncio
    async def test_workflow_failure_handling(self, mock_tool_registry):
        """Test handling workflow step failure."""
        from core.workflow_automation import WorkflowEngine

        mock_tool_registry.execute_tool.return_value = MagicMock(
            success=False,
            result=None,
            error="Step failed"
        )

        with patch('core.workflow_automation.get_tool_registry', return_value=mock_tool_registry):
            engine = WorkflowEngine()

            workflow = {
                "id": "wf-fail",
                "steps": [
                    {"id": "step1", "tool": "failing/tool", "params": {}}
                ]
            }

            result = await engine.execute(workflow)

            assert result["status"] == "failed"
            assert "error" in result

    @pytest.mark.asyncio
    async def test_workflow_cancellation(self, mock_tool_registry):
        """Test workflow cancellation."""
        from core.workflow_automation import WorkflowEngine

        with patch('core.workflow_automation.get_tool_registry', return_value=mock_tool_registry):
            engine = WorkflowEngine()

            workflow = {
                "id": "wf-cancel",
                "steps": [{"tool": "test/tool"}]
            }

            # Start execution
            task = asyncio.create_task(engine.execute(workflow))

            # Cancel
            await engine.cancel("wf-cancel")

            # Workflow should be marked as cancelled
            status = engine.get_status("wf-cancel")
            assert status in ["cancelled", "cancelling", None]


@pytest.mark.unit
@pytest.mark.core
class TestAutomationSuggester:
    """Tests for AutomationSuggester."""

    def test_suggester_initialization(self):
        """Test automation suggester initialization."""
        from core.workflow_automation import AutomationSuggester

        suggester = AutomationSuggester()

        assert suggester is not None

    def test_suggest_from_patterns(self):
        """Test suggesting automations from patterns."""
        from core.workflow_automation import AutomationSuggester

        suggester = AutomationSuggester()

        patterns = [
            {
                "sequence": [{"tool": "tool1"}, {"tool": "tool2"}],
                "frequency": 10,
                "confidence": 0.9
            }
        ]

        suggestions = suggester.suggest_automations(patterns)

        assert len(suggestions) > 0
        assert suggestions[0]["workflow_template"] is not None

    def test_prioritize_suggestions(self):
        """Test prioritizing suggestions by impact."""
        from core.workflow_automation import AutomationSuggester

        suggester = AutomationSuggester()

        patterns = [
            {"sequence": [{"tool": "tool1"}], "frequency": 100, "confidence": 0.8},
            {"sequence": [{"tool": "tool2"}], "frequency": 5, "confidence": 0.95},
        ]

        suggestions = suggester.suggest_automations(patterns)

        # Higher frequency/confidence should be prioritized
        if len(suggestions) >= 2:
            assert suggestions[0]["priority"] >= suggestions[1]["priority"]

    def test_estimate_time_savings(self):
        """Test estimating time savings from automation."""
        from core.workflow_automation import AutomationSuggester

        suggester = AutomationSuggester()

        pattern = {
            "sequence": [
                {"tool": "tool1", "avg_duration": 5.0},
                {"tool": "tool2", "avg_duration": 3.0}
            ],
            "frequency": 10
        }

        savings = suggester.estimate_savings(pattern)

        # Should calculate potential time savings
        assert savings["time_per_execution"] > 0
        assert savings["total_time_saved"] > 0


@pytest.mark.unit
@pytest.mark.core
class TestWorkflowAutomationCoordinator:
    """Tests for WorkflowAutomationCoordinator."""

    def test_coordinator_initialization(self):
        """Test coordinator initialization."""
        from core.workflow_automation import WorkflowAutomationCoordinator

        coordinator = WorkflowAutomationCoordinator()

        assert coordinator is not None
        assert hasattr(coordinator, 'recorder')
        assert hasattr(coordinator, 'recognizer')
        assert hasattr(coordinator, 'engine')
        assert hasattr(coordinator, 'suggester')

    @pytest.mark.asyncio
    async def test_create_automation_from_recording(self, mock_tool_registry):
        """Test creating automation from recorded workflow."""
        from core.workflow_automation import WorkflowAutomationCoordinator

        with patch('core.workflow_automation.get_tool_registry', return_value=mock_tool_registry):
            coordinator = WorkflowAutomationCoordinator()

            # Record a workflow
            session_id = coordinator.recorder.start_recording("user-123")
            coordinator.recorder.record_action(session_id, "tool_call", "tool1", {})
            coordinator.recorder.record_action(session_id, "tool_call", "tool2", {})
            workflow = coordinator.recorder.stop_recording(session_id)

            # Create automation
            automation = await coordinator.create_automation(
                name="Test Automation",
                workflow=workflow,
                trigger={"type": "manual"}
            )

            assert automation["id"] is not None
            assert automation["name"] == "Test Automation"

    @pytest.mark.asyncio
    async def test_get_automation_suggestions(self):
        """Test getting automation suggestions."""
        from core.workflow_automation import WorkflowAutomationCoordinator

        coordinator = WorkflowAutomationCoordinator()

        # Add some historical workflows
        for _ in range(5):
            session_id = coordinator.recorder.start_recording("user-123")
            coordinator.recorder.record_action(session_id, "tool_call", "common/tool", {})
            coordinator.recorder.stop_recording(session_id)

        suggestions = await coordinator.get_suggestions(user_id="user-123")

        assert isinstance(suggestions, list)
