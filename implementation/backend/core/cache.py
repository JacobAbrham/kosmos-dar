"""
KOSMOS V2.0 Cache Configuration (Dragonfly/Redis)
"""

from typing import Any, Optional

import orjson
import structlog
from redis.asyncio import Redis, ConnectionPool

from .config import settings

logger = structlog.get_logger()

# Connection pool
_pool: Optional[ConnectionPool] = None
_client: Optional[Redis] = None


async def init_cache() -> None:
    """Initialize cache connection."""
    global _pool, _client
    logger.info("Initializing cache connection...")

    _pool = ConnectionPool.from_url(
        settings.redis_url,
        max_connections=50,
        decode_responses=True,
    )
    _client = Redis(connection_pool=_pool)

    # Test connection
    await _client.ping()
    logger.info("Cache connection established")


async def close_cache() -> None:
    """Close cache connection."""
    global _pool, _client
    logger.info("Closing cache connection...")

    if _client:
        await _client.close()
    if _pool:
        await _pool.disconnect()

    logger.info("Cache connection closed")


async def check_cache_connection() -> bool:
    """Check if cache is reachable."""
    try:
        if _client:
            await _client.ping()
            return True
        return False
    except Exception as e:
        logger.error("Cache connection check failed", error=str(e))
        return False


def get_cache() -> Redis:
    """Get cache client."""
    if _client is None:
        raise RuntimeError("Cache not initialized")
    return _client


class KosmosCache:
    """High-level cache operations for KOSMOS."""

    def __init__(self, client: Redis):
        self.client = client

    # ==========================================================================
    # Basic Operations
    # ==========================================================================

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        value = await self.client.get(key)
        if value:
            return orjson.loads(value)
        return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 3600
    ) -> None:
        """Set value in cache with TTL."""
        await self.client.setex(
            key,
            ttl,
            orjson.dumps(value).decode()
        )

    async def delete(self, key: str) -> None:
        """Delete key from cache."""
        await self.client.delete(key)

    # ==========================================================================
    # Tenant-Scoped Operations
    # ==========================================================================

    def _tenant_key(self, tenant_id: str, resource: str, id: str) -> str:
        """Generate tenant-scoped cache key."""
        return f"tenant:{tenant_id}:{resource}:{id}"

    async def get_tenant(
        self,
        tenant_id: str,
        resource: str,
        id: str
    ) -> Optional[Any]:
        """Get tenant-scoped value."""
        key = self._tenant_key(tenant_id, resource, id)
        return await self.get(key)

    async def set_tenant(
        self,
        tenant_id: str,
        resource: str,
        id: str,
        value: Any,
        ttl: int = 3600
    ) -> None:
        """Set tenant-scoped value."""
        key = self._tenant_key(tenant_id, resource, id)
        await self.set(key, value, ttl)

    # ==========================================================================
    # Session Management
    # ==========================================================================

    async def cache_session(
        self,
        session_id: str,
        data: dict,
        ttl: int = 3600
    ) -> None:
        """Cache user session data."""
        key = f"session:{session_id}"
        await self.set(key, data, ttl)

    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get user session data."""
        key = f"session:{session_id}"
        return await self.get(key)

    # ==========================================================================
    # Rate Limiting
    # ==========================================================================

    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        window: int
    ) -> tuple[bool, int]:
        """Token bucket rate limiting."""
        rate_key = f"rate:{key}"
        current = await self.client.incr(rate_key)

        if current == 1:
            await self.client.expire(rate_key, window)

        remaining = max(0, limit - current)
        return current <= limit, remaining

    # ==========================================================================
    # Agent State
    # ==========================================================================

    async def cache_agent_state(
        self,
        agent_id: str,
        conversation_id: str,
        state: dict
    ) -> None:
        """Cache agent state for fast access."""
        key = f"agent:{agent_id}:conversation:{conversation_id}"
        await self.set(key, state, ttl=1800)  # 30 minutes

    async def get_agent_state(
        self,
        agent_id: str,
        conversation_id: str
    ) -> Optional[dict]:
        """Get cached agent state."""
        key = f"agent:{agent_id}:conversation:{conversation_id}"
        return await self.get(key)

    # ==========================================================================
    # Cost Registry
    # ==========================================================================

    async def get_tool_cost(self, tool_name: str) -> Optional[float]:
        """Get estimated cost for a tool."""
        key = f"cost:tool:{tool_name}"
        value = await self.client.get(key)
        return float(value) if value else None

    async def set_tool_cost(self, tool_name: str, cost: float) -> None:
        """Set estimated cost for a tool."""
        key = f"cost:tool:{tool_name}"
        await self.client.set(key, str(cost))

    async def get_model_cost(self, model_name: str) -> Optional[dict]:
        """Get cost per 1K tokens for a model."""
        key = f"cost:model:{model_name}"
        return await self.get(key)

    async def set_model_cost(
        self,
        model_name: str,
        input_cost: float,
        output_cost: float
    ) -> None:
        """Set cost per 1K tokens for a model."""
        key = f"cost:model:{model_name}"
        await self.set(key, {
            "input": input_cost,
            "output": output_cost
        })
