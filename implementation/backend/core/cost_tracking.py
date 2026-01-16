"""
KOSMOS DAR Cost Tracking Service

Real-time cost tracking, budget enforcement, and alerting.
Integrates with Langfuse for metrics and provides dashboard endpoints.
"""

import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

import structlog
from pydantic import BaseModel, Field
from sqlalchemy import text

from core.cache import get_cache
from core.config import settings
from core.database import get_db

logger = structlog.get_logger()


# ============================================================================
# TYPES
# ============================================================================

class CostCategory(str, Enum):
    """Cost categories."""
    LLM_INFERENCE = "llm_inference"
    LLM_EMBEDDING = "llm_embedding"
    MCP_TOOL = "mcp_tool"
    STORAGE = "storage"
    API_CALL = "api_call"
    OTHER = "other"


class BudgetPeriod(str, Enum):
    """Budget periods."""
    DAILY = "daily"
    MONTHLY = "monthly"


class AlertLevel(str, Enum):
    """Alert levels."""
    INFO = "info"          # 50% utilization
    WARNING = "warning"    # 75% utilization
    CRITICAL = "critical"  # 90% utilization
    EXCEEDED = "exceeded"  # 100%+ utilization


class CostRecord(BaseModel):
    """Cost record model."""
    id: str
    tenant_id: str
    agent_id: Optional[str] = None
    category: CostCategory
    cost_usd: float
    tokens_input: int = 0
    tokens_output: int = 0
    model: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class BudgetStatus(BaseModel):
    """Budget status model."""
    period: BudgetPeriod
    limit: float
    used: float
    remaining: float
    utilization: float  # 0.0 to 1.0+
    alert_level: AlertLevel
    forecast_exceeded: bool = False


class CostAlert(BaseModel):
    """Cost alert model."""
    id: str
    tenant_id: str
    period: BudgetPeriod
    alert_level: AlertLevel
    utilization: float
    limit: float
    used: float
    message: str
    created_at: datetime
    acknowledged: bool = False


# ============================================================================
# COST TRACKER
# ============================================================================

