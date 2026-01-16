"""
Job Queue Integration Helpers for Agent Workflows

Provides utilities to optionally execute agent workflows asynchronously.
"""

from typing import Any, Dict, Optional

import structlog

from workers.queue import get_job_queue

logger = structlog.get_logger()


async def execute_agent_async(
    agent_id: str,
    task: str,
    context: Optional[Dict[str, Any]] = None,
    tenant_id: Optional[str] = None,
    user_id: Optional[str] = None,
    priority: str = "default",
    delay_seconds: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute an agent workflow asynchronously via job queue.

    Args:
        agent_id: Agent identifier
        task: Task description
        context: Optional context
        tenant_id: Tenant ID
        user_id: User ID
        priority: Job priority
        delay_seconds: Optional delay

    Returns:
        Job information dictionary
    """
    try:
        job_queue = await get_job_queue()

        from datetime import timedelta

        delay = timedelta(seconds=delay_seconds) if delay_seconds else None

        job = await job_queue.enqueue_agent_workflow(
            agent_id=agent_id,
            task=task,
            context=context,
            tenant_id=tenant_id,
            user_id=user_id,
            priority=priority,
            delay=delay,
        )

        logger.info(
            "Agent workflow enqueued",
            job_id=job.job_id,
            agent_id=agent_id,
            priority=priority,
        )

        return {
            "success": True,
            "job_id": job.job_id,
            "status": "queued",
            "agent_id": agent_id,
        }

    except Exception as e:
        logger.error(
            "Failed to enqueue agent workflow",
            agent_id=agent_id,
            error=str(e),
            exc_info=True,
        )
        raise


async def should_use_async(
    task: str,
    estimated_duration_seconds: Optional[float] = None,
    force_async: bool = False,
) -> bool:
    """
    Determine if a task should be executed asynchronously.

    Args:
        task: Task description
        estimated_duration_seconds: Estimated duration
        force_async: Force async execution

    Returns:
        True if should use async, False otherwise
    """
    if force_async:
        return True

    # Use async for long-running tasks (> 30 seconds estimated)
    if estimated_duration_seconds and estimated_duration_seconds > 30:
        return True

    # Use async for tasks with specific keywords
    async_keywords = [
        "generate report",
        "analyze large",
        "process batch",
        "export data",
        "import data",
        "bulk operation",
    ]
    task_lower = task.lower()
    if any(kw in task_lower for kw in async_keywords):
        return True

    return False
