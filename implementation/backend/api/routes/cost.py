"""
KOSMOS DAR Cost Tracking API

Dashboard endpoints for cost monitoring, budget status, and alerts.
"""

from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.cost_tracking import (
    get_cost_tracker,
    CostCategory,
    BudgetPeriod,
    BudgetStatus,
    CostRecord,
)
from core.auth import get_current_user


router = APIRouter(prefix="/api/v1/cost", tags=["cost"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CostSummaryResponse(BaseModel):
    """Cost summary response."""
    period_days: int
    total_cost: float
    total_operations: int
    by_category: list[Dict[str, Any]]
    by_agent: list[Dict[str, Any]]
    daily_totals: list[Dict[str, Any]]
    budget_status: Dict[str, Any]


class BudgetStatusResponse(BaseModel):
    """Budget status response."""
    daily: BudgetStatus
    monthly: BudgetStatus


class RecordCostRequest(BaseModel):
    """Record cost request."""
    category: CostCategory
    cost_usd: float = Field(..., gt=0)
    agent_id: Optional[str] = None
    tokens_input: int = 0
    tokens_output: int = 0
    model: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/summary", response_model=CostSummaryResponse)
async def get_cost_summary(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to summarize"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> CostSummaryResponse:
    """
    Get cost summary for dashboard.
    
    Returns aggregated cost data by category, agent, and daily totals.
    """
    tenant_id = current_user.get("tenant_id", "default")
    tracker = await get_cost_tracker()
    
    summary = await tracker.get_cost_summary(tenant_id, days=days)
    
    return CostSummaryResponse(**summary)


@router.get("/budget", response_model=BudgetStatusResponse)
async def get_budget_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> BudgetStatusResponse:
    """
    Get current budget status for daily and monthly periods.
    """
    tenant_id = current_user.get("tenant_id", "default")
    tracker = await get_cost_tracker()
    
    daily_status = await tracker.get_budget_status(tenant_id, BudgetPeriod.DAILY)
    monthly_status = await tracker.get_budget_status(tenant_id, BudgetPeriod.MONTHLY)
    
    return BudgetStatusResponse(
        daily=daily_status,
        monthly=monthly_status
    )


@router.post("/record", response_model=CostRecord)
async def record_cost(
    request: RecordCostRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> CostRecord:
    """
    Record a cost event.
    
    Typically called automatically by agents, but can be called manually for testing.
    """
    tenant_id = current_user.get("tenant_id", "default")
    tracker = await get_cost_tracker()
    
    record = await tracker.record_cost(
        tenant_id=tenant_id,
        category=request.category,
        cost_usd=request.cost_usd,
        agent_id=request.agent_id,
        tokens_input=request.tokens_input,
        tokens_output=request.tokens_output,
        model=request.model,
        metadata=request.metadata
    )
    
    return record


@router.get("/check-budget")
async def check_budget(
    estimated_cost: float = Query(..., gt=0, description="Estimated cost to check"),
    period: BudgetPeriod = Query(default=BudgetPeriod.DAILY, description="Budget period"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Check if operation is allowed within budget.
    
    Returns whether the operation is allowed and current budget status.
    """
    tenant_id = current_user.get("tenant_id", "default")
    tracker = await get_cost_tracker()
    
    allowed, reason = await tracker.check_budget_allowed(
        tenant_id=tenant_id,
        estimated_cost=estimated_cost,
        period=period
    )
    
    status = await tracker.get_budget_status(tenant_id, period)
    
    return {
        "allowed": allowed,
        "reason": reason,
        "budget_status": status.model_dump(),
        "estimated_cost": estimated_cost,
    }
