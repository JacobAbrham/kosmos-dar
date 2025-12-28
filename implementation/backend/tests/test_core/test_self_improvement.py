"""
Tests for Self-Improvement System

Tests performance monitoring, prompt tuning, tool optimization, and error pattern learning.
"""

import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.unit
@pytest.mark.core
class TestPerformanceMonitor:
    """Tests for PerformanceMonitor."""

    def test_monitor_initialization(self):
        """Test performance monitor initialization."""
        from core.self_improvement import PerformanceMonitor

        monitor = PerformanceMonitor()

        assert monitor is not None
        assert hasattr(monitor, 'record_metric')
        assert hasattr(monitor, 'get_metrics')

    def test_record_metric(self):
        """Test recording a performance metric."""
        from core.self_improvement import PerformanceMonitor

        monitor = PerformanceMonitor()

        monitor.record_metric(
            name="response_time",
            value=0.5,
            agent="chronos",
            context={"intent": "schedule_meeting"}
        )

        metrics = monitor.get_metrics(agent="chronos")

        assert len(metrics) > 0
        assert metrics[0]["name"] == "response_time"
        assert metrics[0]["value"] == 0.5

    def test_record_multiple_metrics(self):
        """Test recording multiple metrics."""
        from core.self_improvement import PerformanceMonitor

        monitor = PerformanceMonitor()

        for i in range(10):
            monitor.record_metric(
                name="response_time",
                value=0.1 * (i + 1),
                agent="hermes"
            )

        metrics = monitor.get_metrics(agent="hermes", name="response_time")

        assert len(metrics) == 10

    def test_calculate_average_metric(self):
        """Test calculating average of a metric."""
        from core.self_improvement import PerformanceMonitor

        monitor = PerformanceMonitor()

        values = [0.1, 0.2, 0.3, 0.4, 0.5]
        for v in values:
            monitor.record_metric("test_metric", v, agent="test")

        avg = monitor.get_average("test_metric", agent="test")

        assert abs(avg - 0.3) < 0.001

    def test_calculate_percentile(self):
        """Test calculating percentile of a metric."""
        from core.self_improvement import PerformanceMonitor

        monitor = PerformanceMonitor()

        for i in range(100):
            monitor.record_metric("latency", i, agent="test")

        p95 = monitor.get_percentile("latency", 95, agent="test")

        assert p95 >= 94  # 95th percentile of 0-99

    def test_detect_anomaly(self):
        """Test anomaly detection in metrics."""
        from core.self_improvement import PerformanceMonitor

        monitor = PerformanceMonitor()

        # Record normal values
        for _ in range(100):
            monitor.record_metric("response_time", 0.5, agent="test")

        # Record anomaly
        monitor.record_metric("response_time", 10.0, agent="test")  # Much higher

        anomalies = monitor.detect_anomalies("response_time", agent="test")

        assert len(anomalies) > 0
        assert anomalies[0]["value"] == 10.0


@pytest.mark.unit
@pytest.mark.core
class TestPromptTuner:
    """Tests for PromptTuner."""

    def test_tuner_initialization(self):
        """Test prompt tuner initialization."""
        from core.self_improvement import PromptTuner

        tuner = PromptTuner()

        assert tuner is not None

    @pytest.mark.asyncio
    async def test_evaluate_prompt(self):
        """Test evaluating a prompt's effectiveness."""
        from core.self_improvement import PromptTuner

        tuner = PromptTuner()

        score = await tuner.evaluate_prompt(
            prompt="You are a helpful assistant",
            responses=["Good response", "Another good response"],
            metrics={"accuracy": 0.9, "relevance": 0.85}
        )

        assert 0 <= score <= 1

    @pytest.mark.asyncio
    async def test_suggest_improvement(self):
        """Test suggesting prompt improvements."""
        from core.self_improvement import PromptTuner

        tuner = PromptTuner()

        suggestion = await tuner.suggest_improvement(
            prompt="You are an assistant",
            issue="responses are too verbose"
        )

        assert suggestion is not None
        assert isinstance(suggestion, str)

    @pytest.mark.asyncio
    async def test_ab_test_prompts(self):
        """Test A/B testing prompts."""
        from core.self_improvement import PromptTuner

        tuner = PromptTuner()

        result = await tuner.ab_test(
            prompt_a="You are a helpful assistant",
            prompt_b="You are a concise assistant",
            test_queries=["Hello", "What is 2+2?", "Tell me a joke"]
        )

        assert "winner" in result
        assert result["winner"] in ["a", "b", "tie"]

    def test_get_prompt_history(self):
        """Test getting prompt version history."""
        from core.self_improvement import PromptTuner

        tuner = PromptTuner()

        # Record some prompt versions
        tuner.record_prompt_version(
            agent="chronos",
            version="1.0",
            prompt="Original prompt",
            score=0.8
        )

        tuner.record_prompt_version(
            agent="chronos",
            version="1.1",
            prompt="Improved prompt",
            score=0.85
        )

        history = tuner.get_prompt_history("chronos")

        assert len(history) >= 2


