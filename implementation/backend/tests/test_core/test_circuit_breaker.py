"""
Tests for Circuit Breaker

Tests the circuit breaker pattern implementation for fault tolerance.
"""

import asyncio
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Import will be mocked in tests
# from core.circuit_breaker import (
#     CircuitBreaker, CircuitBreakerConfig, CircuitState,
#     CircuitBreakerRegistry, CircuitStats
# )


@pytest.mark.unit
@pytest.mark.core
class TestCircuitBreakerConfig:
    """Tests for CircuitBreakerConfig."""

    def test_default_config(self):
        """Test default configuration values."""
        from core.circuit_breaker import CircuitBreakerConfig
        config = CircuitBreakerConfig()

        assert config.failure_threshold == 5
        assert config.success_threshold == 3
        assert config.recovery_timeout == timedelta(seconds=60)
        assert config.half_open_max_calls == 3

    def test_custom_config(self):
        """Test custom configuration values."""
        from core.circuit_breaker import CircuitBreakerConfig
        config = CircuitBreakerConfig(
            failure_threshold=10,
            success_threshold=5,
            recovery_timeout=timedelta(seconds=120),
            half_open_max_calls=5
        )

        assert config.failure_threshold == 10
        assert config.success_threshold == 5
        assert config.recovery_timeout == timedelta(seconds=120)
        assert config.half_open_max_calls == 5


@pytest.mark.unit
@pytest.mark.core
class TestCircuitBreaker:
    """Tests for CircuitBreaker."""

    def test_initial_state_is_closed(self):
        """Test that circuit breaker starts in closed state."""
        from core.circuit_breaker import CircuitBreaker, CircuitState
        cb = CircuitBreaker(name="test-service")

        assert cb.state == CircuitState.CLOSED

    def test_allow_request_when_closed(self):
        """Test that requests are allowed when circuit is closed."""
        from core.circuit_breaker import CircuitBreaker
        cb = CircuitBreaker(name="test-service")

        assert cb.allow_request() is True

    def test_record_success_increments_stats(self):
        """Test that recording success updates statistics."""
        from core.circuit_breaker import CircuitBreaker
        cb = CircuitBreaker(name="test-service")

        cb.record_success()

        assert cb.stats.successful_calls == 1
        assert cb.stats.total_calls == 1
        assert cb.stats.consecutive_successes == 1

    def test_record_failure_increments_stats(self):
        """Test that recording failure updates statistics."""
        from core.circuit_breaker import CircuitBreaker
        cb = CircuitBreaker(name="test-service")

        cb.record_failure()

        assert cb.stats.failed_calls == 1
        assert cb.stats.total_calls == 1
        assert cb.stats.consecutive_failures == 1

    def test_opens_after_failure_threshold(self, circuit_breaker_config):
        """Test that circuit opens after reaching failure threshold."""
        from core.circuit_breaker import CircuitBreaker, CircuitState
        cb = CircuitBreaker(
            name="test-service",
            failure_threshold=circuit_breaker_config.failure_threshold,
            success_threshold=circuit_breaker_config.success_threshold,
            recovery_timeout=circuit_breaker_config.recovery_timeout,
            half_open_max_calls=circuit_breaker_config.half_open_max_calls,
        )

        # Record failures up to threshold
        for _ in range(circuit_breaker_config.failure_threshold):
            cb.record_failure()

        assert cb.state == CircuitState.OPEN

    def test_rejects_requests_when_open(self, circuit_breaker_config):
        """Test that requests are rejected when circuit is open."""
        from core.circuit_breaker import CircuitBreaker, CircuitState
        cb = CircuitBreaker(
            name="test-service",
            failure_threshold=circuit_breaker_config.failure_threshold,
            success_threshold=circuit_breaker_config.success_threshold,
            recovery_timeout=circuit_breaker_config.recovery_timeout,
            half_open_max_calls=circuit_breaker_config.half_open_max_calls,
        )

        # Force open state
        for _ in range(circuit_breaker_config.failure_threshold):
            cb.record_failure()

        assert cb.state == CircuitState.OPEN
        assert cb.allow_request() is False

    def test_transitions_to_half_open_after_timeout(self):
        """Test that circuit transitions to half-open after recovery timeout."""
        from core.circuit_breaker import CircuitBreaker, CircuitState
        from datetime import timedelta

        # Use very short timeout for test
        cb = CircuitBreaker(
            name="test-service",
            failure_threshold=3,
            success_threshold=2,
            recovery_timeout=timedelta(milliseconds=10),
            half_open_max_calls=2,
        )

        # Force open state
        for _ in range(3):
            cb.record_failure()

        assert cb.state == CircuitState.OPEN

        # Wait for recovery timeout
        import time
        time.sleep(0.02)

        # Should transition to half-open on next request check
        cb.allow_request()
        assert cb.state == CircuitState.HALF_OPEN

    def test_closes_after_success_threshold_in_half_open(self):
        """Test that circuit closes after success threshold in half-open."""
        from core.circuit_breaker import CircuitBreaker, CircuitState
        from datetime import timedelta

        cb = CircuitBreaker(
            name="test-service",
            failure_threshold=3,
            success_threshold=2,
            recovery_timeout=timedelta(milliseconds=1),
            half_open_max_calls=3,
        )

        # Force open state
        for _ in range(3):
            cb.record_failure()

        # Wait and transition to half-open
        import time
        time.sleep(0.01)
        cb.allow_request()

        # Record successes in half-open
        for _ in range(2):
            cb.record_success()

        assert cb.state == CircuitState.CLOSED

    def test_reopens_on_failure_in_half_open(self):
        """Test that circuit reopens on failure in half-open state."""
        from core.circuit_breaker import CircuitBreaker, CircuitState
        from datetime import timedelta

        cb = CircuitBreaker(
            name="test-service",
            failure_threshold=3,
            success_threshold=2,
            recovery_timeout=timedelta(milliseconds=1),
            half_open_max_calls=3,
        )

        # Force open state
        for _ in range(3):
            cb.record_failure()

        # Wait and transition to half-open
        import time
        time.sleep(0.01)
        cb.allow_request()

        assert cb.state == CircuitState.HALF_OPEN

        # Record failure in half-open
        cb.record_failure()

        assert cb.state == CircuitState.OPEN

    def test_stats_reset_on_state_change(self):
        """Test that consecutive counters reset on state change."""
        from core.circuit_breaker import CircuitBreaker
        from datetime import timedelta

        cb = CircuitBreaker(
            name="test-service",
            failure_threshold=3,
            success_threshold=2,
            recovery_timeout=timedelta(milliseconds=1),
            half_open_max_calls=3,
        )

        # Record some successes
        cb.record_success()
        cb.record_success()
        assert cb.stats.consecutive_successes == 2

        # Record failure resets consecutive successes
        cb.record_failure()
        assert cb.stats.consecutive_successes == 0
        assert cb.stats.consecutive_failures == 1


