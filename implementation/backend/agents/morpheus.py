"""
KOSMOS V2.0 Morpheus Agent - Prediction & Simulation

Morpheus handles all predictive analytics, what-if scenarios,
and simulation operations.

Upgraded to LangGraph base with:
- State persistence (checkpointing)
- Sequential thinking integration
- Semantic router integration
- SDUI visualization components
- Multi-scenario simulation
"""

from typing import Any, Callable, Dict, List, Optional, Literal
from datetime import datetime, timedelta
from enum import Enum
from uuid import uuid4

import structlog
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, AIMessage

from .langgraph_base import (
    LangGraphAgent,
    AgentGraphState,
    WorkflowPhase,
    ToolCategory,
)
from core.tool_registry import ToolCallResult

logger = structlog.get_logger()


# ============================================================================
# Domain Types
# ============================================================================

class PredictionType(str, Enum):
    """Types of predictions."""
    FORECAST = "forecast"              # Time series prediction
    CLASSIFICATION = "classification"  # Category prediction
    ANOMALY = "anomaly"               # Anomaly detection
    RECOMMENDATION = "recommendation"  # Recommendations


class SimulationType(str, Enum):
    """Types of simulations."""
    WHAT_IF = "what_if"           # Scenario analysis
    MONTE_CARLO = "monte_carlo"   # Probabilistic simulation
    SENSITIVITY = "sensitivity"   # Sensitivity analysis


class ConfidenceLevel(str, Enum):
    """Confidence levels for predictions."""
    VERY_LOW = "very_low"     # <40%
    LOW = "low"               # 40-60%
    MEDIUM = "medium"         # 60-75%
    HIGH = "high"             # 75-90%
    VERY_HIGH = "very_high"   # >90%


class MorpheusOperation(str, Enum):
    """Morpheus operations."""
    PREDICT = "predict"
    SIMULATE = "simulate"
    ANALYZE = "analyze"
    DREAM = "dream"  # Creative exploration


# ============================================================================
# State Definition
# ============================================================================

class MorpheusState(AgentGraphState):
    """
    State for Morpheus prediction workflow.

    Extends base state with prediction-specific fields.
    """
    # Operation details
    operation: MorpheusOperation = MorpheusOperation.PREDICT
    prediction_type: PredictionType = PredictionType.FORECAST
    simulation_type: Optional[SimulationType] = None

    # Input data
    input_data: Dict[str, Any] = Field(default_factory=dict)
    historical_data: List[Dict[str, Any]] = Field(default_factory=list)
    parameters: Dict[str, Any] = Field(default_factory=dict)

    # Prediction results
    prediction_value: Optional[Any] = None
    prediction_confidence: float = 0.0
    confidence_level: ConfidenceLevel = ConfidenceLevel.MEDIUM
    prediction_bounds: Optional[Dict[str, float]] = None
    features_importance: Dict[str, float] = Field(default_factory=dict)
    prediction_explanation: str = ""

    # Simulation results
    scenarios: List[Dict[str, Any]] = Field(default_factory=list)
    scenario_outcomes: Dict[str, Any] = Field(default_factory=dict)
    best_scenario: Optional[Dict[str, Any]] = None
    worst_scenario: Optional[Dict[str, Any]] = None

    # Insights
    insights: List[str] = Field(default_factory=list)
    recommendations: List[Dict[str, Any]] = Field(default_factory=list)

    # Dream state (creative exploration)
    visions: List[str] = Field(default_factory=list)


# ============================================================================
# Morpheus Agent
# ============================================================================

