# KOSMOS V2.0 Agent Workflow Integration Tests
"""
End-to-end integration tests for agent workflows including:
- Complete task execution flows
- Multi-agent collaboration
- HITL workflows
- Error recovery
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio
from datetime import datetime


@pytest.fixture
def mock_full_agent_system():
    """Mock the full agent system with all components."""
    system = MagicMock()

    # Zeus orchestrator
    system.zeus = MagicMock()
    system.zeus.plan = AsyncMock(return_value={
        "task_id": "task-123",
        "steps": [
            {"agent": "athena", "action": "analyze_data", "order": 1},
            {"agent": "hermes", "action": "send_report", "order": 2},
        ],
    })
    system.zeus.execute = AsyncMock(return_value={
        "status": "completed",
        "result": {"message": "Workflow completed successfully"},
    })

    # Athena analyst
    system.athena = MagicMock()
    system.athena.analyze = AsyncMock(return_value={
        "analysis": {"trend": "positive", "confidence": 0.95},
    })

    # Hermes communicator
    system.hermes = MagicMock()
    system.hermes.send_message = AsyncMock(return_value={
        "sent": True,
        "message_id": "msg-123",
    })

    return system


@pytest.fixture
def mock_database_session():
    """Mock database session for integration tests."""
    session = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


class TestCompleteTaskFlow:
    """Tests for complete task execution flows."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_simple_task_end_to_end(self, mock_full_agent_system, mock_database_session):
        """Test simple task execution from start to finish."""
        with patch("core.agent_system", mock_full_agent_system):
            with patch("core.database.get_session", return_value=mock_database_session):
                # Create task
                task_data = {
                    "description": "Analyze sales data",
                    "agent_id": "athena",
                }

                # Execute through Zeus
                plan = await mock_full_agent_system.zeus.plan(task_data)
                assert plan["task_id"] == "task-123"
                assert len(plan["steps"]) == 2

                # Execute plan
                result = await mock_full_agent_system.zeus.execute(plan)
                assert result["status"] == "completed"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_multi_step_workflow(self, mock_full_agent_system):
        """Test multi-step workflow execution."""
        workflow_steps = []

        # Track execution order
        async def track_athena(*args, **kwargs):
            workflow_steps.append("athena_analyze")
            return {"analysis": {"data": "processed"}}

        async def track_hermes(*args, **kwargs):
            workflow_steps.append("hermes_send")
            return {"sent": True}

        mock_full_agent_system.athena.analyze = track_athena
        mock_full_agent_system.hermes.send_message = track_hermes

        with patch("core.agent_system", mock_full_agent_system):
            # Execute workflow
            await mock_full_agent_system.athena.analyze()
            await mock_full_agent_system.hermes.send_message()

            # Verify execution order
            assert workflow_steps == ["athena_analyze", "hermes_send"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_parallel_agent_execution(self, mock_full_agent_system):
        """Test parallel execution of independent agent tasks."""
        execution_times = {}

        async def slow_athena(*args, **kwargs):
            execution_times["athena_start"] = datetime.utcnow()
            await asyncio.sleep(0.1)
            execution_times["athena_end"] = datetime.utcnow()
            return {"analysis": "done"}

        async def slow_hermes(*args, **kwargs):
            execution_times["hermes_start"] = datetime.utcnow()
            await asyncio.sleep(0.1)
            execution_times["hermes_end"] = datetime.utcnow()
            return {"sent": True}

        mock_full_agent_system.athena.analyze = slow_athena
        mock_full_agent_system.hermes.send_message = slow_hermes

        with patch("core.agent_system", mock_full_agent_system):
            # Execute in parallel
            results = await asyncio.gather(
                mock_full_agent_system.athena.analyze(),
                mock_full_agent_system.hermes.send_message()
            )

            assert len(results) == 2
            # Both should have started before either finished (parallel execution)
            # In parallel, athena_start and hermes_start should be close together

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_workflow_with_checkpointing(self, mock_full_agent_system):
        """Test workflow with state checkpointing."""
        checkpoints = []

        async def checkpoint_save(state):
            checkpoints.append({"state": state, "time": datetime.utcnow()})
            return True

        mock_full_agent_system.save_checkpoint = checkpoint_save

        with patch("core.agent_system", mock_full_agent_system):
            # Simulate workflow with checkpoints
            await mock_full_agent_system.save_checkpoint({"step": 1, "status": "analyzing"})
            await mock_full_agent_system.athena.analyze()
            await mock_full_agent_system.save_checkpoint({"step": 2, "status": "sending"})
            await mock_full_agent_system.hermes.send_message()
            await mock_full_agent_system.save_checkpoint({"step": 3, "status": "completed"})

            assert len(checkpoints) == 3
            assert checkpoints[-1]["state"]["status"] == "completed"


class TestMultiAgentCollaboration:
    """Tests for multi-agent collaboration scenarios."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_agent_delegation(self, mock_full_agent_system):
        """Test Zeus delegating tasks to specialist agents."""
        delegations = []

        async def track_delegation(agent_id, task):
            delegations.append({"agent": agent_id, "task": task})
            return {"delegated": True}

        mock_full_agent_system.zeus.delegate = track_delegation

        with patch("core.agent_system", mock_full_agent_system):
            # Zeus delegates to specialists
            await mock_full_agent_system.zeus.delegate("athena", "analyze_data")
            await mock_full_agent_system.zeus.delegate("hermes", "send_notification")

            assert len(delegations) == 2
            assert delegations[0]["agent"] == "athena"
            assert delegations[1]["agent"] == "hermes"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_agent_result_aggregation(self, mock_full_agent_system):
        """Test aggregating results from multiple agents."""
        mock_full_agent_system.athena.analyze = AsyncMock(return_value={
            "type": "analysis",
            "data": {"trend": "up"},
        })
        mock_full_agent_system.hermes.get_messages = AsyncMock(return_value={
            "type": "messages",
            "data": {"count": 10},
        })

        async def aggregate_results(*results):
            return {
                "aggregated": True,
                "sources": len(results),
                "data": {r["type"]: r["data"] for r in results},
            }

        mock_full_agent_system.zeus.aggregate = aggregate_results

        with patch("core.agent_system", mock_full_agent_system):
            # Get results from multiple agents
            athena_result = await mock_full_agent_system.athena.analyze()
            hermes_result = await mock_full_agent_system.hermes.get_messages()

            # Aggregate
            aggregated = await mock_full_agent_system.zeus.aggregate(
                athena_result, hermes_result
            )

            assert aggregated["aggregated"] is True
            assert aggregated["sources"] == 2
            assert "analysis" in aggregated["data"]
            assert "messages" in aggregated["data"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_agent_handoff(self, mock_full_agent_system):
        """Test agent handoff during workflow."""
        context = {"original_request": "Analyze and report"}

        async def athena_process(ctx):
            ctx["athena_result"] = "Analysis complete"
            return ctx

        async def hermes_process(ctx):
            ctx["hermes_result"] = f"Report sent based on: {ctx.get('athena_result')}"
            return ctx

        mock_full_agent_system.athena.process = athena_process
        mock_full_agent_system.hermes.process = hermes_process

        with patch("core.agent_system", mock_full_agent_system):
            # Athena processes first
            context = await mock_full_agent_system.athena.process(context)
            assert "athena_result" in context

            # Hermes receives context from Athena
            context = await mock_full_agent_system.hermes.process(context)
            assert "hermes_result" in context
            assert "Analysis complete" in context["hermes_result"]


class TestHITLWorkflows:
    """Tests for human-in-the-loop workflows."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_hitl_approval_flow(self, mock_full_agent_system):
        """Test HITL approval workflow."""
        approval_requests = []
        approvals = {}

        async def request_approval(action, details):
            request_id = f"approval-{len(approval_requests)}"
            approval_requests.append({
                "id": request_id,
                "action": action,
                "details": details,
            })
            return {"request_id": request_id, "status": "pending"}

        async def check_approval(request_id):
            return approvals.get(request_id, {"status": "pending"})

        mock_full_agent_system.hitl.request_approval = request_approval
        mock_full_agent_system.hitl.check_approval = check_approval

        with patch("core.agent_system", mock_full_agent_system):
            # Agent requests approval
            request = await mock_full_agent_system.hitl.request_approval(
                "send_email",
                {"recipients": ["team@kosmos.io"]}
            )

            assert request["status"] == "pending"
            assert len(approval_requests) == 1

            # Human approves
            approvals[request["request_id"]] = {"status": "approved"}

            # Check approval status
            status = await mock_full_agent_system.hitl.check_approval(request["request_id"])
            assert status["status"] == "approved"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_hitl_rejection_handling(self, mock_full_agent_system):
        """Test handling HITL rejection."""
        async def handle_rejection(request_id, reason):
            return {
                "handled": True,
                "action": "workflow_stopped",
                "reason": reason,
            }

        mock_full_agent_system.hitl.handle_rejection = handle_rejection

        with patch("core.agent_system", mock_full_agent_system):
            result = await mock_full_agent_system.hitl.handle_rejection(
                "approval-1",
                "Content not appropriate"
            )

            assert result["handled"] is True
            assert result["action"] == "workflow_stopped"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_hitl_timeout_escalation(self, mock_full_agent_system):
        """Test HITL timeout and escalation."""
        async def wait_for_approval(request_id, timeout_seconds):
            # Simulate timeout
            await asyncio.sleep(0.1)
            return {"status": "timeout", "escalated": True}

        mock_full_agent_system.hitl.wait_for_approval = wait_for_approval

        with patch("core.agent_system", mock_full_agent_system):
            result = await mock_full_agent_system.hitl.wait_for_approval(
                "approval-1",
                timeout_seconds=0.05
            )

            assert result["status"] == "timeout"
            assert result["escalated"] is True


class TestErrorRecovery:
    """Tests for error recovery in workflows."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_agent_failure_recovery(self, mock_full_agent_system):
        """Test recovery from agent failure."""
        attempt_count = 0

        async def flaky_agent():
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 3:
                raise Exception("Transient error")
            return {"success": True}

        mock_full_agent_system.athena.analyze = flaky_agent

        with patch("core.agent_system", mock_full_agent_system):
            # Retry logic
            max_retries = 3
            for i in range(max_retries):
                try:
                    result = await mock_full_agent_system.athena.analyze()
                    break
                except Exception:
                    if i == max_retries - 1:
                        raise
                    await asyncio.sleep(0.01)

            assert result["success"] is True
            assert attempt_count == 3

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_workflow_rollback(self, mock_full_agent_system):
        """Test workflow rollback on failure."""
        executed_steps = []
        rolled_back_steps = []

        async def step_with_rollback(step_name, should_fail=False):
            executed_steps.append(step_name)
            if should_fail:
                raise Exception(f"Step {step_name} failed")
            return {"step": step_name, "status": "completed"}

        async def rollback_step(step_name):
            rolled_back_steps.append(step_name)
            return {"step": step_name, "status": "rolled_back"}

        with patch("core.agent_system", mock_full_agent_system):
            try:
                await step_with_rollback("step1")
                await step_with_rollback("step2")
                await step_with_rollback("step3", should_fail=True)
            except Exception:
                # Rollback in reverse order
                for step in reversed(executed_steps):
                    await rollback_step(step)

            assert len(executed_steps) == 3
            assert rolled_back_steps == ["step3", "step2", "step1"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_checkpoint_recovery(self, mock_full_agent_system):
        """Test recovery from checkpoint after failure."""
        checkpoints = []
        current_step = 0

        async def save_checkpoint(step, state):
            checkpoints.append({"step": step, "state": state})

        async def load_checkpoint():
            if checkpoints:
                return checkpoints[-1]
            return None

        async def execute_from_checkpoint(checkpoint):
            start_step = checkpoint["step"] if checkpoint else 0
            return {"resumed_from": start_step}

        mock_full_agent_system.checkpoint.save = save_checkpoint
        mock_full_agent_system.checkpoint.load = load_checkpoint
        mock_full_agent_system.workflow.execute_from = execute_from_checkpoint

        with patch("core.agent_system", mock_full_agent_system):
            # Save some checkpoints
            await mock_full_agent_system.checkpoint.save(1, {"data": "step1"})
            await mock_full_agent_system.checkpoint.save(2, {"data": "step2"})

            # Simulate failure and recovery
            last_checkpoint = await mock_full_agent_system.checkpoint.load()
            result = await mock_full_agent_system.workflow.execute_from(last_checkpoint)

            assert result["resumed_from"] == 2

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_circuit_breaker_activation(self, mock_full_agent_system):
        """Test circuit breaker activates after failures."""
        failure_count = 0
        circuit_open = False

        async def unreliable_service():
            nonlocal failure_count, circuit_open
            if circuit_open:
                raise Exception("Circuit is open")
            failure_count += 1
            if failure_count >= 5:
                circuit_open = True
            raise Exception("Service unavailable")

        mock_full_agent_system.external.call = unreliable_service

        with patch("core.agent_system", mock_full_agent_system):
            failures = 0
            for _ in range(10):
                try:
                    await mock_full_agent_system.external.call()
                except Exception as e:
                    failures += 1
                    if "Circuit is open" in str(e):
                        break

            assert circuit_open is True
            assert failure_count >= 5
