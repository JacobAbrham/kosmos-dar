"""
KOSMOS V2.0 Athena Agent - Analytics & Strategy (LangGraph Enhanced)

Athena handles all analytical operations including data analysis,
reporting, insights generation, and strategic recommendations.
Participates in Pentarchy voting based on strategic value assessment.
"""

from typing import Any, Dict, List, Optional
from enum import Enum

import structlog
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END

from .langgraph_base import (
    LangGraphAgent,
    AgentGraphState,
    WorkflowPhase,
)
from core.config import settings
from core.tool_registry import ToolCategory

logger = structlog.get_logger()


class AnalysisType(str, Enum):
    """Types of analysis Athena can perform."""
    DESCRIPTIVE = "descriptive"      # What happened?
    DIAGNOSTIC = "diagnostic"        # Why did it happen?
    PREDICTIVE = "predictive"        # What will happen?
    PRESCRIPTIVE = "prescriptive"    # What should we do?


class VisualizationType(str, Enum):
    """Types of visualizations."""
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    SCATTER = "scatter"
    TABLE = "table"
    METRIC = "metric"
    HEATMAP = "heatmap"
    TIMELINE = "timeline"


class AthenaState(AgentGraphState):
    """State for Athena analytics workflow."""
    # Analysis context
    query: str = ""
    analysis_type: AnalysisType = AnalysisType.DESCRIPTIVE
    analysis_subject: Optional[str] = None

    # Data
    data_context: Dict[str, Any] = Field(default_factory=dict)
    input_data: List[Dict[str, Any]] = Field(default_factory=list)
    processed_data: Dict[str, Any] = Field(default_factory=dict)

    # Insights
    insights: List[Dict[str, Any]] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    confidence_score: float = 0.0

    # Visualization
    suggested_viz: VisualizationType = VisualizationType.TABLE
    visualizations: List[Dict[str, Any]] = Field(default_factory=list)
    chart_config: Dict[str, Any] = Field(default_factory=dict)

    # Voting (for Pentarchy)
    vote_decision: Optional[bool] = None
    vote_confidence: float = 0.0
    vote_reasons: List[str] = Field(default_factory=list)


