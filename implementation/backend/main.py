"""
KOSMOS V2.0 Backend - Main Application Entry Point
"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from api.v1 import router as api_v1_router
from core.cache import close_cache, init_cache
from core.config import settings
from core.database import close_db, init_db
from core.logging import setup_logging
from core.messaging import close_nats, init_nats
from core.middleware import (
    TenantMiddleware,
    TracingMiddleware,
    MetricsMiddleware,
    SecurityHeadersMiddleware,
    InputValidationMiddleware,
    RateLimitMiddleware,
)
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from prometheus_client import make_asgi_app
from sdui.websocket import create_sdui_websocket_router

# Setup structured logging
setup_logging()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan manager."""
    logger.info("Starting KOSMOS V2.0 backend...")

    # Initialize connections
    await init_db()
    await init_cache()
    await init_nats()

    # Initialize agents
    from agents.registry import get_registry

    await get_registry()

    logger.info("KOSMOS V2.0 backend started successfully")

    yield

    # Cleanup
    logger.info("Shutting down KOSMOS V2.0 backend...")
    await close_nats()
    await close_cache()
    await close_db()
    logger.info("KOSMOS V2.0 backend shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="KOSMOS V2.0 API",
    description="AI-Native Enterprise Operating System",
    version="2.0.0-alpha",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware (order matters - first added is outermost)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(InputValidationMiddleware)
app.add_middleware(RateLimitMiddleware, default_limit="100/minute")
app.add_middleware(MetricsMiddleware)  # Metrics collection
app.add_middleware(TenantMiddleware)
app.add_middleware(TracingMiddleware)

# Mount Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Initialize custom metrics
from core.metrics import system_info  # noqa: E402, F401

# Include API routers (prefix already in each router)
app.include_router(api_v1_router)

# Include WebSocket router for SDUI
app.include_router(create_sdui_websocket_router())


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "2.0.0-alpha", "service": "kosmos-backend"}


@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint."""
    from core.cache import check_cache_connection
    from core.database import check_db_connection
    from core.messaging import check_nats_connection

    db_ok = await check_db_connection()
    cache_ok = await check_cache_connection()
    nats_ok = await check_nats_connection()

    all_ok = db_ok and cache_ok and nats_ok

    return {
        "ready": all_ok,
        "checks": {"database": db_ok, "cache": cache_ok, "messaging": nats_ok},
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "KOSMOS V2.0",
        "description": "AI-Native Enterprise Operating System",
        "version": "2.0.0-alpha",
        "docs": "/docs" if settings.debug else None,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.debug)