class CostTracker:
    """
    Centralized cost tracking service.
    
    Features:
    - Real-time cost tracking per request
    - Daily/monthly budget enforcement
    - Alert generation at thresholds
    - Integration with Langfuse metrics
    - Dashboard data aggregation
    """
    
    # Alert thresholds
    ALERT_THRESHOLDS = {
        AlertLevel.INFO: 0.5,      # 50% utilization
        AlertLevel.WARNING: 0.75,  # 75% utilization
        AlertLevel.CRITICAL: 0.9,  # 90% utilization
        AlertLevel.EXCEEDED: 1.0,  # 100%+ utilization
    }
    
    def __init__(self):
        self.cache = None
        self._alert_cache: Dict[str, datetime] = {}  # Track last alert per tenant/period
        self._lock = asyncio.Lock()
    
    async def _get_cache(self):
        """Lazy load cache."""
        if self.cache is None:
            self.cache = get_cache()
        return self.cache
    
    async def record_cost(
        self,
        tenant_id: str,
        category: CostCategory,
        cost_usd: float,
        agent_id: Optional[str] = None,
        tokens_input: int = 0,
        tokens_output: int = 0,
        model: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> CostRecord:
        """
        Record a cost event.
        
        Args:
            tenant_id: Tenant ID
            category: Cost category
            cost_usd: Cost in USD
            agent_id: Optional agent ID
            tokens_input: Input tokens
            tokens_output: Output tokens
            model: Model name
            metadata: Optional metadata
        
        Returns:
            Cost record
        """
        record_id = str(uuid4())
        now = datetime.utcnow()
        
        record = CostRecord(
            id=record_id,
            tenant_id=tenant_id,
            agent_id=agent_id,
            category=category,
            cost_usd=cost_usd,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            model=model,
            metadata=metadata or {},
            created_at=now
        )
        
        # Store in database
        try:
            async for db in get_db():
                await db.execute(
                    text("""
                        INSERT INTO cost_tracking (
                            id, tenant_id, agent_id, category,
                            cost_usd, tokens_input, tokens_output,
                            model, metadata, created_at
                        ) VALUES (
                            :id, :tenant_id, :agent_id, :category,
                            :cost_usd, :tokens_input, :tokens_output,
                            :model, :metadata, :created_at
                        )
                    """),
                    {
                        "id": record_id,
                        "tenant_id": tenant_id,
                        "agent_id": agent_id,
                        "category": category.value,
                        "cost_usd": cost_usd,
                        "tokens_input": tokens_input,
                        "tokens_output": tokens_output,
                        "model": model,
                        "metadata": str(metadata or {}),
                        "created_at": now,
                    }
                )
                await db.commit()
                break
        except Exception as e:
            logger.error("Failed to record cost in database", error=str(e), tenant_id=tenant_id)
            # Continue anyway - cost is still tracked in cache
        
        # Update cache for fast lookups
        cache = await self._get_cache()
        daily_key = f"cost:daily:{tenant_id}:{now.strftime('%Y-%m-%d')}"
        monthly_key = f"cost:monthly:{tenant_id}:{now.strftime('%Y-%m')}"
        
        await cache.incrbyfloat(daily_key, cost_usd)
        await cache.expire(daily_key, 86400 * 2)  # 2 days
        
        await cache.incrbyfloat(monthly_key, cost_usd)
        await cache.expire(monthly_key, 86400 * 32)  # 32 days
        
        logger.info(
            "Cost recorded",
            tenant_id=tenant_id,
            category=category.value,
            cost=cost_usd,
            agent_id=agent_id,
            model=model
        )
        
        # Check budget and send alerts if needed
        asyncio.create_task(self._check_budget_and_alert(tenant_id))
        
        return record
    
    async def get_budget_status(
        self,
        tenant_id: str,
        period: BudgetPeriod = BudgetPeriod.DAILY
    ) -> BudgetStatus:
        """
        Get current budget status.
        
        Args:
            tenant_id: Tenant ID
            period: Budget period
        
        Returns:
            Budget status
        """
        limit = settings.cost_daily_limit if period == BudgetPeriod.DAILY else settings.cost_monthly_limit
        
        # Get usage from cache first (fast)
        cache = await self._get_cache()
        if period == BudgetPeriod.DAILY:
            cache_key = f"cost:daily:{tenant_id}:{datetime.utcnow().strftime('%Y-%m-%d')}"
        else:
            cache_key = f"cost:monthly:{tenant_id}:{datetime.utcnow().strftime('%Y-%m')}"
        
        cached_used = await cache.get(cache_key)
        if cached_used:
            used = float(cached_used)
        else:
            # Fallback to database query
            used = await self._get_usage_from_db(tenant_id, period)
        
        remaining = max(0, limit - used)
        utilization = used / limit if limit > 0 else 0
        
        # Determine alert level
        alert_level = AlertLevel.INFO
        for level, threshold in sorted(self.ALERT_THRESHOLDS.items(), key=lambda x: x[1], reverse=True):
            if utilization >= threshold:
                alert_level = level
                break
        
        # Forecast if budget will be exceeded
        forecast_exceeded = False
        if period == BudgetPeriod.DAILY:
            # Check if daily average would exceed monthly limit
            daily_avg = used
            days_in_month = 30
            forecast = daily_avg * days_in_month
            forecast_exceeded = forecast > settings.cost_monthly_limit
        
        return BudgetStatus(
            period=period,
            limit=limit,
            used=used,
            remaining=remaining,
            utilization=utilization,
            alert_level=alert_level,
            forecast_exceeded=forecast_exceeded
        )
    
    async def _get_usage_from_db(
        self,
        tenant_id: str,
        period: BudgetPeriod
    ) -> float:
        """Get usage from database."""
        try:
            async for db in get_db():
                if period == BudgetPeriod.DAILY:
                    query = text("""
                        SELECT COALESCE(SUM(cost_usd), 0) as total_cost
                        FROM cost_tracking
                        WHERE tenant_id = :tenant_id
                        AND created_at >= CURRENT_DATE
                    """)
                else:
                    query = text("""
                        SELECT COALESCE(SUM(cost_usd), 0) as total_cost
                        FROM cost_tracking
                        WHERE tenant_id = :tenant_id
                        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
                    """)
                
                result = await db.execute(query, {"tenant_id": tenant_id})
                row = result.fetchone()
                return float(row[0]) if row else 0.0
        except Exception as e:
            logger.error("Failed to get usage from database", error=str(e), tenant_id=tenant_id)
            return 0.0
    
    async def _check_budget_and_alert(self, tenant_id: str) -> None:
        """Check budget and send alerts if thresholds exceeded."""
        try:
            # Check daily budget
            daily_status = await self.get_budget_status(tenant_id, BudgetPeriod.DAILY)
            
            # Only alert if threshold crossed (not on every request)
            alert_key = f"{tenant_id}:daily:{daily_status.alert_level.value}"
            last_alert = self._alert_cache.get(alert_key)
            
            should_alert = (
                daily_status.alert_level != AlertLevel.INFO or
                last_alert is None or
                (datetime.utcnow() - last_alert).total_seconds() > 3600  # Alert at most once per hour
            )
            
            if should_alert and daily_status.utilization >= self.ALERT_THRESHOLDS.get(daily_status.alert_level, 0):
                await self._send_alert(tenant_id, daily_status)
                self._alert_cache[alert_key] = datetime.utcnow()
            
            # Check monthly budget
            monthly_status = await self.get_budget_status(tenant_id, BudgetPeriod.MONTHLY)
            
            alert_key = f"{tenant_id}:monthly:{monthly_status.alert_level.value}"
            last_alert = self._alert_cache.get(alert_key)
            
            should_alert = (
                monthly_status.alert_level != AlertLevel.INFO or
                last_alert is None or
                (datetime.utcnow() - last_alert).total_seconds() > 86400  # Alert at most once per day
            )
            
            if should_alert and monthly_status.utilization >= self.ALERT_THRESHOLDS.get(monthly_status.alert_level, 0):
                await self._send_alert(tenant_id, monthly_status)
                self._alert_cache[alert_key] = datetime.utcnow()
                
        except Exception as e:
            logger.error("Budget check failed", error=str(e), tenant_id=tenant_id)
    
    async def _send_alert(self, tenant_id: str, status: BudgetStatus) -> None:
        """Send cost alert."""
        alert_id = str(uuid4())
        
        # Determine message
        if status.utilization >= 1.0:
            message = f"Budget EXCEEDED: {status.period.value} limit of ${status.limit:.2f} exceeded (${status.used:.2f} used)"
        elif status.utilization >= 0.9:
            message = f"CRITICAL: {status.period.value} budget at {status.utilization*100:.1f}% (${status.used:.2f} / ${status.limit:.2f})"
        elif status.utilization >= 0.75:
            message = f"WARNING: {status.period.value} budget at {status.utilization*100:.1f}% (${status.used:.2f} / ${status.limit:.2f})"
        else:
            message = f"INFO: {status.period.value} budget at {status.utilization*100:.1f}% (${status.used:.2f} / ${status.limit:.2f})"
        
        alert = CostAlert(
            id=alert_id,
            tenant_id=tenant_id,
            period=status.period,
            alert_level=status.alert_level,
            utilization=status.utilization,
            limit=status.limit,
            used=status.used,
            message=message,
            created_at=datetime.utcnow()
        )
        
        # Store alert in database
        try:
            async for db in get_db():
                await db.execute(
                    text("""
                        INSERT INTO cost_alerts (
                            id, tenant_id, period, alert_level,
                            utilization, limit_amount, used_amount,
                            message, created_at, acknowledged
                        ) VALUES (
                            :id, :tenant_id, :period, :alert_level,
                            :utilization, :limit_amount, :used_amount,
                            :message, :created_at, :acknowledged
                        )
                    """),
                    {
                        "id": alert_id,
                        "tenant_id": tenant_id,
                        "period": status.period.value,
                        "alert_level": status.alert_level.value,
                        "utilization": status.utilization,
                        "limit_amount": status.limit,
                        "used_amount": status.used,
                        "message": message,
                        "created_at": datetime.utcnow(),
                        "acknowledged": False,
                    }
                )
                await db.commit()
                break
        except Exception as e:
            logger.warning("Failed to store alert in database", error=str(e))
            # Table might not exist yet - that's okay
        
        # TODO: Send notification via Iris agent or WebSocket
        logger.warning(
            "Cost alert",
            tenant_id=tenant_id,
            period=status.period.value,
            level=status.alert_level.value,
            utilization=status.utilization,
            message=message
        )
    
    async def check_budget_allowed(
        self,
        tenant_id: str,
        estimated_cost: float,
        period: BudgetPeriod = BudgetPeriod.DAILY
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if operation is allowed within budget.
        
        Args:
            tenant_id: Tenant ID
            estimated_cost: Estimated cost of operation
            period: Budget period to check
        
        Returns:
            Tuple of (allowed, reason if not allowed)
        """
        status = await self.get_budget_status(tenant_id, period)
        
        if status.remaining < estimated_cost:
            reason = f"{period.value} budget exceeded: ${status.used:.2f} / ${status.limit:.2f}, need ${estimated_cost:.2f}"
            return False, reason
        
        return True, None
    
    async def get_cost_summary(
        self,
        tenant_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get cost summary for dashboard.
        
        Args:
            tenant_id: Tenant ID
            days: Number of days to summarize
        
        Returns:
            Cost summary dictionary
        """
        try:
            async for db in get_db():
                # Get totals by category
                category_query = text("""
                    SELECT
                        category,
                        COUNT(*) as operations,
                        SUM(cost_usd) as total_cost,
                        SUM(tokens_input) as total_input_tokens,
                        SUM(tokens_output) as total_output_tokens,
                        AVG(cost_usd) as avg_cost
                    FROM cost_tracking
                    WHERE tenant_id = :tenant_id
                    AND created_at >= CURRENT_DATE - INTERVAL ':days days'
                    GROUP BY category
                    ORDER BY total_cost DESC
                """)
                
                result = await db.execute(category_query, {"tenant_id": tenant_id, "days": days})
                by_category = [dict(row._mapping) for row in result.fetchall()]
                
                # Get totals by agent
                agent_query = text("""
                    SELECT
                        agent_id,
                        COUNT(*) as operations,
                        SUM(cost_usd) as total_cost
                    FROM cost_tracking
                    WHERE tenant_id = :tenant_id
                    AND created_at >= CURRENT_DATE - INTERVAL ':days days'
                    AND agent_id IS NOT NULL
                    GROUP BY agent_id
                    ORDER BY total_cost DESC
                    LIMIT 10
                """)
                
                result = await db.execute(agent_query, {"tenant_id": tenant_id, "days": days})
                by_agent = [dict(row._mapping) for row in result.fetchall()]
                
                # Get daily totals
                daily_query = text("""
                    SELECT
                        DATE(created_at) as date,
                        SUM(cost_usd) as total_cost,
                        COUNT(*) as operations
                    FROM cost_tracking
                    WHERE tenant_id = :tenant_id
                    AND created_at >= CURRENT_DATE - INTERVAL ':days days'
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                """)
                
                result = await db.execute(daily_query, {"tenant_id": tenant_id, "days": days})
                daily_totals = [dict(row._mapping) for row in result.fetchall()]
                
                # Calculate totals
                total_cost = sum(cat["total_cost"] for cat in by_category)
                total_operations = sum(cat["operations"] for cat in by_category)
                
                return {
                    "period_days": days,
                    "total_cost": total_cost,
                    "total_operations": total_operations,
                    "by_category": by_category,
                    "by_agent": by_agent,
                    "daily_totals": daily_totals,
                    "budget_status": {
                        "daily": (await self.get_budget_status(tenant_id, BudgetPeriod.DAILY)).model_dump(),
                        "monthly": (await self.get_budget_status(tenant_id, BudgetPeriod.MONTHLY)).model_dump(),
                    }
                }
        except Exception as e:
            logger.error("Failed to get cost summary", error=str(e), tenant_id=tenant_id)
            return {
                "period_days": days,
                "total_cost": 0.0,
                "total_operations": 0,
                "by_category": [],
                "by_agent": [],
                "daily_totals": [],
                "budget_status": {
                    "daily": {"error": str(e)},
                    "monthly": {"error": str(e)},
                }
            }


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_cost_tracker: Optional[CostTracker] = None


async def get_cost_tracker() -> CostTracker:
    """Get cost tracker singleton."""
    global _cost_tracker
    if _cost_tracker is None:
        _cost_tracker = CostTracker()
    return _cost_tracker


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

async def record_cost(
    tenant_id: str,
    category: CostCategory,
    cost_usd: float,
    agent_id: Optional[str] = None,
    tokens_input: int = 0,
    tokens_output: int = 0,
    model: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> CostRecord:
    """Convenience function to record cost."""
    tracker = await get_cost_tracker()
    return await tracker.record_cost(
        tenant_id=tenant_id,
        category=category,
        cost_usd=cost_usd,
        agent_id=agent_id,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
        model=model,
        metadata=metadata
    )
