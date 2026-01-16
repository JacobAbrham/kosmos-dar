"""
Base Service Layer for KOSMOS V2.0

Provides abstract base classes and interfaces for all services.
Enables dependency injection, testing, and consistent patterns.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from datetime import datetime

import structlog

logger = structlog.get_logger()


class BaseService(ABC):
    """
    Abstract base class for all services.

    Provides common functionality:
    - Structured logging
    - Error handling
    - Metrics tracking
    - Tenant/user context
    """

    def __init__(self, name: str):
        self.name = name
        self.logger = logger.bind(service=name)
        self._metrics: Dict[str, Any] = {
            "requests_total": 0,
            "requests_success": 0,
            "requests_failed": 0,
            "total_latency_ms": 0.0,
        }

    def _track_request(self, success: bool, latency_ms: float) -> None:
        """Track request metrics."""
        self._metrics["requests_total"] += 1
        if success:
            self._metrics["requests_success"] += 1
        else:
            self._metrics["requests_failed"] += 1
        self._metrics["total_latency_ms"] += latency_ms

    def get_metrics(self) -> Dict[str, Any]:
        """Get service metrics."""
        total = self._metrics["requests_total"]
        if total > 0:
            success_rate = self._metrics["requests_success"] / total
            avg_latency = self._metrics["total_latency_ms"] / total
        else:
            success_rate = 0.0
            avg_latency = 0.0

        return {
            **self._metrics,
            "success_rate": success_rate,
            "avg_latency_ms": avg_latency,
        }

    async def health_check(self) -> Dict[str, Any]:
        """Health check for the service."""
        return {
            "service": self.name,
            "status": "healthy",
            "metrics": self.get_metrics(),
        }


class ServiceContext:
    """Context for service operations (tenant, user, etc.)."""

    def __init__(
        self,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.session_id = session_id
        self.trace_id = trace_id
        self.created_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary."""
        return {
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "trace_id": self.trace_id,
        }

    @classmethod
    def from_request(cls, request: Any) -> "ServiceContext":
        """Create context from FastAPI request."""
        # Extract from request attributes (set by middleware)
        tenant_id = getattr(request.state, "tenant_id", None)
        user_id = getattr(request.state, "user_id", None)
        session_id = getattr(request.state, "session_id", None)
        trace_id = getattr(request.state, "trace_id", None)

        return cls(
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id,
            trace_id=trace_id,
        )


def get_service_context(
    tenant_id: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> ServiceContext:
    """Helper to create service context."""
    return ServiceContext(
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )
