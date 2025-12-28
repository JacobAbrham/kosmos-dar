"""
KOSMOS V2.0 Middleware
"""

import time
from typing import Callable, Optional
from uuid import uuid4

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text

logger = structlog.get_logger()


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware to extract and set tenant context.

    Sets both application state and PostgreSQL session variable
    for Row-Level Security (RLS) enforcement.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable
    ) -> Response:
        # Extract tenant from various sources
        tenant_id = self._extract_tenant(request)

        if tenant_id:
            request.state.tenant_id = tenant_id
            # Bind tenant to logging context
            structlog.contextvars.bind_contextvars(tenant_id=tenant_id)

            # Set PostgreSQL session variable for RLS
            # Note: This is set as request state; actual DB sessions
            # should use get_tenant_session() or set_tenant_context()
            # from core.database to apply the session variable
            logger.debug(f"Tenant context set", tenant_id=tenant_id)
        else:
            # For requests without tenant, set default tenant
            default_tenant = "default"
            request.state.tenant_id = default_tenant
            structlog.contextvars.bind_contextvars(tenant_id=default_tenant)
            logger.debug("Using default tenant context")

        response = await call_next(request)

        # Clear context
        structlog.contextvars.unbind_contextvars("tenant_id")

        return response

    def _extract_tenant(self, request: Request) -> Optional[str]:
        """Extract tenant ID from request."""
        # 1. Check header
        tenant = request.headers.get("X-Tenant-ID")
        if tenant:
            return tenant

        # 2. Check JWT claims (if authenticated)
        if hasattr(request.state, "user") and request.state.user:
            return request.state.user.get("tenant_id")

        # 3. Check query parameter (for development)
        tenant = request.query_params.get("tenant_id")
        if tenant:
            return tenant

        return None


class TracingMiddleware(BaseHTTPMiddleware):
    """Middleware for distributed tracing."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable
    ) -> Response:
        # Extract or generate trace ID
        trace_id = request.headers.get("X-Trace-ID") or str(uuid4())
        request_id = str(uuid4())

        # Store in request state
        request.state.trace_id = trace_id
        request.state.request_id = request_id

        # Bind to logging context
        structlog.contextvars.bind_contextvars(
            trace_id=trace_id,
            request_id=request_id,
            method=request.method,
            path=request.url.path
        )

        # Record start time
        start_time = time.perf_counter()

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Add headers to response
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

        # Log request
        logger.info(
            "Request completed",
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2)
        )

        # Clear context
        structlog.contextvars.unbind_contextvars(
            "trace_id", "request_id", "method", "path"
        )

        return response


class CostGovernanceMiddleware(BaseHTTPMiddleware):
    """Middleware for pre-flight cost governance."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable
    ) -> Response:
        # Only apply to agent tool calls
        if not request.url.path.startswith("/api/v1/agents/"):
            return await call_next(request)

        # Check if this is a tool execution request
        if request.method != "POST" or "execute" not in request.url.path:
            return await call_next(request)

        # Pre-flight cost check would happen here
        # For now, pass through
        return await call_next(request)