@pytest.mark.unit
@pytest.mark.core
class TestCircuitBreakerDecorator:
    """Tests for circuit breaker decorator."""

    @pytest.mark.asyncio
    async def test_protect_decorator_success(self):
        """Test that protect decorator allows successful calls."""
        from core.circuit_breaker import CircuitBreaker

        cb = CircuitBreaker(name="test-service")

        @cb.protect
        async def successful_call():
            return "success"

        result = await successful_call()

        assert result == "success"
        assert cb.stats.successful_calls == 1

    @pytest.mark.asyncio
    async def test_protect_decorator_failure(self):
        """Test that protect decorator records failures."""
        from core.circuit_breaker import CircuitBreaker

        cb = CircuitBreaker(name="test-service")

        @cb.protect
        async def failing_call():
            raise ValueError("Test error")

        with pytest.raises(ValueError):
            await failing_call()

        assert cb.stats.failed_calls == 1

    @pytest.mark.asyncio
    async def test_protect_decorator_rejects_when_open(self, circuit_breaker_config):
        """Test that protect decorator rejects calls when circuit is open."""
        from core.circuit_breaker import CircuitBreaker, CircuitOpenError

        cb = CircuitBreaker(
            name="test-service",
            failure_threshold=circuit_breaker_config.failure_threshold,
            success_threshold=circuit_breaker_config.success_threshold,
            recovery_timeout=circuit_breaker_config.recovery_timeout,
            half_open_max_calls=circuit_breaker_config.half_open_max_calls,
        )

        @cb.protect
        async def call():
            raise ValueError("Fail")

        # Force open state
        for _ in range(circuit_breaker_config.failure_threshold):
            try:
                await call()
            except ValueError:
                pass

        # Next call should be rejected
        with pytest.raises(CircuitOpenError):
            await call()


@pytest.mark.unit
@pytest.mark.core
class TestCircuitBreakerRegistry:
    """Tests for CircuitBreakerRegistry."""

    def test_get_or_create_circuit_breaker(self):
        """Test getting or creating a circuit breaker."""
        from core.circuit_breaker import CircuitBreakerRegistry

        registry = CircuitBreakerRegistry()

        cb1 = registry.get_or_create("service-1")
        cb2 = registry.get_or_create("service-1")
        cb3 = registry.get_or_create("service-2")

        assert cb1 is cb2  # Same instance
        assert cb1 is not cb3  # Different instance

    def test_get_all_circuit_breakers(self):
        """Test getting all circuit breakers status."""
        from core.circuit_breaker import CircuitBreakerRegistry

        registry = CircuitBreakerRegistry()

        registry.get_or_create("service-1")
        registry.get_or_create("service-2")

        all_status = registry.get_all_status()

        assert len(all_status) == 2
        assert "service-1" in all_status
        assert "service-2" in all_status

    def test_get_stats_for_all(self):
        """Test getting stats for all circuit breakers."""
        from core.circuit_breaker import CircuitBreakerRegistry

        registry = CircuitBreakerRegistry()

        cb1 = registry.get_or_create("service-1")
        cb2 = registry.get_or_create("service-2")

        cb1.record_success()
        cb2.record_failure()

        all_status = registry.get_all_status()

        assert all_status["service-1"]["stats"]["successful_calls"] == 1
        assert all_status["service-2"]["stats"]["failed_calls"] == 1


@pytest.mark.unit
@pytest.mark.core
class TestCircuitStats:
    """Tests for CircuitStats."""

    def test_initial_stats(self):
        """Test initial statistics values."""
        from core.circuit_breaker import CircuitStats

        stats = CircuitStats()

        assert stats.total_calls == 0
        assert stats.successful_calls == 0
        assert stats.failed_calls == 0
        assert stats.rejected_calls == 0
        assert stats.last_failure_time is None
        assert stats.last_success_time is None

    def test_success_rate_calculation(self):
        """Test success rate calculation."""
        from core.circuit_breaker import CircuitStats

        stats = CircuitStats(
            total_calls=100,
            successful_calls=80,
            failed_calls=15,
            rejected_calls=5
        )

        # Success rate should be 80/100 = 0.8 or 80%
        expected_rate = 80 / 100
        assert stats.successful_calls / stats.total_calls == expected_rate
