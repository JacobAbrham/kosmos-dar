"""
ARQ Worker Entry Point for KOSMOS V2.0

Run with: arq workers.worker.WorkerConfig
"""

import asyncio
from contextlib import asynccontextmanager

import structlog
from arq import create_pool
from arq.connections import RedisSettings
from arq.worker import Worker

from core.cache import close_cache, init_cache
from core.database import close_db, init_db
from core.logging import setup_logging
from core.messaging import close_nats, init_nats

from .config import get_redis_settings
from .jobs import WorkerConfig as JobsConfig

# Setup logging
setup_logging()
logger = structlog.get_logger()


class WorkerConfig:
    """ARQ worker configuration."""

    redis_settings = get_redis_settings()
    functions = JobsConfig.functions
    cron_jobs = JobsConfig.cron_jobs

    # Worker settings
    max_jobs = 10
    job_timeout = 300  # 5 minutes
    keep_result = 3600  # 1 hour
    max_tries = 3

    # Startup/shutdown hooks
    async def on_startup(ctx):
        """Initialize connections on worker startup."""
        logger.info("Starting ARQ worker...")

        # Initialize database
        await init_db()
        logger.info("Database initialized")

        # Initialize cache
        await init_cache()
        logger.info("Cache initialized")

        # Initialize NATS
        await init_nats()
        logger.info("NATS initialized")

        logger.info("ARQ worker started successfully")

    async def on_shutdown(ctx):
        """Cleanup on worker shutdown."""
        logger.info("Shutting down ARQ worker...")

        # Close connections
        await close_nats()
        await close_cache()
        await close_db()

        logger.info("ARQ worker shut down")


if __name__ == "__main__":
    # Run worker directly
    import sys
    from arq.cli import main

    sys.argv = ["arq", "workers.worker.WorkerConfig"]
    main()