@pytest.mark.unit
@pytest.mark.core
class TestToolOptimizer:
    """Tests for ToolOptimizer."""

    def test_optimizer_initialization(self):
        """Test tool optimizer initialization."""
        from core.self_improvement import ToolOptimizer

        optimizer = ToolOptimizer()

        assert optimizer is not None

    def test_record_tool_usage(self):
        """Test recording tool usage."""
        from core.self_improvement import ToolOptimizer

        optimizer = ToolOptimizer()

        optimizer.record_usage(
            tool_path="postgres/query",
            success=True,
            execution_time=0.5,
            context={"query_type": "select"}
        )

        stats = optimizer.get_tool_stats("postgres/query")

        assert stats["total_calls"] >= 1
        assert stats["success_rate"] > 0

    def test_identify_slow_tools(self):
        """Test identifying slow tools."""
        from core.self_improvement import ToolOptimizer

        optimizer = ToolOptimizer()

        # Record fast tool
        for _ in range(10):
            optimizer.record_usage("fast/tool", True, 0.1)

        # Record slow tool
        for _ in range(10):
            optimizer.record_usage("slow/tool", True, 5.0)

        slow_tools = optimizer.identify_slow_tools(threshold_seconds=1.0)

        assert any(t["tool_path"] == "slow/tool" for t in slow_tools)
        assert not any(t["tool_path"] == "fast/tool" for t in slow_tools)

    def test_identify_unreliable_tools(self):
        """Test identifying unreliable tools."""
        from core.self_improvement import ToolOptimizer

        optimizer = ToolOptimizer()

        # Record reliable tool
        for _ in range(10):
            optimizer.record_usage("reliable/tool", True, 0.1)

        # Record unreliable tool (50% failure)
        for i in range(10):
            optimizer.record_usage("unreliable/tool", i % 2 == 0, 0.1)

        unreliable = optimizer.identify_unreliable_tools(threshold=0.7)

        assert any(t["tool_path"] == "unreliable/tool" for t in unreliable)

    @pytest.mark.asyncio
    async def test_suggest_tool_alternatives(self):
        """Test suggesting alternative tools."""
        from core.self_improvement import ToolOptimizer

        optimizer = ToolOptimizer()

        alternatives = await optimizer.suggest_alternatives(
            tool_path="postgres/query",
            reason="slow_performance"
        )

        assert isinstance(alternatives, list)

    def test_get_optimal_tools_for_task(self):
        """Test getting optimal tools for a task."""
        from core.self_improvement import ToolOptimizer

        optimizer = ToolOptimizer()

        # Record usage for multiple tools
        optimizer.record_usage("tool_a", True, 0.1)
        optimizer.record_usage("tool_b", True, 0.5)
        optimizer.record_usage("tool_c", False, 0.1)

        optimal = optimizer.get_optimal_tools(
            task_type="data_query",
            max_results=3
        )

        assert isinstance(optimal, list)


