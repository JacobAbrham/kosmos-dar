"""
KOSMOS V2.0 Circuit Breaker

Implements the circuit breaker pattern for resilient service calls.
Prevents cascading failures when MCP servers or external services are unavailable.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, Generic, List, Optional, TypeVar

import structlog

logger = structlog.get_logger()

T = TypeVar("T")


class CircuitState(str, Enum):
    """Circuit breaker states."""

    CLOSED = "closed"  # Normal operation, requests pass through
    OPEN = "open"  # Failure threshold exceeded, requests blocked
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker behavior."""

    failure_threshold: int = 5  # Failures before opening
    success_threshold: int = 3  # Successes to close from half-open
    recovery_timeout: timedelta = field(default_factory=lambda: timedelta(seconds=60))
    half_open_max_calls: int = 3  # Max test calls in half-open state


@dataclass
class CircuitStats:
    """Statistics for circuit breaker monitoring."""

    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    rejected_calls: int = 0
    last_failure_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None
    state_changes: int = 0
    consecutive_failures: int = 0
    consecutive_successes: int = 0


class CircuitBreaker:
    """
    Circuit breaker implementation for resilient service calls.

    States:
    - CLOSED: Normal operation. Failures are counted.
    - OPEN: After threshold failures, all calls are rejected.
    - HALF_OPEN: After recovery timeout, limited calls allowed to test service.

    Usage:
        cb = CircuitBreaker(name="my-service")

        # Manual usage
        if cb.allow_request():
            try:
                result = await call_service()
                cb.record_success()
            except Exception as e:
                cb.record_failure()
                raise

        # Decorator usage
        @cb.protect
        async def call_service():
            ...
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 3,
        recovery_timeout: timedelta = timedelta(seconds=60),
        half_open_max_calls: int = 3,
        on_state_change: Optional[
            Callable[[str, CircuitState, CircuitState], None]
        ] = None,
    ):
        self.name = name
        self.config = CircuitBreakerConfig(
            failure_threshold=failure_threshold,
            success_threshold=success_threshold,
            recovery_timeout=recovery_timeout,
            half_open_max_calls=half_open_max_calls,
        )
        self.on_state_change = on_state_change

        self._state = CircuitState.CLOSED
        self._stats = CircuitStats()
        self._opened_at: Optional[datetime] = None
        self._half_open_calls: int = 0
        self._lock = asyncio.Lock()

        self.logger = logger.bind(circuit_breaker=name)

    @property
    def state(self) -> CircuitState:
        """Get current circuit state, checking for recovery timeout."""
        if self._state == CircuitState.OPEN:
            if self._should_attempt_recovery():
                self._transition_to(CircuitState.HALF_OPEN)
        return self._state

    @property
    def stats(self) -> CircuitStats:
        """Get circuit breaker statistics."""
        return self._stats

    def _should_attempt_recovery(self) -> bool:
        """Check if enough time has passed to attempt recovery."""
        if self._opened_at is None:
            return False
        return datetime.utcnow() - self._opened_at >= self.config.recovery_timeout

    def _transition_to(self, new_state: CircuitState) -> None:
        """Transition to a new state."""
        if new_state == self._state:
            return

        old_state = self._state
        self._state = new_state
        self._stats.state_changes += 1

        if new_state == CircuitState.OPEN:
            self._opened_at = datetime.utcnow()
        elif new_state == CircuitState.HALF_OPEN:
            self._half_open_calls = 0
        elif new_state == CircuitState.CLOSED:
            self._stats.consecutive_failures = 0
            self._opened_at = None

        self.logger.info(
            "Circuit state changed",
            from_state=old_state.value,
            to_state=new_state.value,
        )

        if self.on_state_change:
            try:
                self.on_state_change(self.name, old_state, new_state)
            except Exception as e:
                self.logger.warning("State change callback failed", error=str(e))

    def allow_request(self) -> bool:
        """
        Check if a request should be allowed.

        Returns True if the circuit is closed or half-open with capacity.
        Returns False if the circuit is open.
        """
        current_state = self.state  # This may trigger state transition

        if current_state == CircuitState.CLOSED:
            return True

        if current_state == CircuitState.HALF_OPEN:
            if self._half_open_calls < self.config.half_open_max_calls:
                self._half_open_calls += 1
                return True
            return False

        # Circuit is OPEN
        self._stats.rejected_calls += 1
        return False

    def record_success(self) -> None:
        """Record a successful call."""
        self._stats.total_calls += 1
        self._stats.successful_calls += 1
        self._stats.last_success_time = datetime.utcnow()
        self._stats.consecutive_successes += 1
        self._stats.consecutive_failures = 0

        if self._state == CircuitState.HALF_OPEN:
            if self._stats.consecutive_successes >= self.config.success_threshold:
                self._transition_to(CircuitState.CLOSED)

    def record_failure(self) -> None:
        """Record a failed call."""
        self._stats.total_calls += 1
        self._stats.failed_calls += 1
        self._stats.last_failure_time = datetime.utcnow()
        self._stats.consecutive_failures += 1
        self._stats.consecutive_successes = 0

        if self._state == CircuitState.CLOSED:
            if self._stats.consecutive_failures >= self.config.failure_threshold:
                self._transition_to(CircuitState.OPEN)
        elif self._state == CircuitState.HALF_OPEN:
            # Any failure in half-open state reopens the circuit
            self._transition_to(CircuitState.OPEN)

    def reset(self) -> None:
        """Manually reset the circuit breaker to closed state."""
        self._transition_to(CircuitState.CLOSED)
        self._stats = CircuitStats()
        self._half_open_calls = 0
        self._opened_at = None
        self.logger.info("Circuit breaker manually reset")

    def protect(self, func: Callable[..., T]) -> Callable[..., T]:
        """
        Decorator to protect a function with this circuit breaker.

        Usage:
            @circuit_breaker.protect
            async def call_external_service():
                ...
        """

        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            if not self.allow_request():
                raise CircuitOpenError(f"Circuit breaker '{self.name}' is open")

            try:
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                self.record_success()
                return result
            except Exception as e:
                self.record_failure()
                raise

        return wrapper

    def get_status(self) -> Dict[str, Any]:
        """Get detailed status of the circuit breaker."""
        return {
            "name": self.name,
            "state": self.state.value,
            "stats": {
                "total_calls": self._stats.total_calls,
                "successful_calls": self._stats.successful_calls,
                "failed_calls": self._stats.failed_calls,
                "rejected_calls": self._stats.rejected_calls,
                "consecutive_failures": self._stats.consecutive_failures,
                "consecutive_successes": self._stats.consecutive_successes,
                "state_changes": self._stats.state_changes,
            },
            "config": {
                "failure_threshold": self.config.failure_threshold,
                "success_threshold": self.config.success_threshold,
                "recovery_timeout_seconds": self.config.recovery_timeout.total_seconds(),
                "half_open_max_calls": self.config.half_open_max_calls,
            },
            "opened_at": self._opened_at.isoformat() if self._opened_at else None,
            "last_failure": (
                self._stats.last_failure_time.isoformat()
                if self._stats.last_failure_time
                else None
            ),
            "last_success": (
                self._stats.last_success_time.isoformat()
                if self._stats.last_success_time
                else None
            ),
        }


class CircuitOpenError(Exception):
    """Raised when a call is rejected because the circuit is open."""

    pass


class CircuitBreakerRegistry:
    """
    Registry for managing multiple circuit breakers.

    Provides centralized access and monitoring of all circuit breakers.
    """

    def __init__(self):
        self._breakers: Dict[str, CircuitBreaker] = {}
        self.logger = logger.bind(component="CircuitBreakerRegistry")

    def get_or_create(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 3,
        recovery_timeout: timedelta = timedelta(seconds=60),
    ) -> CircuitBreaker:
        """Get existing circuit breaker or create new one."""
        if name not in self._breakers:
            self._breakers[name] = CircuitBreaker(
                name=name,
                failure_threshold=failure_threshold,
                success_threshold=success_threshold,
                recovery_timeout=recovery_timeout,
                on_state_change=self._on_state_change,
            )
            self.logger.info(f"Created circuit breaker: {name}")
        return self._breakers[name]

    def get(self, name: str) -> Optional[CircuitBreaker]:
        """Get a circuit breaker by name."""
        return self._breakers.get(name)

    def _on_state_change(
        self, name: str, old_state: CircuitState, new_state: CircuitState
    ) -> None:
        """Handle state change events from circuit breakers."""
        self.logger.info(
            "Circuit breaker state change",
            breaker=name,
            from_state=old_state.value,
            to_state=new_state.value,
        )

    def get_all_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all circuit breakers."""
        return {name: breaker.get_status() for name, breaker in self._breakers.items()}

    def get_open_circuits(self) -> List[str]:
        """Get names of all open circuit breakers."""
        return [
            name
            for name, breaker in self._breakers.items()
            if breaker.state == CircuitState.OPEN
        ]

    def reset_all(self) -> None:
        """Reset all circuit breakers."""
        for breaker in self._breakers.values():
            breaker.reset()
        self.logger.info("All circuit breakers reset")


# Global registry instance
_registry: Optional[CircuitBreakerRegistry] = None


def get_circuit_breaker_registry() -> CircuitBreakerRegistry:
    """Get the global circuit breaker registry."""
    global _registry
    if _registry is None:
        _registry = CircuitBreakerRegistry()
    return _registry


def circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: timedelta = timedelta(seconds=60),
) -> Callable:
    """
    Decorator factory for protecting functions with a circuit breaker.

    Usage:
        @circuit_breaker("my-service", failure_threshold=3)
        async def call_service():
            ...
    """
    registry = get_circuit_breaker_registry()
    cb = registry.get_or_create(
        name=name,
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout,
    )
    return cb.protect
