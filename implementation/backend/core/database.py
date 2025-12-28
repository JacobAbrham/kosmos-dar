"""
KOSMOS V2.0 Database Configuration
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import structlog
from fastapi import Request
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy import text

from .config import settings

logger = structlog.get_logger()

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


async def init_db() -> None:
    """Initialize database connection."""
    logger.info("Initializing database connection...")
    async with engine.begin() as conn:
        # Test connection
        await conn.execute(text("SELECT 1"))
    logger.info("Database connection established")


async def close_db() -> None:
    """Close database connection."""
    logger.info("Closing database connection...")
    await engine.dispose()
    logger.info("Database connection closed")


async def check_db_connection() -> bool:
    """Check if database is reachable."""
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("Database connection check failed", error=str(e))
        return False


@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session with automatic cleanup."""
    session = async_session_maker()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def set_tenant_context(session: AsyncSession, tenant_id: str) -> None:
    """Set tenant context for Row-Level Security."""
    await session.execute(
        text("SET app.current_tenant = :tenant_id"),
        {"tenant_id": tenant_id}
    )


class TenantScopedSession:
    """Session wrapper with automatic tenant context."""

    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id

    async def __aenter__(self) -> AsyncSession:
        await set_tenant_context(self.session, self.tenant_id)
        return self.session

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            await self.session.rollback()
        else:
            await self.session.commit()
        await self.session.close()


def get_tenant_session(tenant_id: str) -> TenantScopedSession:
    """Get tenant-scoped database session."""
    session = async_session_maker()
    return TenantScopedSession(session, tenant_id)


async def get_db_with_tenant(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency to get database session with tenant context.

    Automatically sets the PostgreSQL session variable for RLS based on
    the tenant_id extracted by TenantMiddleware.

    Usage:
        @router.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db_with_tenant)):
            # RLS is automatically enforced for the current tenant
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    session = async_session_maker()
    try:
        # Get tenant_id from request state (set by TenantMiddleware)
        tenant_id = getattr(request.state, "tenant_id", "default")

        # Set PostgreSQL session variable for RLS
        await set_tenant_context(session, tenant_id)

        logger.debug("Database session created with tenant context", tenant_id=tenant_id)

        yield session
        await session.commit()
    except Exception as e:
        logger.error("Database session error", error=str(e))
        await session.rollback()
        raise
    finally:
        await session.close()