@pytest.mark.unit
@pytest.mark.core
class TestErrorPatternLearner:
    """Tests for ErrorPatternLearner."""

    def test_learner_initialization(self):
        """Test error pattern learner initialization."""
        from core.self_improvement import ErrorPatternLearner

        learner = ErrorPatternLearner()

        assert learner is not None

    def test_record_error(self):
        """Test recording an error."""
        from core.self_improvement import ErrorPatternLearner

        learner = ErrorPatternLearner()

        learner.record_error(
            error_type="ConnectionError",
            message="Failed to connect to database",
            context={"agent": "hermes", "tool": "postgres/query"}
        )

        errors = learner.get_errors()

        assert len(errors) > 0

    def test_identify_patterns(self):
        """Test identifying error patterns."""
        from core.self_improvement import ErrorPatternLearner

        learner = ErrorPatternLearner()

        # Record similar errors
        for _ in range(5):
            learner.record_error(
                error_type="TimeoutError",
                message="Request timed out",
                context={"tool": "slow_api"}
            )

        patterns = learner.identify_patterns()

        assert len(patterns) > 0
        assert any(p["error_type"] == "TimeoutError" for p in patterns)

    @pytest.mark.asyncio
    async def test_suggest_fix(self):
        """Test suggesting fixes for errors."""
        from core.self_improvement import ErrorPatternLearner

        learner = ErrorPatternLearner()

        suggestion = await learner.suggest_fix(
            error_type="ConnectionError",
            message="Connection refused"
        )

        assert suggestion is not None
        assert isinstance(suggestion, dict)
        assert "recommendation" in suggestion

    def test_get_error_frequency(self):
        """Test getting error frequency."""
        from core.self_improvement import ErrorPatternLearner

        learner = ErrorPatternLearner()

        # Record various errors
        for _ in range(10):
            learner.record_error("TypeError", "Type mismatch")

        for _ in range(5):
            learner.record_error("ValueError", "Invalid value")

        frequency = learner.get_error_frequency()

        assert frequency["TypeError"] == 10
        assert frequency["ValueError"] == 5

    def test_get_root_cause_analysis(self):
        """Test root cause analysis."""
        from core.self_improvement import ErrorPatternLearner

        learner = ErrorPatternLearner()

        # Record correlated errors
        for i in range(10):
            learner.record_error(
                "DatabaseError",
                "Query failed",
                context={"time": f"2024-01-01 10:{i:02d}:00", "load": "high"}
            )

        analysis = learner.root_cause_analysis("DatabaseError")

        assert analysis is not None
        assert "factors" in analysis


@pytest.mark.unit
@pytest.mark.core
class TestSelfImprovementCoordinator:
    """Tests for SelfImprovementCoordinator."""

    def test_coordinator_initialization(self):
        """Test coordinator initialization."""
        from core.self_improvement import SelfImprovementCoordinator

        coordinator = SelfImprovementCoordinator()

        assert coordinator is not None
        assert hasattr(coordinator, 'performance_monitor')
        assert hasattr(coordinator, 'prompt_tuner')
        assert hasattr(coordinator, 'tool_optimizer')
        assert hasattr(coordinator, 'error_learner')

    @pytest.mark.asyncio
    async def test_run_improvement_cycle(self):
        """Test running a full improvement cycle."""
        from core.self_improvement import SelfImprovementCoordinator

        coordinator = SelfImprovementCoordinator()

        # Mock the underlying components
        with patch.object(coordinator, 'performance_monitor') as mock_perf:
            with patch.object(coordinator, 'prompt_tuner') as mock_prompt:
                with patch.object(coordinator, 'tool_optimizer') as mock_tool:
                    with patch.object(coordinator, 'error_learner') as mock_error:
                        mock_perf.get_summary = MagicMock(return_value={})
                        mock_prompt.get_suggestions = AsyncMock(return_value=[])
                        mock_tool.get_optimizations = MagicMock(return_value=[])
                        mock_error.get_patterns = MagicMock(return_value=[])

                        report = await coordinator.run_improvement_cycle()

                        assert report is not None
                        assert "performance" in report
                        assert "recommendations" in report

    @pytest.mark.asyncio
    async def test_get_improvement_recommendations(self):
        """Test getting improvement recommendations."""
        from core.self_improvement import SelfImprovementCoordinator

        coordinator = SelfImprovementCoordinator()

        recommendations = await coordinator.get_recommendations()

        assert isinstance(recommendations, list)

    def test_get_system_health(self):
        """Test getting overall system health."""
        from core.self_improvement import SelfImprovementCoordinator

        coordinator = SelfImprovementCoordinator()

        health = coordinator.get_system_health()

        assert "status" in health
        assert health["status"] in ["healthy", "degraded", "critical"]
        assert "components" in health
