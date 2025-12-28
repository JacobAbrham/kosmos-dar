"""
KOSMOS V2.0 Nur PROMETHEUS Agent - Financial Intelligence

Nur PROMETHEUS handles all financial operations including budgeting,
cost tracking, financial analysis, and cost governance.

Upgraded to LangGraph base with:
- State persistence (checkpointing)
- Pentarchy voting integration (cost-benefit analysis)
- Semantic router integration
- SDUI financial visualization components
- Real-time cost tracking
"""

from typing import Any, Callable, Dict, List, Optional, Literal
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from uuid import uuid4

import structlog
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, AIMessage

from .langgraph_base import (
    LangGraphAgent,
    AgentGraphState,
    WorkflowPhase,
    HumanInputRequest,
    HumanInputType,
    ToolCategory,
    require_approval,
)
from core.config import settings
from core.tool_registry import ToolCallResult

logger = structlog.get_logger()


# ============================================================================
# Domain Types
# ============================================================================

class CostCategory(str, Enum):
    """Cost categories for tracking."""
    LLM_INFERENCE = "llm_inference"
    TOOL_EXECUTION = "tool_execution"
    DATA_STORAGE = "data_storage"
    API_CALLS = "api_calls"
    COMPUTE = "compute"
    NETWORK = "network"
    MCP_OPERATIONS = "mcp_operations"


class BudgetPeriod(str, Enum):
    """Budget period types."""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class ApprovalDecision(str, Enum):
    """Cost approval decisions."""
    AUTO_APPROVED = "auto_approved"
    PENTARCHY_APPROVED = "pentarchy_approved"
    DENIED = "denied"
    ESCALATED = "escalated"
    PENDING = "pending"


class FinanceOperation(str, Enum):
    """Financial operations."""
    ESTIMATE = "estimate"
    APPROVE = "approve"
    TRACK = "track"
    REPORT = "report"
    BUDGET_CHECK = "budget_check"
    FORECAST = "forecast"
    ALERT = "alert"


