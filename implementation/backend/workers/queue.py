"""
Job Queue Service for KOSMOS V2.0

High-level interface for enqueueing and managing background jobs.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import structlog
from arq import ArqRedis, create_pool
from arq.jobs import Job, JobStatus

from .config import get_redis_settings, get_worker_settings

logger = structlog.get_logger()

# Global ARQ Redis pool
_arq_pool: Optional[ArqRedis] = None


async def init_queue() -> None:
    """Initialize ARQ Redis pool."""
    global _arq_pool
    if _arq_pool is None:
        redis_settings = get_redis_settings()
        _arq_pool = await create_pool(redis_settings)
        logger.info("ARQ job queue initialized")


async def close_queue() -> None:
    """Close ARQ Redis pool."""
    global _arq_pool
    if _arq_pool:
        await _arq_pool.close()
        _arq_pool = None
        logger.info("ARQ job queue closed")


async def get_queue() -> ArqRedis:
    """Get ARQ Redis pool."""
    global _arq_pool
    if _arq_pool is None:
        await init_queue()
    return _arq_pool


class JobQueue:
    """High-level job queue interface."""

    def __init__(self, pool: Optional[ArqRedis] = None):
        self.pool = pool

    async def enqueue_agent_workflow(
        self,
        agent_id: str,
        task: str,
        context: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        priority: str = "default",
        delay: Optional[timedelta] = None,
    ) -> Job:
        """
        Enqueue an agent workflow job.

        Args:
            agent_id: Agent identifier
            task: Task description
            context: Optional context
            tenant_id: Tenant ID
            user_id: User ID
            priority: Job priority (default, priority)
            delay: Optional delay before execution

        Returns:
            ARQ Job instance
        """
        pool = self.pool or await get_queue()
        worker_settings = get_worker_settings()

        queue_name = (
            worker_settings.priority_queue
            if priority == "priority"
            else worker_settings.default_queue
        )

        job = await pool.enqueue_job(
            "execute_agent_workflow",
            agent_id=agent_id,
            task=task,
            context=context,
            tenant_id=tenant_id,
            user_id=user_id,
            _queue_name=queue_name,
            _defer_by=delay,
        )

        # Update queue size metric
        try:
            queue_len = await pool.zcard(f"arq:queue:{queue_name}")
            job_queue_size.labels(queue=queue_name).set(queue_len)
        except Exception:
            pass  # Ignore metric errors

        logger.info(
            "Agent workflow job enqueued",
            job_id=job.job_id,
            agent_id=agent_id,
            queue=queue_name,
        )

        return job

    async def enqueue_workflow_step(
        self,
        workflow_id: str,
        step_id: str,
        execution_id: str,
        tenant_id: Optional[str] = None,
        delay: Optional[timedelta] = None,
    ) -> Job:
        """
        Enqueue a workflow step job.

        Args:
            workflow_id: Workflow identifier
            step_id: Step identifier
            execution_id: Execution identifier
            tenant_id: Tenant ID
            delay: Optional delay

        Returns:
            ARQ Job instance
        """
        pool = self.pool or await get_queue()

        job = await pool.enqueue_job(
            "process_workflow_step",
            workflow_id=workflow_id,
            step_id=step_id,
            execution_id=execution_id,
            tenant_id=tenant_id,
            _defer_by=delay,
        )

        logger.info(
            "Workflow step job enqueued",
            job_id=job.job_id,
            workflow_id=workflow_id,
            step_id=step_id,
        )

        return job

    async def enqueue_notification(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        message: str,
        tenant_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        delay: Optional[timedelta] = None,
    ) -> Job:
        """
        Enqueue a notification job.

        Args:
            user_id: User identifier
            notification_type: Notification type
            title: Notification title
            message: Notification message
            tenant_id: Tenant ID
            metadata: Optional metadata
            delay: Optional delay

        Returns:
            ARQ Job instance
        """
        pool = self.pool or await get_queue()

        job = await pool.enqueue_job(
            "send_notification",
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            tenant_id=tenant_id,
            metadata=metadata,
            _defer_by=delay,
        )

        logger.info(
            "Notification job enqueued",
            job_id=job.job_id,
            user_id=user_id,
            notification_type=notification_type,
        )

        return job

    async def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID."""
        pool = self.pool or await get_queue()
        return await pool.job(job_id)

    async def get_job_status(self, job_id: str) -> Optional[JobStatus]:
        """Get job status."""
        job = await self.get_job(job_id)
        if job:
            return await job.status()
        return None

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a job."""
        job = await self.get_job(job_id)
        if job:
            await job.abort()
            logger.info("Job cancelled", job_id=job_id)
            return True
        return False

    async def get_job_result(self, job_id: str, timeout: Optional[float] = None) -> Any:
        """Get job result (waiting if necessary)."""
        job = await self.get_job(job_id)
        if job:
            return await job.result(timeout=timeout)
        return None


# Global job queue instance
_job_queue: Optional[JobQueue] = None


async def get_job_queue() -> JobQueue:
    """Get global job queue instance."""
    global _job_queue
    if _job_queue is None:
        pool = await get_queue()
        _job_queue = JobQueue(pool=pool)
    return _job_queue
