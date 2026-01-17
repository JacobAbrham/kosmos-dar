"""
KOSMOS V2.0 Middleware

Enhanced with security hardening:
- Rate limiting
- Security headers
- Input validation
- CORS protection
"""

import time
import re
from typing import Callable, Optional
from uuid import uuid4

import structlog
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from core.metrics import (
    api_requests_total,
    api_request_duration_seconds,
)

logger = structlog.get_logger()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


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


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware for Prometheus metrics collection."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable
    ) -> Response:
        start_time = time.perf_counter()

        # Extract endpoint path (remove query params)
        path = request.url.path
        method = request.method

        # Skip metrics endpoint itself
        if path == "/metrics":
            return await call_next(request)

        try:
            response = await call_next(request)
            status_code = response.status_code
            status_class = f"{status_code // 100}xx"

            # Record metrics
            latency_seconds = time.perf_counter() - start_time
            api_requests_total.labels(
                method=method,
                endpoint=path,
                status_code=status_code
            ).inc()
            api_request_duration_seconds.labels(
                method=method,
                endpoint=path
            ).observe(latency_seconds)

            return response

        except Exception as e:
            status_code = 500
            latency_seconds = time.perf_counter() - start_time

            # Record metrics for error
            api_requests_total.labels(
                method=method,
                endpoint=path,
                status_code=status_code
            ).inc()
            api_request_duration_seconds.labels(
                method=method,
                endpoint=path
            ).observe(latency_seconds)

            raise


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


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable
    ) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response


class InputValidationMiddleware(BaseHTTPMiddleware):
    """Middleware for input validation and sanitization."""

    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)",
        r"(--|#|/\*|\*/)",
        r"(\bOR\b.*=.*)",
        r"(\bAND\b.*=.*)",
    ]
    
    # XSS patterns
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe[^>]*>",
    ]

    async def dispatch(
        self,
        request: Request,
        call_next: Callable
    ) -> Response:
        # Check query parameters
        for param, value in request.query_params.items():
            if self._is_malicious(str(value)):
                logger.warning("Malicious input detected", param=param, value=value[:50])
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid input detected"
                )
        
        # Check path parameters
        for param, value in request.path_params.items():
            if self._is_malicious(str(value)):
                logger.warning("Malicious input detected", param=param, value=value[:50])
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid input detected"
                )
        
        return await call_next(request)
    
    def _is_malicious(self, value: str) -> bool:
        """Check if input contains malicious patterns."""
        value_lower = value.lower()
        
        # Check SQL injection patterns
        for pattern in self.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                return True
        
        # Check XSS patterns
        for pattern in self.XSS_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                return True
        
        return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting per user/IP."""

    def __init__(self, app, default_limit: str = "100/minute"):
        super().__init__(app)
        self.default_limit = default_limit
        self.cache = None
    
    async def dispatch(
        self,
        request: Request,
        call_next: Callable
    ) -> Response:
        # Skip rate limiting for health checks and other critical endpoints
        if request.url.path in ["/health", "/healthz", "/ready", "/metrics", "/"]:
            return await call_next(request)
        
        # Get client identifier
        client_id = get_remote_address(request)
        
        # Get user ID if authenticated
        if hasattr(request.state, "user") and request.state.user:
            client_id = request.state.user.get("user_id", client_id)
        
        # Check rate limit (skip if cache not available)
        cache = await self._get_cache()
        if cache is None:
            # Cache not available, skip rate limiting but log warning
            logger.debug("Rate limiting skipped - cache not available", path=request.url.path)
            return await call_next(request)
        
        rate_key = f"rate_limit:{request.url.path}:{client_id}"
        
        try:
            # Simple rate limiting: 100 requests per minute
            current = await cache.incr(rate_key)
            if current == 1:
                await cache.expire(rate_key, 60)
            
            if current > 100:
                logger.warning("Rate limit exceeded", client_id=client_id, path=request.url.path)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Please try again later.",
                    headers={"Retry-After": "60"}
                )
            
            response = await call_next(request)
            
            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = "100"
            response.headers["X-RateLimit-Remaining"] = str(max(0, 100 - current))
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)
            
            return response
        except Exception as e:
            # If rate limiting fails, log and continue without rate limiting
            logger.warning("Rate limiting error, continuing without rate limiting", error=str(e))
            return await call_next(request)
    
    async def _get_cache(self):
        """Lazy load cache."""
        if self.cache is None:
            from core.cache import get_cache
            self.cache = get_cache()
        return self.cache


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
