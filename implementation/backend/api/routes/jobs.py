"""
Job Queue API Endpoints for KOSMOS V2.0
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import structlog
from api.v1 import APIRouter
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.auth import get_current_user
from core.database import get_db
from workers.queue import get_job_queue

logger = structlog.get_logger()

router = APIRouter(prefix="/jobs", tags=["jobs"])


# ============================================================================
# Request/Response Models
# ============================================================================


class EnqueueAgentWorkflowRequest(BaseModel):
    """Request to enqueue an agent workflow."""

    agent_id: str = Field(..., description="Agent identifier")
    task: str = Field(..., description="Task description")
    context: Optional[Dict[str, Any]] = Field(None, description="Optional context")
    priority: str = Field("default", description="Job priority (default, priority)")
    delay_seconds: Optional[int] = Field(None, description="Delay in seconds before execution")


class EnqueueWorkflowStepRequest(BaseModel):
    """Request to enqueue a workflow step."""

    workflow_id: str = Field(..., description="Workflow identifier")
    step_id: str = Field(..., description="Step identifier")
    execution_id: str = Field(..., description="Execution identifier")
    delay_seconds: Optional[int] = Field(None, description="Delay in seconds")


class EnqueueNotificationRequest(BaseModel):
    """Request to enqueue a notification."""

    user_id: str = Field(..., description="User identifier")
    notification_type: str = Field(..., description="Notification type")
    title: str = Field(..., description="Notification title")
    message: str = Field(..., description="Notification message")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional metadata")
    delay_seconds: Optional[int] = Field(None, description="Delay in seconds")


class JobResponse(BaseModel):
    """Job response model."""

    job_id: str
    status: str
    created_at: Optional[datetime] = None
    result: Optional[Any] = None
    error: Optional[str] = None


class JobListResponse(BaseModel):
    """Job list response."""

    jobs: List[JobResponse]
    total: int


# ============================================================================
# Job Management Endpoints
# ============================================================================


@router.post("/agent-workflow", response_model=JobResponse)
async def enqueue_agent_workflow(
    request: EnqueueAgentWorkflowRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> JobResponse:
    """
    Enqueue an agent workflow job.

    Requires authentication.
    """
    try:
        job_queue = await get_job_queue()

        delay = (
            timedelta(seconds=request.delay_seconds)
            if request.delay_seconds
            else None
        )

        job = await job_queue.enqueue_agent_workflow(
            agent_id=request.agent_id,
            task=request.task,
            context=request.context,
            tenant_id=current_user.get("tenant_id"),
            user_id=current_user.get("user_id"),
            priority=request.priority,
            delay=delay,
        )

        return JobResponse(
            job_id=job.job_id,
            status="queued",
            created_at=datetime.utcnow(),
        )

    except Exception as e:
        logger.error("Failed to enqueue agent workflow", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflow-step", response_model=JobResponse)
async def enqueue_workflow_step(
    request: EnqueueWorkflowStepRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> JobResponse:
    """
    Enqueue a workflow step job.

    Requires authentication.
    """
    try:
        job_queue = await get_job_queue()

        delay = (
            timedelta(seconds=request.delay_seconds)
            if request.delay_seconds
            else None
        )

        job = await job_queue.enqueue_workflow_step(
            workflow_id=request.workflow_id,
            step_id=request.step_id,
            execution_id=request.execution_id,
            tenant_id=current_user.get("tenant_id"),
            delay=delay,
        )

        return JobResponse(
            job_id=job.job_id,
            status="queued",
            created_at=datetime.utcnow(),
        )

    except Exception as e:
        logger.error("Failed to enqueue workflow step", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/notification", response_model=JobResponse)
async def enqueue_notification(
    request: EnqueueNotificationRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> JobResponse:
    """
    Enqueue a notification job.

    Requires authentication.
    """
    try:
        job_queue = await get_job_queue()

        delay = (
            timedelta(seconds=request.delay_seconds)
            if request.delay_seconds
            else None
        )

        job = await job_queue.enqueue_notification(
            user_id=request.user_id,
            notification_type=request.notification_type,
            title=request.title,
            message=request.message,
            tenant_id=current_user.get("tenant_id"),
            metadata=request.metadata,
            delay=delay,
        )

        return JobResponse(
            job_id=job.job_id,
            status="queued",
            created_at=datetime.utcnow(),
        )

    except Exception as e:
        logger.error("Failed to enqueue notification", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Job Status Endpoints
# ============================================================================


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
) -> JobResponse:
    """
    Get job status and result.

    Requires authentication.
    """
    try:
        job_queue = await get_job_queue()
        job = await job_queue.get_job(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        status = await job.status()
        result = None
        error = None

        if status == "complete":
            try:
                result = await job.result()
            except Exception as e:
                error = str(e)
        elif status == "failed":
            try:
                error_info = await job.result()
                error = str(error_info) if error_info else "Job failed"
            except Exception:
                error = "Job failed"

        return JobResponse(
            job_id=job.job_id,
            status=status,
            result=result,
            error=error,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get job", job_id=job_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{job_id}")
async def cancel_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Cancel a job.

    Requires authentication.
    """
    try:
        job_queue = await get_job_queue()
        cancelled = await job_queue.cancel_job(job_id)

        if not cancelled:
            raise HTTPException(status_code=404, detail="Job not found")

        return {"success": True, "job_id": job_id, "status": "cancelled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to cancel job", job_id=job_id, error=str(e), exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=JobListResponse)
async def list_jobs(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    current_user: dict = Depends(get_current_user),
) -> JobListResponse:
    """
    List jobs (limited implementation - ARQ doesn't have built-in listing).

    Requires authentication.
    """
    # ARQ doesn't have a built-in way to list all jobs
    # This is a placeholder that could be enhanced with Redis queries
    return JobListResponse(jobs=[], total=0)