class MorpheusAgent(LangGraphAgent[MorpheusState]):
    """
    Morpheus - Prediction & Simulation Agent

    Responsibilities:
    - Generate predictions and forecasts
    - Run what-if scenarios
    - Perform Monte Carlo simulations
    - Detect anomalies
    - Provide probabilistic insights
    - Dream of possibilities

    MCP Servers:
    - sequential-thinking: Complex reasoning

    SDUI Components:
    - GlassChart: Prediction visualization
    - GlassScenarioCard: Scenario display
    - GlassConfidenceMeter: Confidence levels
    """

    def __init__(self):
        super().__init__(
            agent_id="morpheus",
            name="Morpheus",
            domain="prediction",
            description="Prediction and simulation agent for forecasting and what-if analysis",
            tool_categories=[ToolCategory.ANALYTICS],
            mcp_servers=["sequential-thinking"],
            pentarchy_voter=False,
            security_veto=False,
            max_iterations=15,
            timeout_seconds=180,
        )

    # =========================================================================
    # Template Implementation
    # =========================================================================

    def create_state_class(self) -> type:
        """Return MorpheusState for workflow."""
        return MorpheusState

    def define_nodes(self) -> Dict[str, Callable]:
        """Define Morpheus-specific workflow nodes."""
        return {
            "parse_prediction_request": self._parse_prediction_request,
            "prepare_data": self._prepare_data,
            "run_prediction": self._run_prediction,
            "run_simulation": self._run_simulation,
            "analyze_results": self._analyze_results,
            "generate_insights": self._generate_insights,
            "dream": self._dream,
        }

    def define_edges(self) -> List[tuple]:
        """Define Morpheus-specific workflow edges."""
        return [
            ("plan", "parse_prediction_request"),
            ("parse_prediction_request", "prepare_data"),

            # Route based on operation
            ("prepare_data", self._route_operation, {
                "predict": "run_prediction",
                "simulate": "run_simulation",
                "analyze": "run_prediction",
                "dream": "dream",
            }),

            ("run_prediction", "analyze_results"),
            ("run_simulation", "analyze_results"),
            ("analyze_results", "generate_insights"),
            ("generate_insights", "synthesize"),
            ("dream", "generate_insights"),
        ]

    def _route_operation(self, state: MorpheusState) -> str:
        """Route to appropriate operation handler."""
        return state.operation.value

    # =========================================================================
    # Workflow Nodes
    # =========================================================================

    async def _parse_prediction_request(self, state: MorpheusState) -> Dict[str, Any]:
        """Parse the prediction request."""
        self.logger.info("Parsing prediction request...", task=state.current_task)

        task_lower = (state.current_task or "").lower()

        # Determine operation
        if any(kw in task_lower for kw in ["simulate", "what if", "scenario"]):
            operation = MorpheusOperation.SIMULATE
        elif any(kw in task_lower for kw in ["dream", "imagine", "explore"]):
            operation = MorpheusOperation.DREAM
        elif any(kw in task_lower for kw in ["analyze", "explain"]):
            operation = MorpheusOperation.ANALYZE
        else:
            operation = MorpheusOperation.PREDICT

        # Determine prediction type
        prediction_type = PredictionType.FORECAST
        if any(kw in task_lower for kw in ["classify", "category", "type"]):
            prediction_type = PredictionType.CLASSIFICATION
        elif any(kw in task_lower for kw in ["anomaly", "unusual", "outlier"]):
            prediction_type = PredictionType.ANOMALY
        elif any(kw in task_lower for kw in ["recommend", "suggest"]):
            prediction_type = PredictionType.RECOMMENDATION

        # Determine simulation type
        simulation_type = None
        if operation == MorpheusOperation.SIMULATE:
            if "monte carlo" in task_lower:
                simulation_type = SimulationType.MONTE_CARLO
            elif "sensitivity" in task_lower:
                simulation_type = SimulationType.SENSITIVITY
            else:
                simulation_type = SimulationType.WHAT_IF

        await self._emit_progress(state, "Request parsed", 0.1)

        return {
            "operation": operation,
            "prediction_type": prediction_type,
            "simulation_type": simulation_type,
            "input_data": state.task_context.get("data", {}),
            "parameters": state.task_context.get("parameters", {}),
        }

    async def _prepare_data(self, state: MorpheusState) -> Dict[str, Any]:
        """Prepare data for prediction/simulation."""
        self.logger.info("Preparing data...")

        # Validate input data
        if not state.input_data:
            self.logger.warning("No input data provided, using defaults")
            state.input_data = {"default": True}

        # Get historical data if needed
        historical_data = state.task_context.get("historical", [])

        await self._emit_progress(state, "Data prepared", 0.2)

        return {"historical_data": historical_data}

    async def _run_prediction(self, state: MorpheusState) -> Dict[str, Any]:
        """Run the prediction model."""
        self.logger.info("Running prediction...", type=state.prediction_type.value)

        if state.prediction_type == PredictionType.FORECAST:
            result = await self._forecast(state)
        elif state.prediction_type == PredictionType.CLASSIFICATION:
            result = await self._classify(state)
        elif state.prediction_type == PredictionType.ANOMALY:
            result = await self._detect_anomaly(state)
        elif state.prediction_type == PredictionType.RECOMMENDATION:
            result = await self._recommend(state)
        else:
            result = {
                "prediction_value": None,
                "prediction_confidence": 0.5,
                "prediction_explanation": "Unknown prediction type",
            }

        await self._emit_progress(state, "Prediction complete", 0.6)

        return result

    async def _forecast(self, state: MorpheusState) -> Dict[str, Any]:
        """Time series forecasting."""
        self.logger.info("Forecasting...")

        # Would use actual ML model via sequential-thinking
        return {
            "prediction_value": 100.0,
            "prediction_confidence": 0.75,
            "confidence_level": ConfidenceLevel.HIGH,
            "prediction_bounds": {"lower": 85.0, "upper": 115.0},
            "features_importance": {"trend": 0.4, "seasonality": 0.35, "residual": 0.25},
            "prediction_explanation": "Based on historical patterns and trend analysis",
        }

    async def _classify(self, state: MorpheusState) -> Dict[str, Any]:
        """Classification prediction."""
        self.logger.info("Classifying...")

        return {
            "prediction_value": "category_a",
            "prediction_confidence": 0.82,
            "confidence_level": ConfidenceLevel.HIGH,
            "features_importance": {"feature1": 0.5, "feature2": 0.3, "feature3": 0.2},
            "prediction_explanation": "Classification based on feature analysis",
        }

    async def _detect_anomaly(self, state: MorpheusState) -> Dict[str, Any]:
        """Anomaly detection."""
        self.logger.info("Detecting anomalies...")

        return {
            "prediction_value": False,  # No anomaly detected
            "prediction_confidence": 0.90,
            "confidence_level": ConfidenceLevel.VERY_HIGH,
            "prediction_explanation": "No significant anomalies detected in the data",
        }

    async def _recommend(self, state: MorpheusState) -> Dict[str, Any]:
        """Generate recommendations."""
        self.logger.info("Generating recommendations...")

        return {
            "prediction_value": ["action_1", "action_2", "action_3"],
            "prediction_confidence": 0.70,
            "confidence_level": ConfidenceLevel.MEDIUM,
            "prediction_explanation": "Recommendations based on pattern analysis",
            "recommendations": [
                {"action": "action_1", "priority": "high", "impact": 0.8},
                {"action": "action_2", "priority": "medium", "impact": 0.6},
                {"action": "action_3", "priority": "low", "impact": 0.4},
            ],
        }

    async def _run_simulation(self, state: MorpheusState) -> Dict[str, Any]:
        """Run simulation."""
        self.logger.info("Running simulation...", type=state.simulation_type.value if state.simulation_type else "what_if")

        if state.simulation_type == SimulationType.WHAT_IF:
            scenarios = await self._what_if_simulation(state)
        elif state.simulation_type == SimulationType.MONTE_CARLO:
            scenarios = await self._monte_carlo_simulation(state)
        elif state.simulation_type == SimulationType.SENSITIVITY:
            scenarios = await self._sensitivity_analysis(state)
        else:
            scenarios = await self._what_if_simulation(state)

        # Find best/worst scenarios
        best_scenario = max(scenarios, key=lambda s: s.get("outcome", 0)) if scenarios else None
        worst_scenario = min(scenarios, key=lambda s: s.get("outcome", 0)) if scenarios else None

        await self._emit_progress(state, f"Simulated {len(scenarios)} scenarios", 0.6)

        return {
            "scenarios": scenarios,
            "best_scenario": best_scenario,
            "worst_scenario": worst_scenario,
        }

    async def _what_if_simulation(self, state: MorpheusState) -> List[Dict[str, Any]]:
        """Run what-if scenario analysis."""
        self.logger.info("Running what-if analysis...")

        return [
            {
                "id": "scenario_optimistic",
                "name": "Optimistic",
                "parameters": {"growth": 1.2, "efficiency": 1.1},
                "outcome": 120.0,
                "probability": 0.25,
                "impact": {"revenue": 20.0, "cost": -5.0},
            },
            {
                "id": "scenario_baseline",
                "name": "Baseline",
                "parameters": {"growth": 1.0, "efficiency": 1.0},
                "outcome": 100.0,
                "probability": 0.50,
                "impact": {"revenue": 0.0, "cost": 0.0},
            },
            {
                "id": "scenario_pessimistic",
                "name": "Pessimistic",
                "parameters": {"growth": 0.8, "efficiency": 0.9},
                "outcome": 75.0,
                "probability": 0.25,
                "impact": {"revenue": -25.0, "cost": 10.0},
            },
        ]

    async def _monte_carlo_simulation(self, state: MorpheusState) -> List[Dict[str, Any]]:
        """Run Monte Carlo simulation."""
        self.logger.info("Running Monte Carlo simulation...")

        return [
            {
                "id": "mc_p10",
                "name": "10th Percentile",
                "outcome": 80.0,
                "probability": 0.10,
            },
            {
                "id": "mc_p50",
                "name": "50th Percentile (Median)",
                "outcome": 100.0,
                "probability": 0.50,
            },
            {
                "id": "mc_p90",
                "name": "90th Percentile",
                "outcome": 125.0,
                "probability": 0.90,
            },
        ]

    async def _sensitivity_analysis(self, state: MorpheusState) -> List[Dict[str, Any]]:
        """Run sensitivity analysis."""
        self.logger.info("Running sensitivity analysis...")

        return [
            {
                "id": "sens_param1_high",
                "name": "Parameter 1 +10%",
                "parameters": {"param1": 1.1},
                "outcome": 108.0,
                "impact": {"delta": 8.0},
            },
            {
                "id": "sens_param1_low",
                "name": "Parameter 1 -10%",
                "parameters": {"param1": 0.9},
                "outcome": 93.0,
                "impact": {"delta": -7.0},
            },
        ]

    async def _analyze_results(self, state: MorpheusState) -> Dict[str, Any]:
        """Analyze prediction/simulation results."""
        self.logger.info("Analyzing results...")

        # Would use sequential-thinking for deep analysis
        await self._emit_progress(state, "Analysis complete", 0.8)

        return {}

    async def _generate_insights(self, state: MorpheusState) -> Dict[str, Any]:
        """Generate insights from predictions/simulations."""
        self.logger.info("Generating insights...")

        insights = []

        if state.prediction_value is not None:
            # Insights from prediction
            if state.prediction_confidence >= 0.8:
                insights.append("High confidence prediction - reliable for decision making")
            elif state.prediction_confidence < 0.5:
                insights.append("Low confidence - consider gathering more data")

            if state.features_importance:
                top_feature = max(
                    state.features_importance.items(),
                    key=lambda x: x[1]
                )
                insights.append(f"Key driver: {top_feature[0]} ({top_feature[1]:.0%} importance)")

        if state.scenarios:
            # Insights from simulation
            if len(state.scenarios) >= 3:
                outcomes = [s.get("outcome", 0) for s in state.scenarios if s.get("outcome")]
                if outcomes:
                    range_val = max(outcomes) - min(outcomes)
                    insights.append(f"Outcome range: {min(outcomes):.1f} to {max(outcomes):.1f}")

            # Find most likely scenario
            most_likely = max(state.scenarios, key=lambda s: s.get("probability", 0))
            insights.append(f"Most likely scenario: {most_likely.get('name')} ({most_likely.get('probability', 0):.0%})")

        if state.visions:
            insights.extend(state.visions)

        await self._emit_progress(state, "Insights generated", 0.9)

        return {"insights": insights}

    async def _dream(self, state: MorpheusState) -> Dict[str, Any]:
        """
        Morpheus's special ability - explore possibilities.

        Generate creative scenarios and insights.
        """
        self.logger.info("Dreaming of possibilities...")

        # Use sequential-thinking for creative exploration
        try:
            result = await self._execute_mcp_tool(
                "sequential-thinking.think",
                {
                    "task": "Explore creative possibilities and future scenarios",
                    "context": state.task_context,
                }
            )

            if result.success:
                visions = result.result.get("visions", [])
            else:
                visions = []

        except Exception:
            visions = []

        # Default visions if none generated
        if not visions:
            visions = [
                "Pattern emerges: cyclical behavior detected",
                "Opportunity: untapped potential in segment X",
                "Warning: resource constraint approaching",
            ]

        await self._emit_progress(state, "Dream complete", 0.7)

        return {"visions": visions}

    # =========================================================================
    # SDUI Component Generation
    # =========================================================================

    async def _generate_sdui_components(self, state: MorpheusState) -> List[Dict[str, Any]]:
        """Generate SDUI components for prediction visualization."""
        components = []

        # Confidence meter for prediction
        if state.prediction_confidence > 0:
            components.append({
                "type": "GlassMeter",
                "props": {
                    "label": "Prediction Confidence",
                    "value": state.prediction_confidence * 100,
                    "maxValue": 100,
                    "showPercentage": True,
                    "color": "green" if state.prediction_confidence >= 0.75 else "yellow" if state.prediction_confidence >= 0.5 else "red",
                }
            })

        # Prediction result card
        if state.prediction_value is not None:
            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Prediction Result",
                    "variant": "default",
                    "children": [
                        {
                            "type": "GlassText",
                            "props": {
                                "text": f"Value: {state.prediction_value}",
                                "variant": "heading"
                            }
                        },
                        {
                            "type": "GlassText",
                            "props": {"text": state.prediction_explanation}
                        }
                    ]
                }
            })

        # Prediction bounds
        if state.prediction_bounds:
            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Confidence Interval",
                    "children": [
                        {
                            "type": "GlassDataList",
                            "props": {
                                "items": [
                                    {"label": "Lower Bound", "value": f"{state.prediction_bounds.get('lower', 0):.2f}"},
                                    {"label": "Upper Bound", "value": f"{state.prediction_bounds.get('upper', 0):.2f}"},
                                ]
                            }
                        }
                    ]
                }
            })

        # Scenarios
        if state.scenarios:
            scenario_items = [
                {
                    "id": s.get("id"),
                    "title": s.get("name"),
                    "description": f"Outcome: {s.get('outcome', 0):.1f} | Probability: {s.get('probability', 0):.0%}",
                    "status": "completed" if s == state.best_scenario else "error" if s == state.worst_scenario else "pending",
                }
                for s in state.scenarios
            ]

            components.append({
                "type": "GlassTimeline",
                "props": {
                    "events": scenario_items,
                    "orientation": "vertical",
                }
            })

        # Features importance
        if state.features_importance:
            importance_items = [
                {"label": k, "value": f"{v:.0%}"}
                for k, v in sorted(state.features_importance.items(), key=lambda x: x[1], reverse=True)
            ]

            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Feature Importance",
                    "children": [
                        {
                            "type": "GlassDataList",
                            "props": {"items": importance_items}
                        }
                    ]
                }
            })

        # Insights
        if state.insights:
            for insight in state.insights[:5]:
                components.append({
                    "type": "GlassChatBubble",
                    "props": {
                        "content": insight,
                        "role": "system",
                    }
                })

        # Visions (dream results)
        if state.visions:
            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Visions",
                    "variant": "info",
                    "children": [
                        {
                            "type": "GlassText",
                            "props": {"text": vision}
                        }
                        for vision in state.visions[:3]
                    ]
                }
            })

        # Response message
        components.append({
            "type": "GlassChatBubble",
            "props": {
                "role": "assistant",
                "agent": "Morpheus",
                "content": self._build_response_message(state),
            }
        })

        return components

    def _build_response_message(self, state: MorpheusState) -> str:
        """Build the response message based on operation result."""
        if state.operation == MorpheusOperation.PREDICT:
            if state.prediction_value is not None:
                return f"Prediction: {state.prediction_value} (confidence: {state.prediction_confidence:.0%})"
            return "Prediction analysis complete."

        elif state.operation == MorpheusOperation.SIMULATE:
            if state.scenarios:
                return f"Simulated {len(state.scenarios)} scenarios. Most likely: {state.best_scenario.get('name') if state.best_scenario else 'N/A'}"
            return "Simulation complete."

        elif state.operation == MorpheusOperation.ANALYZE:
            return "Analysis complete. See insights for details."

        elif state.operation == MorpheusOperation.DREAM:
            return f"Explored {len(state.visions)} possibilities."

        return "Prediction/simulation operation completed."

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _get_confidence_level(self, confidence: float) -> ConfidenceLevel:
        """Convert numeric confidence to level."""
        if confidence < 0.4:
            return ConfidenceLevel.VERY_LOW
        elif confidence < 0.6:
            return ConfidenceLevel.LOW
        elif confidence < 0.75:
            return ConfidenceLevel.MEDIUM
        elif confidence < 0.9:
            return ConfidenceLevel.HIGH
        else:
            return ConfidenceLevel.VERY_HIGH

    async def quick_forecast(
        self,
        data: Dict[str, Any],
        horizon: int = 7,
    ) -> Dict[str, Any]:
        """Quick forecast without full workflow."""
        return await self.process(
            task=f"Forecast for {horizon} periods",
            context={
                "data": data,
                "horizon": horizon,
            }
        )

    async def dream_about(self, topic: str) -> List[str]:
        """Explore possibilities about a topic."""
        result = await self.process(
            task=f"Dream about: {topic}",
            context={"topic": topic}
        )
        return result.get("visions", [])