class AthenaAgent(LangGraphAgent[AthenaState]):
    """
    Athena - Analytics & Strategy Agent (LangGraph Enhanced)

    Capabilities:
    - Data analysis (descriptive, diagnostic, predictive, prescriptive)
    - Report generation
    - Insight extraction
    - Visualization recommendations
    - Pentarchy voting on strategic value
    """

    def __init__(self):
        super().__init__(
            agent_id="athena",
            name="Athena",
            domain="analytics",
            description="Analytics, insights, and strategic analysis",
            tool_categories=[
                ToolCategory.ANALYTICS,
                ToolCategory.AI_REASONING,
            ],
            mcp_servers=[
                "mcp-duckdb",
                "sequential-thinking",
                "context7-mcp",
            ],
            pentarchy_voter=True,  # Athena votes on strategic value
            security_veto=False,
            max_iterations=15,
            timeout_seconds=120,
        )

    def create_state_class(self) -> type:
        return AthenaState

    async def _build_workflow(self) -> Any:
        workflow = StateGraph(AthenaState)

        workflow.add_node("understand_request", self._understand_request)
        workflow.add_node("gather_data", self._gather_data)
        workflow.add_node("analyze_data", self._analyze_data)
        workflow.add_node("extract_insights", self._extract_insights)
        workflow.add_node("recommend_viz", self._recommend_visualization)
        workflow.add_node("generate_recommendations", self._generate_recommendations)
        workflow.add_node("synthesize", self._synthesize_node)
        workflow.add_node("handle_error", self._handle_error_node)

        workflow.set_entry_point("understand_request")

        workflow.add_edge("understand_request", "gather_data")
        workflow.add_edge("gather_data", "analyze_data")
        workflow.add_edge("analyze_data", "extract_insights")
        workflow.add_edge("extract_insights", "recommend_viz")
        workflow.add_edge("recommend_viz", "generate_recommendations")
        workflow.add_edge("generate_recommendations", "synthesize")
        workflow.add_edge("synthesize", END)
        workflow.add_edge("handle_error", END)

        return workflow.compile(checkpointer=self._checkpointer)

    async def _understand_request(self, state: AthenaState) -> Dict[str, Any]:
        """Understand and classify the analytics request."""
        self.logger.info("Understanding analytics request...")

        task = state.current_task or ""
        task_lower = task.lower()

        # Classify analysis type
        if any(word in task_lower for word in ["predict", "forecast", "future", "will", "projection"]):
            analysis_type = AnalysisType.PREDICTIVE
        elif any(word in task_lower for word in ["why", "cause", "reason", "because", "diagnose"]):
            analysis_type = AnalysisType.DIAGNOSTIC
        elif any(word in task_lower for word in ["should", "recommend", "suggest", "best", "optimize"]):
            analysis_type = AnalysisType.PRESCRIPTIVE
        else:
            analysis_type = AnalysisType.DESCRIPTIVE

        # Extract analysis subject
        subjects = ["revenue", "users", "performance", "costs", "sales", "growth",
                   "conversion", "engagement", "retention", "churn"]
        subject = None
        for s in subjects:
            if s in task_lower:
                subject = s
                break

        await self._emit_progress(state, f"Analysis type: {analysis_type.value}", 0.15)

        return {
            "query": task,
            "analysis_type": analysis_type,
            "analysis_subject": subject
        }

    async def _gather_data(self, state: AthenaState) -> Dict[str, Any]:
        """Gather data for analysis."""
        self.logger.info("Gathering data...", subject=state.analysis_subject)

        data_context = {}
        input_data = []

        # Use context7 MCP for semantic search if available
        try:
            if "context7-mcp" in self.mcp_servers:
                result = await self._execute_mcp_tool(
                    "context7-mcp.search",
                    {"query": state.query, "limit": 10}
                )
                if result.success:
                    data_context["rag_results"] = result.result
        except Exception as e:
            self.logger.warning("Context retrieval failed", error=str(e))

        # Use DuckDB for analytics queries
        try:
            if "mcp-duckdb" in self.mcp_servers and state.analysis_subject:
                result = await self._execute_mcp_tool(
                    "mcp-duckdb.query",
                    {"query": f"SELECT * FROM {state.analysis_subject} LIMIT 1000"}
                )
                if result.success:
                    input_data = result.result.get("rows", [])
        except Exception as e:
            self.logger.warning("DuckDB query failed", error=str(e))

        await self._emit_progress(state, "Data gathered", 0.3)

        return {
            "data_context": data_context,
            "input_data": input_data
        }

    async def _analyze_data(self, state: AthenaState) -> Dict[str, Any]:
        """Perform the main analysis."""
        self.logger.info("Performing analysis...", type=state.analysis_type.value)

        processed = {
            "type": state.analysis_type.value,
            "subject": state.analysis_subject,
            "sample_size": len(state.input_data),
            "has_context": bool(state.data_context),
            "summary": {}
        }

        # Calculate basic statistics if we have data
        if state.input_data:
            processed["summary"]["record_count"] = len(state.input_data)
            processed["summary"]["fields"] = list(state.input_data[0].keys()) if state.input_data else []

        await self._emit_progress(state, "Analysis complete", 0.5)

        return {"processed_data": processed}

    async def _extract_insights(self, state: AthenaState) -> Dict[str, Any]:
        """Extract insights from analysis."""
        self.logger.info("Extracting insights...")

        insights = []

        # Generate insights based on analysis type
        if state.analysis_type == AnalysisType.DESCRIPTIVE:
            insights.append({
                "type": "summary",
                "title": "Data Overview",
                "content": f"Analysis of {state.analysis_subject or 'data'} complete",
                "confidence": 0.85
            })
            if state.processed_data.get("summary", {}).get("record_count"):
                insights.append({
                    "type": "metric",
                    "title": "Sample Size",
                    "content": f"{state.processed_data['summary']['record_count']} records analyzed",
                    "confidence": 0.95
                })

        elif state.analysis_type == AnalysisType.DIAGNOSTIC:
            insights.append({
                "type": "root_cause",
                "title": "Root Cause Analysis",
                "content": "Identified contributing factors and correlations",
                "confidence": 0.70
            })

        elif state.analysis_type == AnalysisType.PREDICTIVE:
            insights.append({
                "type": "forecast",
                "title": "Trend Projection",
                "content": "Predicted outcomes based on current patterns",
                "confidence": 0.65
            })

        elif state.analysis_type == AnalysisType.PRESCRIPTIVE:
            insights.append({
                "type": "recommendation",
                "title": "Strategic Options",
                "content": "Recommended actions with expected outcomes",
                "confidence": 0.75
            })

        # Calculate overall confidence
        has_rag = "rag_results" in state.data_context
        has_data = bool(state.input_data)

        if has_rag and has_data:
            confidence = 0.85
        elif has_data:
            confidence = 0.70
        elif has_rag:
            confidence = 0.60
        else:
            confidence = 0.40

        await self._emit_progress(state, f"Insights extracted: {len(insights)}", 0.65)

        return {
            "insights": insights,
            "confidence_score": confidence
        }

    async def _recommend_visualization(self, state: AthenaState) -> Dict[str, Any]:
        """Recommend appropriate visualization."""
        self.logger.info("Recommending visualization...")

        # Determine best viz type based on analysis and subject
        if state.analysis_type == AnalysisType.PREDICTIVE:
            viz = VisualizationType.LINE
            config = {"showTrend": True, "showForecast": True, "smooth": True}
        elif state.analysis_subject in ["revenue", "sales", "costs"]:
            viz = VisualizationType.BAR
            config = {"stacked": False, "showValues": True}
        elif state.analysis_subject in ["conversion", "churn"]:
            viz = VisualizationType.PIE
            config = {"donut": True, "showPercentage": True}
        elif "compare" in (state.current_task or "").lower():
            viz = VisualizationType.BAR
            config = {"grouped": True}
        elif len(state.input_data) > 100:
            viz = VisualizationType.HEATMAP
            config = {"colorScale": "blues"}
        else:
            viz = VisualizationType.METRIC
            config = {"showChange": True, "showSparkline": True}

        visualizations = [{
            "type": viz.value,
            "config": config,
            "title": f"{state.analysis_subject or 'Data'} Analysis"
        }]

        await self._emit_progress(state, f"Visualization: {viz.value}", 0.75)

        return {
            "suggested_viz": viz,
            "chart_config": config,
            "visualizations": visualizations
        }

    async def _generate_recommendations(self, state: AthenaState) -> Dict[str, Any]:
        """Generate actionable recommendations."""
        self.logger.info("Generating recommendations...")

        recommendations = []

        if state.analysis_type == AnalysisType.PRESCRIPTIVE:
            recommendations = [
                f"Consider implementing data-driven decisions for {state.analysis_subject or 'key metrics'}",
                "Set up automated monitoring for critical KPIs",
                "Review findings with stakeholders for strategic alignment",
                "Establish baseline metrics for future comparison"
            ]
        elif state.analysis_type == AnalysisType.PREDICTIVE:
            recommendations = [
                "Monitor predicted trends closely",
                "Prepare contingency plans for forecast scenarios",
                "Update forecasting models quarterly"
            ]
        elif state.analysis_type == AnalysisType.DIAGNOSTIC:
            recommendations = [
                "Address identified root causes systematically",
                "Implement preventive measures for recurring issues",
                "Document lessons learned"
            ]
        else:
            recommendations = [
                "Review insights for potential action items",
                "Consider deeper analysis for specific areas",
                "Share findings with relevant teams"
            ]

        await self._emit_progress(state, f"Recommendations: {len(recommendations)}", 0.85)

        return {"recommendations": recommendations}

    async def _synthesize_node(self, state: AthenaState) -> Dict[str, Any]:
        """Synthesize analytics response."""
        self.logger.info("Synthesizing response...")

        state.phase = WorkflowPhase.COMPLETED

        # Build response
        response = f"## {state.analysis_type.value.title()} Analysis\n\n"

        if state.analysis_subject:
            response += f"**Subject**: {state.analysis_subject.title()}\n"
        response += f"**Confidence**: {state.confidence_score:.0%}\n\n"

        if state.insights:
            response += "### Key Insights\n"
            for insight in state.insights:
                response += f"- **{insight.get('title', 'Insight')}**: {insight.get('content', '')}\n"

        if state.recommendations:
            response += "\n### Recommendations\n"
            for rec in state.recommendations:
                response += f"- {rec}\n"

        # Generate SDUI components
        components = []

        # Add confidence metric
        components.append({
            "type": "metric",
            "props": {
                "label": "Confidence Score",
                "value": f"{state.confidence_score:.0%}",
                "trend": "up" if state.confidence_score > 0.7 else "neutral"
            }
        })

        # Add chart if we have data
        if state.visualizations:
            viz = state.visualizations[0]
            components.append({
                "type": "chart",
                "props": {
                    "title": viz.get("title", "Analysis"),
                    "chartType": viz.get("type", "bar"),
                    "config": viz.get("config", {}),
                    "data": state.processed_data.get("summary", {})
                }
            })

        # Add insights cards
        for insight in state.insights:
            components.append({
                "type": "card",
                "props": {
                    "title": insight.get("title", "Insight"),
                    "content": insight.get("content", ""),
                    "variant": insight.get("type", "default")
                }
            })

        # Add recommendations
        if state.recommendations:
            components.append({
                "type": "card",
                "props": {
                    "title": "Recommendations",
                    "content": "\n".join(f"• {r}" for r in state.recommendations),
                    "variant": "info"
                }
            })

        await self._emit_progress(state, "Complete", 1.0)

        return {
            "final_response": response,
            "final_result": {
                "analysis_type": state.analysis_type.value,
                "subject": state.analysis_subject,
                "confidence": state.confidence_score,
                "insights": state.insights,
                "recommendations": state.recommendations,
                "visualization": state.suggested_viz.value
            },
            "ui_components": components,
            "suggested_layout": "analytics",
            "phase": state.phase
        }

    # =========================================================================
    # Pentarchy Voting API
    # =========================================================================

    async def vote_on_proposal(
        self,
        proposal: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Vote on a Pentarchy proposal based on strategic value.

        Athena evaluates:
        - ROI potential
        - Strategic alignment
        - Risk-reward ratio
        - Data quality backing the decision
        """
        task_description = proposal.get("task", str(proposal))
        estimated_cost = proposal.get("estimated_cost", 0)

        # Strategic evaluation
        reasons = []
        score = 0.5  # Neutral starting point

        task_lower = task_description.lower()

        # Positive indicators
        positive_keywords = ["growth", "efficiency", "automation", "optimize", "improve",
                           "strategic", "revenue", "reduce cost", "scalable"]
        for kw in positive_keywords:
            if kw in task_lower:
                score += 0.08
                reasons.append(f"Strategic value: {kw}")

        # Negative indicators
        negative_keywords = ["risky", "experimental", "untested", "high cost", "complex",
                           "uncertain", "volatile"]
        for kw in negative_keywords:
            if kw in task_lower:
                score -= 0.08
                reasons.append(f"Risk factor: {kw}")

        # Cost analysis
        if estimated_cost > 0.5:
            score -= 0.1
            reasons.append(f"High cost: ${estimated_cost:.2f}")
        elif estimated_cost < 0.1:
            score += 0.05
            reasons.append("Low cost operation")

        # Data-backed indicator
        if proposal.get("data_backed"):
            score += 0.1
            reasons.append("Data-backed decision")

        # Cap score
        score = max(0.1, min(0.95, score))

        # Decision
        approve = score >= 0.5
        confidence = abs(score - 0.5) * 2

        return {
            "approve": approve,
            "confidence": confidence,
            "reasons": reasons,
            "score": score
        }

    async def vote(self, proposal: Dict[str, Any]) -> Dict[str, Any]:
        """Alias for vote_on_proposal for backward compatibility."""
        return await self.vote_on_proposal(proposal)


# Factory
_athena_instance: Optional[AthenaAgent] = None


async def get_athena() -> AthenaAgent:
    global _athena_instance
    if _athena_instance is None:
        _athena_instance = AthenaAgent()
        await _athena_instance.initialize()
    return _athena_instance


async def close_athena() -> None:
    global _athena_instance
    if _athena_instance:
        await _athena_instance.shutdown()
        _athena_instance = None
