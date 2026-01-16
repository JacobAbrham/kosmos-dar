"""
ARQ Worker Configuration for KOSMOS V2.0
"""

from functools import lru_cache
from typing import Optional

from arq import create_pool
from arq.connections import RedisSettings
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from redis.asyncio import Redis


class WorkerSettings(BaseSettings):
    """ARQ worker settings."""

    model_config = SettingsConfigDict(
        env_prefix="KOSMOS_WORKER_",
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # Redis/Dragonfly connection
    redis_url: str = Field(
        default="redis://localhost:6379/1",  # Use DB 1 for jobs
        validation_alias=AliasChoices("KOSMOS_REDIS_URL", "REDIS_URL"),
    )

    # Worker settings
    max_jobs: int = 10  # Max concurrent jobs
    job_timeout: int = 300  # 5 minutes default timeout
    keep_result: int = 3600  # Keep results for 1 hour
    max_tries: int = 3  # Max retry attempts

    # Queue settings
    queue_name: str = "kosmos_jobs"
    default_queue: str = "default"
    priority_queue: str = "priority"
    scheduled_queue: str = "scheduled"

    # Cron settings
    cron_enabled: bool = True
    cron_timezone: str = "UTC"


@lru_cache()
def get_worker_settings() -> WorkerSettings:
    """Get cached worker settings."""
    return WorkerSettings()


def get_redis_settings() -> RedisSettings:
    """Get Redis settings for ARQ."""
    from urllib.parse import urlparse
    
    worker_settings = get_worker_settings()
    redis_url = worker_settings.redis_url
    
    # Parse Redis URL
    parsed = urlparse(redis_url)
    
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379
    password = parsed.password
    # Extract database number from path (e.g., /1)
    db = 1
    if parsed.path:
        try:
            db = int(parsed.path.lstrip("/"))
        except ValueError:
            db = 1

    return RedisSettings(
        host=host,
        port=port,
        password=password,
        database=db,
    )


async def get_redis_pool() -> Redis:
    """Get Redis connection pool for ARQ."""
    redis_settings = get_redis_settings()
    return await create_pool(redis_settings)