class AlertLevel(str, Enum):
    """Budget alert levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


# ============================================================================
# State Definition
# ============================================================================

class NurPrometheusState(AgentGraphState):
    """
    State for Nur PROMETHEUS financial workflow.

    Extends base state with finance-specific fields.
    """
    # Operation details
    operation: FinanceOperation = FinanceOperation.ESTIMATE

    # Cost estimation
    operation_type: Optional[str] = None
    model_name: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0
    cost_breakdown: Dict[str, float] = Field(default_factory=dict)
    cost_confidence: float = 0.8

    # Budget status
    budget_period: BudgetPeriod = BudgetPeriod.DAILY
    budget_limit: float = 0.0
    budget_used: float = 0.0
    budget_remaining: float = 0.0
    budget_utilization: float = 0.0

    # Approval
    approval_decision: ApprovalDecision = ApprovalDecision.PENDING
    approval_reason: str = ""
    requires_pentarchy: bool = False

    # Tracking
    cost_event: Optional[Dict[str, Any]] = None
    tracked_costs: List[Dict[str, Any]] = Field(default_factory=list)

    # Reporting
    report_type: Optional[str] = None
    report_data: Optional[Dict[str, Any]] = None

    # Alerts
    alerts: List[Dict[str, Any]] = Field(default_factory=list)

    # Forecasting
    forecast_period: Optional[str] = None
    forecast_data: Optional[Dict[str, Any]] = None


# ============================================================================
# Nur PROMETHEUS Agent
# ============================================================================

class NurPrometheusAgent(LangGraphAgent[NurPrometheusState]):
    """
    Nur PROMETHEUS - Financial Intelligence Agent

    Responsibilities:
    - Estimate costs before execution
    - Track actual costs and usage
    - Enforce budget limits
    - Generate financial reports
    - Cost-based governance decisions
    - Participate in Pentarchy voting (ROI analysis)
    - Alert on budget thresholds

    MCP Servers:
    - postgres-mcp: Cost tracking database

    SDUI Components:
    - GlassMeter: Budget utilization
    - GlassChart: Cost trends
    - GlassCard: Financial summary
    """

    # Cost per 1K tokens by model
    MODEL_COSTS = {
        "gpt-4o": {"input": 0.0025, "output": 0.01},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "claude-3-5-sonnet": {"input": 0.003, "output": 0.015},
        "claude-3-5-haiku": {"input": 0.0008, "output": 0.004},
        "claude-3-opus": {"input": 0.015, "output": 0.075},
        "mistral-7b": {"input": 0.0001, "output": 0.0001},
        "llama-3.2-3b": {"input": 0.00005, "output": 0.00005},
        "llama-3.1-70b": {"input": 0.0009, "output": 0.0009},
    }

    # MCP tool base costs
    MCP_TOOL_COSTS = {
        "github-mcp": 0.001,
        "slack-mcp": 0.0005,
        "postgres-mcp": 0.0002,
        "filesystem-mcp": 0.0001,
        "gcal-mcp": 0.0005,
        "sequential-thinking": 0.002,
    }

    # Budget alert thresholds
    ALERT_THRESHOLDS = {
        AlertLevel.INFO: 0.5,      # 50% utilization
        AlertLevel.WARNING: 0.75,  # 75% utilization
        AlertLevel.CRITICAL: 0.9,  # 90% utilization
    }

    def __init__(self):
        super().__init__(
            agent_id="nur_prometheus",
            name="Nur PROMETHEUS",
            domain="finance",
            description="Financial intelligence agent for cost estimation, tracking, and governance",
            tool_categories=[ToolCategory.DATABASE, ToolCategory.ANALYTICS],
            mcp_servers=["postgres-mcp"],
            pentarchy_voter=True,  # Nur PROMETHEUS votes in Pentarchy
            security_veto=False,
            max_iterations=10,
            timeout_seconds=60,
        )

    # =========================================================================
    # Template Implementation
    # =========================================================================

    def create_state_class(self) -> type:
        """Return NurPrometheusState for workflow."""
        return NurPrometheusState

    def define_nodes(self) -> Dict[str, Callable]:
        """Define Nur PROMETHEUS-specific workflow nodes."""
        return {
            "parse_finance_request": self._parse_finance_request,
            "estimate_cost": self._estimate_cost,
            "check_budget": self._check_budget,
            "make_approval_decision": self._make_approval_decision,
            "track_cost": self._track_cost,
            "generate_report": self._generate_report,
            "check_alerts": self._check_alerts,
            "generate_forecast": self._generate_forecast,
        }

    def define_edges(self) -> List[tuple]:
        """Define Nur PROMETHEUS-specific workflow edges."""
        return [
            ("plan", "parse_finance_request"),

            # Route based on operation
            ("parse_finance_request", self._route_operation, {
                "estimate": "estimate_cost",
                "approve": "estimate_cost",
                "track": "track_cost",
                "report": "generate_report",
                "forecast": "generate_forecast",
            }),

            ("estimate_cost", "check_budget"),
            ("check_budget", "check_alerts"),
            ("check_alerts", "make_approval_decision"),
            ("make_approval_decision", "synthesize"),
            ("track_cost", "check_alerts"),
            ("generate_report", "synthesize"),
            ("generate_forecast", "synthesize"),
        ]

    def _route_operation(self, state: NurPrometheusState) -> str:
        """Route to appropriate operation handler."""
        op = state.operation.value
        if op in ["estimate", "approve"]:
            return "estimate"
        return op

    # =========================================================================
    # Workflow Nodes
    # =========================================================================

    async def _parse_finance_request(self, state: NurPrometheusState) -> Dict[str, Any]:
        """Parse the financial request."""
        self.logger.info("Parsing finance request...", task=state.current_task)

        task_lower = (state.current_task or "").lower()

        # Determine operation
        if any(kw in task_lower for kw in ["estimate", "cost", "price"]):
            operation = FinanceOperation.ESTIMATE
        elif any(kw in task_lower for kw in ["approve", "permission"]):
            operation = FinanceOperation.APPROVE
        elif any(kw in task_lower for kw in ["track", "record", "log"]):
            operation = FinanceOperation.TRACK
        elif any(kw in task_lower for kw in ["report", "summary", "analytics"]):
            operation = FinanceOperation.REPORT
        elif any(kw in task_lower for kw in ["forecast", "predict", "project"]):
            operation = FinanceOperation.FORECAST
        elif any(kw in task_lower for kw in ["budget", "check"]):
            operation = FinanceOperation.BUDGET_CHECK
        else:
            operation = FinanceOperation.ESTIMATE

        # Extract context
        model_name = state.task_context.get("model", "gpt-4o")
        input_tokens = state.task_context.get("input_tokens", 0)
        output_tokens = state.task_context.get("output_tokens", 0)

        await self._emit_progress(state, "Request parsed", 0.1)

        return {
            "operation": operation,
            "model_name": model_name,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "budget_period": BudgetPeriod(state.task_context.get("period", "daily")),
        }

    async def _estimate_cost(self, state: NurPrometheusState) -> Dict[str, Any]:
        """Estimate cost for an operation."""
        self.logger.info("Estimating cost...", model=state.model_name)

        cost_breakdown = {}
        total_cost = 0.0

        # LLM inference cost
        if state.model_name and (state.input_tokens > 0 or state.output_tokens > 0):
            llm_cost = self.estimate_llm_cost(
                state.model_name,
                state.input_tokens,
                state.output_tokens
            )
            cost_breakdown["llm_inference"] = float(llm_cost)
            total_cost += float(llm_cost)

        # MCP tool costs
        tools_used = state.task_context.get("tools", [])
        for tool_path in tools_used:
            server = tool_path.split(".")[0] if "." in tool_path else tool_path
            tool_cost = self.MCP_TOOL_COSTS.get(server, 0.0001)
            cost_breakdown[f"tool_{server}"] = tool_cost
            total_cost += tool_cost

        # Add overhead
        overhead = total_cost * 0.1  # 10% overhead
        cost_breakdown["overhead"] = overhead
        total_cost += overhead

        await self._emit_progress(state, "Cost estimated", 0.3)

        return {
            "estimated_cost_usd": round(total_cost, 6),
            "cost_breakdown": cost_breakdown,
            "cost_confidence": 0.85,
        }

    async def _check_budget(self, state: NurPrometheusState) -> Dict[str, Any]:
        """Check current budget status."""
        self.logger.info("Checking budget...", period=state.budget_period.value)

        # Get budget limits from settings
        if state.budget_period == BudgetPeriod.DAILY:
            budget_limit = settings.cost_daily_limit
        elif state.budget_period == BudgetPeriod.MONTHLY:
            budget_limit = settings.cost_monthly_limit
        else:
            budget_limit = settings.cost_daily_limit

        # Query actual usage from database
        try:
            result = await self._execute_mcp_tool(
                "postgres-mcp.query",
                {
                    "query": f"""
                        SELECT COALESCE(SUM(cost_usd), 0) as total_cost
                        FROM cost_tracking
                        WHERE tenant_id = $1
                        AND created_at >= CURRENT_DATE
                    """,
                    "params": [state.tenant_id or "default"],
                }
            )

            if result.success:
                budget_used = float(result.result.get("total_cost", 0))
            else:
                budget_used = 0.0

        except Exception as e:
            self.logger.warning(f"Budget query failed: {e}")
            budget_used = 0.0

        budget_remaining = budget_limit - budget_used
        budget_utilization = budget_used / budget_limit if budget_limit > 0 else 0

        await self._emit_progress(state, "Budget checked", 0.5)

        return {
            "budget_limit": budget_limit,
            "budget_used": budget_used,
            "budget_remaining": budget_remaining,
            "budget_utilization": budget_utilization,
        }

    async def _check_alerts(self, state: NurPrometheusState) -> Dict[str, Any]:
        """Check for budget alerts."""
        self.logger.info("Checking alerts...")

        alerts = []

        # Check utilization thresholds
        for level, threshold in self.ALERT_THRESHOLDS.items():
            if state.budget_utilization >= threshold:
                alerts.append({
                    "level": level.value,
                    "threshold": threshold,
                    "utilization": state.budget_utilization,
                    "message": f"Budget {level.value}: {state.budget_utilization:.1%} utilized",
                    "timestamp": datetime.utcnow().isoformat(),
                })
                break  # Only show highest alert

        # Check if current operation would exceed budget
        if state.estimated_cost_usd > state.budget_remaining:
            alerts.append({
                "level": AlertLevel.CRITICAL.value,
                "message": f"Operation cost ${state.estimated_cost_usd:.4f} exceeds remaining budget ${state.budget_remaining:.2f}",
                "timestamp": datetime.utcnow().isoformat(),
            })

        return {"alerts": alerts}

    async def _make_approval_decision(self, state: NurPrometheusState) -> Dict[str, Any]:
        """Make cost approval decision."""
        self.logger.info("Making approval decision...")

        cost = state.estimated_cost_usd
        auto_approve_max = settings.cost_auto_approve_max
        pentarchy_max = settings.cost_pentarchy_vote_max

        # Check budget first
        if cost > state.budget_remaining:
            decision = ApprovalDecision.DENIED
            reason = f"Insufficient budget. Need ${cost:.4f}, have ${state.budget_remaining:.2f}"
            requires_pentarchy = False

        # Auto-approve small costs
        elif cost <= auto_approve_max:
            decision = ApprovalDecision.AUTO_APPROVED
            reason = f"Cost ${cost:.4f} within auto-approve limit ${auto_approve_max:.2f}"
            requires_pentarchy = False

        # Escalate medium costs to Pentarchy
        elif cost <= pentarchy_max:
            decision = ApprovalDecision.ESCALATED
            reason = f"Cost ${cost:.4f} requires Pentarchy approval"
            requires_pentarchy = True

        # Deny large costs
        else:
            decision = ApprovalDecision.DENIED
            reason = f"Cost ${cost:.4f} exceeds maximum ${pentarchy_max:.2f}"
            requires_pentarchy = False

        await self._emit_progress(state, f"Decision: {decision.value}", 0.8)

        return {
            "approval_decision": decision,
            "approval_reason": reason,
            "requires_pentarchy": requires_pentarchy,
            "requires_governance": requires_pentarchy,  # Trigger Pentarchy flow
        }

    async def _track_cost(self, state: NurPrometheusState) -> Dict[str, Any]:
        """Track actual cost usage."""
        self.logger.info("Tracking cost...")

        cost_event = state.task_context.get("cost_event", {})

        if cost_event:
            try:
                await self._execute_mcp_tool(
                    "postgres-mcp.execute",
                    {
                        "query": """
                            INSERT INTO cost_tracking (
                                id, tenant_id, agent_id, category,
                                cost_usd, tokens_input, tokens_output,
                                model, metadata, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                        """,
                        "params": [
                            str(uuid4()),
                            state.tenant_id or "default",
                            cost_event.get("agent_id", "unknown"),
                            cost_event.get("category", CostCategory.LLM_INFERENCE.value),
                            cost_event.get("cost_usd", 0),
                            cost_event.get("input_tokens", 0),
                            cost_event.get("output_tokens", 0),
                            cost_event.get("model"),
                            str(cost_event.get("metadata", {})),
                        ],
                    }
                )

                self.logger.info("Cost tracked", cost=cost_event.get("cost_usd"))

            except Exception as e:
                self.logger.error(f"Cost tracking failed: {e}")

        await self._emit_progress(state, "Cost tracked", 0.9)

        return {"cost_event": cost_event}

    async def _generate_report(self, state: NurPrometheusState) -> Dict[str, Any]:
        """Generate financial report."""
        self.logger.info("Generating report...")

        report_type = state.task_context.get("report_type", "summary")

        # Query cost data
        try:
            result = await self._execute_mcp_tool(
                "postgres-mcp.query",
                {
                    "query": """
                        SELECT
                            category,
                            agent_id,
                            COUNT(*) as operations,
                            SUM(cost_usd) as total_cost,
                            SUM(tokens_input) as total_input_tokens,
                            SUM(tokens_output) as total_output_tokens,
                            AVG(cost_usd) as avg_cost
                        FROM cost_tracking
                        WHERE tenant_id = $1
                        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
                        GROUP BY category, agent_id
                        ORDER BY total_cost DESC
                    """,
                    "params": [state.tenant_id or "default"],
                }
            )

            if result.success:
                data = result.result
            else:
                data = []

        except Exception as e:
            self.logger.warning(f"Report query failed: {e}")
            data = []

        # Build report
        report_data = {
            "generated_at": datetime.utcnow().isoformat(),
            "tenant_id": state.tenant_id,
            "period": "last_30_days",
            "type": report_type,
            "data": data,
            "summary": {
                "total_cost": sum(r.get("total_cost", 0) for r in data) if data else 0,
                "total_operations": sum(r.get("operations", 0) for r in data) if data else 0,
                "by_category": {},
                "by_agent": {},
            },
            "budget": {
                "daily_limit": settings.cost_daily_limit,
                "monthly_limit": settings.cost_monthly_limit,
                "current_utilization": state.budget_utilization,
            },
        }

        # Aggregate by category and agent
        for row in (data or []):
            cat = row.get("category", "unknown")
            agent = row.get("agent_id", "unknown")
            cost = row.get("total_cost", 0)

            report_data["summary"]["by_category"][cat] = report_data["summary"]["by_category"].get(cat, 0) + cost
            report_data["summary"]["by_agent"][agent] = report_data["summary"]["by_agent"].get(agent, 0) + cost

        await self._emit_progress(state, "Report generated", 0.9)

        return {"report_data": report_data}

    async def _generate_forecast(self, state: NurPrometheusState) -> Dict[str, Any]:
        """Generate cost forecast."""
        self.logger.info("Generating forecast...")

        forecast_days = int(state.task_context.get("days", 30))

        # Simple linear projection based on recent usage
        daily_avg = state.budget_used  # Assuming this is daily

        forecast_data = {
            "generated_at": datetime.utcnow().isoformat(),
            "forecast_period_days": forecast_days,
            "method": "linear_projection",
            "projections": [
                {
                    "day": i + 1,
                    "projected_cost": daily_avg * (i + 1),
                    "projected_cumulative": daily_avg * (i + 1),
                }
                for i in range(min(forecast_days, 30))
            ],
            "summary": {
                "projected_total": daily_avg * forecast_days,
                "daily_average": daily_avg,
                "confidence": 0.7,
                "will_exceed_budget": daily_avg * forecast_days > settings.cost_monthly_limit,
            },
        }

        return {"forecast_data": forecast_data}

    # =========================================================================
    # SDUI Component Generation
    # =========================================================================

    async def _generate_sdui_components(self, state: NurPrometheusState) -> List[Dict[str, Any]]:
        """Generate SDUI components for financial visualization."""
        components = []

        # Budget meter
        components.append({
            "type": "GlassMeter",
            "props": {
                "label": f"{state.budget_period.value.title()} Budget",
                "value": state.budget_utilization * 100,
                "maxValue": 100,
                "showPercentage": True,
                "color": "red" if state.budget_utilization > 0.9 else "yellow" if state.budget_utilization > 0.75 else "green",
                "subtitle": f"${state.budget_used:.2f} / ${state.budget_limit:.2f}",
            }
        })

        # Cost estimate card
        if state.estimated_cost_usd > 0:
            breakdown_items = [
                {"label": k.replace("_", " ").title(), "value": f"${v:.4f}"}
                for k, v in state.cost_breakdown.items()
            ]

            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Cost Estimate",
                    "variant": "default",
                    "children": [
                        {
                            "type": "GlassDataList",
                            "props": {
                                "items": breakdown_items,
                                "total": {"label": "Total", "value": f"${state.estimated_cost_usd:.4f}"},
                            }
                        }
                    ]
                }
            })

        # Approval decision
        if state.approval_decision != ApprovalDecision.PENDING:
            decision_colors = {
                ApprovalDecision.AUTO_APPROVED: "green",
                ApprovalDecision.PENTARCHY_APPROVED: "green",
                ApprovalDecision.DENIED: "red",
                ApprovalDecision.ESCALATED: "yellow",
            }

            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Approval Decision",
                    "variant": decision_colors.get(state.approval_decision, "default"),
                    "children": [
                        {
                            "type": "GlassText",
                            "props": {
                                "text": state.approval_decision.value.replace("_", " ").title(),
                                "variant": "heading",
                            }
                        },
                        {
                            "type": "GlassText",
                            "props": {
                                "text": state.approval_reason,
                                "variant": "body",
                            }
                        }
                    ]
                }
            })

        # Alerts
        for alert in state.alerts:
            components.append({
                "type": "GlassAlert",
                "props": {
                    "severity": alert["level"],
                    "title": f"Budget {alert['level'].title()}",
                    "message": alert["message"],
                }
            })

        # Report data
        if state.report_data:
            # Cost breakdown chart
            if state.report_data.get("summary", {}).get("by_category"):
                chart_data = [
                    {"label": k, "value": v}
                    for k, v in state.report_data["summary"]["by_category"].items()
                ]

                components.append({
                    "type": "GlassChart",
                    "props": {
                        "type": "pie",
                        "title": "Cost by Category",
                        "data": chart_data,
                    }
                })

            # Agent cost table
            if state.report_data.get("summary", {}).get("by_agent"):
                table_data = [
                    {"agent": k, "cost": f"${v:.4f}"}
                    for k, v in state.report_data["summary"]["by_agent"].items()
                ]

                components.append({
                    "type": "GlassTable",
                    "props": {
                        "title": "Cost by Agent",
                        "columns": [
                            {"key": "agent", "label": "Agent"},
                            {"key": "cost", "label": "Total Cost"},
                        ],
                        "rows": table_data,
                    }
                })

        # Response message
        components.append({
            "type": "GlassChatBubble",
            "props": {
                "role": "assistant",
                "agent": "Nur PROMETHEUS",
                "content": self._build_response_message(state),
            }
        })

        return components

    def _build_response_message(self, state: NurPrometheusState) -> str:
        """Build the response message based on operation result."""
        if state.operation == FinanceOperation.ESTIMATE:
            return f"Estimated cost: ${state.estimated_cost_usd:.4f} (confidence: {state.cost_confidence:.0%})"

        elif state.operation == FinanceOperation.APPROVE:
            return f"Decision: {state.approval_decision.value.replace('_', ' ')}. {state.approval_reason}"

        elif state.operation == FinanceOperation.TRACK:
            return "Cost event tracked successfully."

        elif state.operation == FinanceOperation.REPORT:
            if state.report_data:
                total = state.report_data.get("summary", {}).get("total_cost", 0)
                return f"Report generated. Total cost for period: ${total:.2f}"
            return "Report generated."

        elif state.operation == FinanceOperation.FORECAST:
            if state.forecast_data:
                projected = state.forecast_data.get("summary", {}).get("projected_total", 0)
                return f"Forecast complete. Projected cost: ${projected:.2f}"
            return "Forecast generated."

        elif state.operation == FinanceOperation.BUDGET_CHECK:
            return f"Budget status: ${state.budget_used:.2f} used of ${state.budget_limit:.2f} ({state.budget_utilization:.1%})"

        return "Financial operation completed."

    # =========================================================================
    # Pentarchy Voting
    # =========================================================================

    async def vote_on_proposal(self, proposal: Dict[str, Any]) -> Dict[str, Any]:
        """
        Cast vote in Pentarchy governance.

        Nur PROMETHEUS votes based on cost-benefit analysis.
        """
        self.logger.info("Evaluating proposal for Pentarchy vote...")

        score = 0.5
        reasons = []

        estimated_cost = proposal.get("estimated_cost", 0)
        expected_benefit = proposal.get("expected_benefit", 0)

        # Check cost thresholds
        if estimated_cost <= settings.cost_auto_approve_max:
            score += 0.2
            reasons.append("within_auto_approve_limit")
        elif estimated_cost > settings.cost_pentarchy_vote_max:
            score -= 0.3
            reasons.append("exceeds_max_threshold")

        # Check ROI
        if expected_benefit > 0 and estimated_cost > 0:
            roi = (expected_benefit - estimated_cost) / estimated_cost
            if roi > 1.0:
                score += 0.25
                reasons.append(f"high_roi_{roi:.2f}")
            elif roi > 0.2:
                score += 0.1
                reasons.append(f"positive_roi_{roi:.2f}")
            elif roi < 0:
                score -= 0.2
                reasons.append(f"negative_roi_{roi:.2f}")

        # Check budget impact
        budget_impact = proposal.get("budget_impact", 0)
        if budget_impact > 0.2:  # >20% of remaining budget
            score -= 0.15
            reasons.append("high_budget_impact")
        elif budget_impact < 0.05:  # <5% of remaining budget
            score += 0.1
            reasons.append("low_budget_impact")

        # Check for recurring costs
        if proposal.get("is_recurring"):
            score -= 0.1
            reasons.append("recurring_cost_concern")

        # Check for cost optimization potential
        if proposal.get("has_cost_optimization"):
            score += 0.1
            reasons.append("cost_optimization_opportunity")

        approve = score >= 0.5

        return {
            "voter": "nur_prometheus",
            "approve": approve,
            "confidence": abs(score - 0.5) * 2,
            "score": score,
            "reasons": reasons,
            "category": "cost_benefit_analysis",
            "timestamp": datetime.utcnow().isoformat(),
        }

    # =========================================================================
    # Cost Estimation Utilities
    # =========================================================================

    def estimate_llm_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> Decimal:
        """Estimate cost for LLM inference."""
        costs = self.MODEL_COSTS.get(model)
        if not costs:
            # Default to GPT-4o costs for unknown models
            costs = self.MODEL_COSTS["gpt-4o"]

        input_cost = Decimal(str(costs["input"])) * Decimal(input_tokens) / 1000
        output_cost = Decimal(str(costs["output"])) * Decimal(output_tokens) / 1000

        return input_cost + output_cost

    def estimate_mcp_cost(self, server: str, call_count: int = 1) -> float:
        """Estimate cost for MCP tool calls."""
        base_cost = self.MCP_TOOL_COSTS.get(server, 0.0001)
        return base_cost * call_count

    # =========================================================================
    # Quick Access Methods
    # =========================================================================

    async def quick_estimate(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> Dict[str, Any]:
        """Quick cost estimate without full workflow."""
        cost = self.estimate_llm_cost(model, input_tokens, output_tokens)

        return {
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": float(cost),
            "auto_approved": float(cost) <= settings.cost_auto_approve_max,
        }

    async def check_can_proceed(self, estimated_cost: float) -> Dict[str, Any]:
        """Quick check if an operation can proceed given cost."""
        result = await self.process(
            task="Check if this cost is approved",
            context={
                "operation": "approve",
                "estimated_cost": estimated_cost,
            }
        )

        return {
            "can_proceed": result.get("approval_decision") in [
                ApprovalDecision.AUTO_APPROVED.value,
                ApprovalDecision.PENTARCHY_APPROVED.value,
            ],
            "decision": result.get("approval_decision"),
            "reason": result.get("approval_reason"),
        }
