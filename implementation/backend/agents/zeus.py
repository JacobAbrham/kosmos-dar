"""
KOSMOS V2.0 Zeus Agent - Master Orchestrator (LangGraph Enhanced)

Zeus is the primary orchestrator that receives all user requests
and coordinates work across the other 10 agents using:
- Semantic intent routing
- Multi-agent delegation with parallel execution
- SDUI response generation
- Governance integration for high-stakes decisions
"""

from typing import Any, Dict, List, Optional, Literal, Annotated
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import asyncio

import structlog
from pydantic import BaseModel, Field
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END, START
from langgraph.graph.message import add_messages

from .langgraph_base import (
    LangGraphAgent,
    AgentGraphState,
    WorkflowPhase,
    HumanInputRequest,
    HumanInputType,
    require_approval,
    require_confirmation,
)
from core.config import settings
from core.tool_registry import ToolCategory
from core.semantic_router import RoutingContext

logger = structlog.get_logger()


# ============================================================================
# Zeus State
# ============================================================================

class TaskComplexity(str, Enum):
    """Task complexity levels for routing decisions."""
    SIMPLE = "simple"          # Single agent can handle
    MODERATE = "moderate"      # 2-3 agents needed
    COMPLEX = "complex"        # Multiple agents + parallel execution
    CRITICAL = "critical"      # Pentarchy vote required


class DelegationStatus(str, Enum):
    """Status of agent delegation."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class AgentDelegation:
    """Represents a delegation to another agent."""
    agent_id: str
    agent_name: str
    task: str
    status: DelegationStatus = DelegationStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    latency_ms: Optional[float] = None


class ZeusState(AgentGraphState):
    """
    Enhanced state for Zeus orchestration workflow.

    Extends AgentGraphState with orchestrator-specific fields.
    """
    # Task analysis
    task_complexity: TaskComplexity = TaskComplexity.SIMPLE
    primary_intent: Optional[str] = None
    secondary_intents: List[str] = Field(default_factory=list)

    # Agent routing
    agent_routing_plan: List[Dict[str, Any]] = Field(default_factory=list)
    delegated_agents: List[str] = Field(default_factory=list)
    agent_responses: Dict[str, Any] = Field(default_factory=dict)
    parallel_execution: bool = False

    # Aggregation
    response_aggregation_mode: str = "synthesis"  # synthesis, list, first
    synthesized_response: Optional[str] = None

    # SDUI
    response_layout: str = "chat"
    response_components: List[Dict[str, Any]] = Field(default_factory=list)

    # Metrics
    delegation_count: int = 0
    successful_delegations: int = 0
    failed_delegations: int = 0


# ============================================================================
# Zeus Agent (LangGraph Enhanced)
# ============================================================================

class ZeusAgent(LangGraphAgent[ZeusState]):
    """
    Zeus - Master Orchestrator Agent (LangGraph Enhanced)

    Responsibilities:
    - Receive and analyze all user requests
    - Semantic intent routing via SemanticRouter
    - Determine task complexity and required agents
    - Parallel/sequential multi-agent coordination
    - Response synthesis with SDUI layout generation
    - Pentarchy governance for high-stakes decisions

    Graph Workflow:
    1. analyze_intent -> Semantic routing and complexity assessment
    2. plan_delegation -> Determine which agents to involve
    3. check_governance -> Governance check for critical tasks
    4. execute_parallel/sequential -> Delegate to agents
    5. aggregate_responses -> Combine agent outputs
    6. generate_sdui -> Create SDUI response components
    7. synthesize -> Final response synthesis
    """

    # Agent routing by domain
    DOMAIN_AGENTS = {
        "data": ("hermes", "Data Integration"),
        "security": ("aegis", "Security & Compliance"),
        "scheduling": ("chronos", "Calendar & Time"),
        "analysis": ("athena", "Analytics & Strategy"),
        "development": ("hephaestus", "Development & DevOps"),
        "finance": ("nur_prometheus", "Finance & Cost"),
        "communication": ("iris", "Communication & Messaging"),
        "memory": ("memorix", "Memory & Knowledge"),
        "operations": ("hestia", "Operations & Infrastructure"),
        "prediction": ("morpheus", "Prediction & Forecasting"),
    }

    # Intent to domain mapping
    INTENT_DOMAIN_MAP = {
        "email": "communication",
        "slack": "communication",
        "message": "communication",
        "calendar": "scheduling",
        "schedule": "scheduling",
        "meeting": "scheduling",
        "remind": "scheduling",
        "analyze": "analysis",
        "report": "analysis",
        "metrics": "analysis",
        "dashboard": "analysis",
        "data": "data",
        "query": "data",
        "database": "data",
        "sync": "data",
        "code": "development",
        "deploy": "development",
        "build": "development",
        "github": "development",
        "docker": "development",
        "cost": "finance",
        "budget": "finance",
        "invoice": "finance",
        "payment": "finance",
        "security": "security",
        "permission": "security",
        "audit": "security",
        "remember": "memory",
        "recall": "memory",
        "context": "memory",
        "predict": "prediction",
        "forecast": "prediction",
        "trend": "prediction",
        "health": "operations",
        "status": "operations",
        "monitor": "operations",
    }

    def __init__(self):
        super().__init__(
            agent_id="zeus",
            name="Zeus",
            domain="orchestration",
            description="Master orchestrator coordinating all agent activities",
            tool_categories=[
                ToolCategory.AI_REASONING,
                ToolCategory.SYSTEM
            ],
            mcp_servers=["sequential-thinking", "context7-mcp"],
            pentarchy_voter=False,
            security_veto=False,
            max_iterations=settings.zeus_max_iterations,
            timeout_seconds=settings.zeus_timeout_seconds,
        )

    def create_state_class(self) -> type:
        """Return Zeus state class."""
        return ZeusState

    def define_nodes(self) -> Dict[str, Any]:
        """Define Zeus-specific workflow nodes."""
        return {
            "analyze_intent": self._analyze_intent_node,
            "plan_delegation": self._plan_delegation_node,
            "execute_parallel": self._execute_parallel_node,
            "execute_sequential": self._execute_sequential_node,
            "aggregate_responses": self._aggregate_responses_node,
            "generate_sdui": self._generate_sdui_node,
        }

    def define_edges(self) -> List[tuple]:
        """Define Zeus-specific workflow edges."""
        return []  # Using default edges plus custom routing in _build_workflow override

    async def _build_workflow(self) -> Any:
        """Build Zeus orchestration workflow with custom routing."""
        workflow = StateGraph(ZeusState)

        # Add all nodes
        workflow.add_node("analyze_intent", self._analyze_intent_node)
        workflow.add_node("plan_delegation", self._plan_delegation_node)
        workflow.add_node("check_governance", self._check_governance_node)
        workflow.add_node("await_governance", self._await_governance_node)
        workflow.add_node("request_confirmation", self._request_confirmation_node)
        workflow.add_node("execute_parallel", self._execute_parallel_node)
        workflow.add_node("execute_sequential", self._execute_sequential_node)
        workflow.add_node("aggregate_responses", self._aggregate_responses_node)
        workflow.add_node("generate_sdui", self._generate_sdui_node)
        workflow.add_node("synthesize", self._synthesize_node)
        workflow.add_node("handle_error", self._handle_error_node)

        # Entry point
        workflow.set_entry_point("analyze_intent")

        # Main flow
        workflow.add_edge("analyze_intent", "plan_delegation")
        workflow.add_edge("plan_delegation", "check_governance")

        # Governance branch
        workflow.add_conditional_edges(
            "check_governance",
            self._governance_routing,
            {
                "needs_governance": "await_governance",
                "needs_confirmation": "request_confirmation",
                "proceed": "execute_parallel"
            }
        )

        workflow.add_conditional_edges(
            "await_governance",
            lambda s: "proceed" if s.governance_approved else "denied",
            {
                "proceed": "execute_parallel",
                "denied": "handle_error"
            }
        )

        workflow.add_conditional_edges(
            "request_confirmation",
            lambda s: "proceed" if s.human_input_response and s.human_input_response.get("value") == "confirm" else "cancelled",
            {
                "proceed": "execute_parallel",
                "cancelled": "synthesize"  # Return with cancellation message
            }
        )

        # Execution mode branch
        workflow.add_conditional_edges(
            "execute_parallel",
            lambda s: "parallel" if s.parallel_execution else "sequential",
            {
                "parallel": "aggregate_responses",
                "sequential": "execute_sequential"
            }
        )

        workflow.add_edge("execute_sequential", "aggregate_responses")
        workflow.add_edge("aggregate_responses", "generate_sdui")
        workflow.add_edge("generate_sdui", "synthesize")
        workflow.add_edge("synthesize", END)
        workflow.add_edge("handle_error", END)

        return workflow.compile(checkpointer=self._checkpointer)

    # =========================================================================
    # Workflow Nodes
    # =========================================================================

    async def _analyze_intent_node(self, state: ZeusState) -> Dict[str, Any]:
        """Analyze request intent using semantic router."""
        self.logger.info("Analyzing intent...", task=state.current_task)

        task = state.current_task or ""
        task_lower = task.lower()

        # Use semantic router for intent classification
        if self._intent_router:
            context = RoutingContext(
                session_id=state.session_id,
                user_id=state.user_id,
                tenant_id=state.tenant_id
            )

            resolution = await self._intent_router.resolve_intent(task, context)

            state.intent_id = resolution.routing_result.matched_intent_id
            state.intent_confidence = resolution.routing_result.confidence
            state.primary_intent = resolution.routing_result.matched_intent_name
            state.target_agent = resolution.agent_id

            # Get available tools for the resolved agent
            state.available_tools = [
                {
                    "path": t.path,
                    "name": t.name,
                    "description": t.description,
                    "server": t.server
                }
                for t in resolution.recommended_tools[:10]
            ]

        # Determine domains from keywords
        detected_domains = set()
        for keyword, domain in self.INTENT_DOMAIN_MAP.items():
            if keyword in task_lower:
                detected_domains.add(domain)

        # Determine complexity
        if len(detected_domains) <= 1:
            complexity = TaskComplexity.SIMPLE
        elif len(detected_domains) <= 3:
            complexity = TaskComplexity.MODERATE
        else:
            complexity = TaskComplexity.COMPLEX

        # Check for critical indicators
        critical_keywords = ["delete all", "remove all", "production deploy", "financial transfer", "security override"]
        if any(kw in task_lower for kw in critical_keywords):
            complexity = TaskComplexity.CRITICAL

        # Determine if parallel execution is safe
        parallel_safe = complexity in [TaskComplexity.MODERATE, TaskComplexity.COMPLEX]
        independent_domains = not any(d in task_lower for d in ["then", "after", "before", "first"])

        await self._emit_progress(state, "Intent analyzed", 0.15)

        return {
            "task_complexity": complexity,
            "primary_intent": state.primary_intent,
            "secondary_intents": list(detected_domains),
            "parallel_execution": parallel_safe and independent_domains,
            "intent_id": state.intent_id,
            "intent_confidence": state.intent_confidence
        }

    async def _plan_delegation_node(self, state: ZeusState) -> Dict[str, Any]:
        """Plan which agents to delegate to."""
        self.logger.info("Planning delegation...", complexity=state.task_complexity.value)

        task = state.current_task or ""
        routing_plan = []

        # Determine agents needed
        if state.target_agent and state.target_agent != "zeus":
            # Semantic router already identified target
            agent_info = self.DOMAIN_AGENTS.get(
                state.target_agent,
                (state.target_agent, state.target_agent.title())
            )
            routing_plan.append({
                "agent_id": state.target_agent,
                "agent_name": agent_info[1] if isinstance(agent_info, tuple) else state.target_agent,
                "task": task,
                "priority": 1,
                "reason": f"Primary target from semantic routing (confidence: {state.intent_confidence:.2f})"
            })
        else:
            # Fall back to keyword-based routing
            for domain in state.secondary_intents:
                if domain in self.DOMAIN_AGENTS:
                    agent_id, agent_name = self.DOMAIN_AGENTS[domain]
                    routing_plan.append({
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "task": task,
                        "priority": len(routing_plan) + 1,
                        "reason": f"Domain match: {domain}"
                    })

        # Default to Athena for analysis if no agents matched
        if not routing_plan:
            routing_plan.append({
                "agent_id": "athena",
                "agent_name": "Analytics & Strategy",
                "task": task,
                "priority": 1,
                "reason": "Default fallback for general queries"
            })

        # Estimate cost
        base_cost = 0.01
        multipliers = {
            TaskComplexity.SIMPLE: 1.0,
            TaskComplexity.MODERATE: 2.0,
            TaskComplexity.COMPLEX: 5.0,
            TaskComplexity.CRITICAL: 10.0,
        }
        estimated_cost = base_cost * len(routing_plan) * multipliers.get(state.task_complexity, 1.0)

        await self._emit_progress(state, f"Delegation planned: {len(routing_plan)} agents", 0.25)

        return {
            "agent_routing_plan": routing_plan,
            "delegated_agents": [p["agent_id"] for p in routing_plan],
            "delegation_count": len(routing_plan),
            "estimated_cost": estimated_cost
        }

    async def _check_governance_node(self, state: ZeusState) -> Dict[str, Any]:
        """Check governance and confirmation requirements."""
        self.logger.info("Checking governance...")

        requires_governance = False
        requires_confirmation = False

        # Cost threshold
        if state.estimated_cost > settings.cost_auto_approve_max:
            requires_governance = True

        # Critical complexity
        if state.task_complexity == TaskComplexity.CRITICAL:
            requires_governance = True

        # Moderate confirmation for destructive actions
        if state.current_task:
            destructive_keywords = ["delete", "remove", "reset", "clear"]
            if any(kw in state.current_task.lower() for kw in destructive_keywords):
                if not requires_governance:
                    requires_confirmation = True

        return {
            "requires_governance": requires_governance,
            "requires_human_input": requires_confirmation,
        }

    def _governance_routing(self, state: ZeusState) -> str:
        """Determine governance routing path."""
        if state.requires_governance:
            return "needs_governance"
        if state.requires_human_input:
            return "needs_confirmation"
        return "proceed"

    async def _await_governance_node(self, state: ZeusState) -> Dict[str, Any]:
        """Request Pentarchy governance approval."""
        self.logger.info("Requesting governance approval...")

        if self.bus:
            try:
                result = await self.bus.request_vote(
                    proposal={
                        "type": "task_execution",
                        "task": state.current_task,
                        "estimated_cost": state.estimated_cost,
                        "complexity": state.task_complexity.value,
                        "agents": state.delegated_agents,
                    },
                    timeout=settings.pentarchy_vote_timeout_seconds
                )

                approved = result.get("approved", False)
                reason = result.get("reason", "")

                if not approved:
                    state.error = f"Governance denied: {reason}"

                return {
                    "governance_approved": approved,
                    "governance_reason": reason,
                    "governance_proposal_id": result.get("proposal_id")
                }

            except Exception as e:
                self.logger.error("Governance request failed", error=str(e))
                return {
                    "governance_approved": False,
                    "governance_reason": f"Request failed: {e}",
                    "error": str(e)
                }

        return {"governance_approved": True}

    async def _request_confirmation_node(self, state: ZeusState) -> Dict[str, Any]:
        """Request user confirmation for sensitive actions."""
        self.logger.info("Requesting user confirmation...")

        request = require_confirmation(
            action=f"Execute: {state.current_task}",
            details={
                "agents": state.delegated_agents,
                "estimated_cost": state.estimated_cost,
                "complexity": state.task_complexity.value
            }
        )

        # Store request and wait for callback
        if self._human_input_callback:
            response = await self._human_input_callback({
                "id": request.id,
                "type": request.type.value,
                "prompt": request.prompt,
                "context": request.context
            })
            return {"human_input_response": response}

        # Auto-confirm if no callback
        return {"human_input_response": {"value": "confirm", "auto": True}}

    async def _execute_parallel_node(self, state: ZeusState) -> Dict[str, Any]:
        """Execute agent delegations in parallel."""
        if not state.parallel_execution:
            return {}  # Skip to sequential

        self.logger.info("Executing parallel delegations...", count=len(state.agent_routing_plan))

        # Create tasks for parallel execution
        async def delegate_to_agent(plan: Dict[str, Any]) -> Dict[str, Any]:
            agent_id = plan["agent_id"]
            try:
                if self.bus:
                    response = await self.bus.publish_request(
                        target_agent=agent_id,
                        payload={
                            "task": plan["task"],
                            "context": {
                                "complexity": state.task_complexity.value,
                                "orchestrator": "zeus",
                                "session_id": state.session_id,
                                "other_agents": [a for a in state.delegated_agents if a != agent_id]
                            }
                        },
                        timeout=60.0
                    )
                    return {"agent_id": agent_id, "success": True, "result": response}
            except Exception as e:
                self.logger.warning(f"Delegation to {agent_id} failed", error=str(e))
                return {"agent_id": agent_id, "success": False, "error": str(e)}

        # Execute all in parallel
        tasks = [delegate_to_agent(plan) for plan in state.agent_routing_plan]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        agent_responses = {}
        successful = 0
        failed = 0

        for result in results:
            if isinstance(result, Exception):
                failed += 1
            elif isinstance(result, dict):
                agent_id = result.get("agent_id")
                if result.get("success"):
                    agent_responses[agent_id] = result.get("result")
                    successful += 1
                else:
                    agent_responses[agent_id] = {"error": result.get("error")}
                    failed += 1

        await self._emit_progress(state, f"Parallel execution: {successful}/{len(tasks)} succeeded", 0.6)

        return {
            "agent_responses": agent_responses,
            "successful_delegations": successful,
            "failed_delegations": failed
        }

    async def _execute_sequential_node(self, state: ZeusState) -> Dict[str, Any]:
        """Execute agent delegations sequentially."""
        self.logger.info("Executing sequential delegations...", count=len(state.agent_routing_plan))

        agent_responses = {}
        successful = 0
        failed = 0

        for i, plan in enumerate(state.agent_routing_plan):
            agent_id = plan["agent_id"]

            try:
                if self.bus:
                    response = await self.bus.publish_request(
                        target_agent=agent_id,
                        payload={
                            "task": plan["task"],
                            "context": {
                                "complexity": state.task_complexity.value,
                                "orchestrator": "zeus",
                                "session_id": state.session_id,
                                "previous_results": agent_responses,  # Include previous for chaining
                            }
                        },
                        timeout=60.0
                    )
                    agent_responses[agent_id] = response
                    successful += 1

            except Exception as e:
                self.logger.warning(f"Delegation to {agent_id} failed", error=str(e))
                agent_responses[agent_id] = {"error": str(e)}
                failed += 1

            progress = 0.3 + (i / len(state.agent_routing_plan)) * 0.4
            await self._emit_progress(state, f"Completed {agent_id}", progress)

        return {
            "agent_responses": agent_responses,
            "successful_delegations": successful,
            "failed_delegations": failed
        }

    async def _aggregate_responses_node(self, state: ZeusState) -> Dict[str, Any]:
        """Aggregate responses from all agents."""
        self.logger.info("Aggregating responses...", mode=state.response_aggregation_mode)

        responses = state.agent_responses
        aggregation_mode = state.response_aggregation_mode

        if aggregation_mode == "first":
            # Return first successful response
            for agent_id, response in responses.items():
                if response and not response.get("error"):
                    return {"synthesized_response": str(response.get("result", response))}

        elif aggregation_mode == "list":
            # List all responses
            parts = []
            for agent_id, response in responses.items():
                if response and not response.get("error"):
                    parts.append(f"**{agent_id.title()}**: {response.get('result', response)}")
            return {"synthesized_response": "\n\n".join(parts)}

        else:  # synthesis
            # Combine into coherent narrative
            parts = []
            for agent_id, response in responses.items():
                if response and not response.get("error"):
                    result = response.get("result", response)
                    if isinstance(result, dict):
                        summary = result.get("summary", str(result))
                    else:
                        summary = str(result)
                    parts.append(f"[{agent_id}]: {summary}")

            synthesized = "\n\n".join(parts) if parts else "No agents were able to process this request."
            return {"synthesized_response": synthesized}

    async def _generate_sdui_node(self, state: ZeusState) -> Dict[str, Any]:
        """Generate SDUI components for the response."""
        self.logger.info("Generating SDUI components...")

        components = []

        # Determine layout based on complexity and results
        if state.task_complexity in [TaskComplexity.COMPLEX, TaskComplexity.CRITICAL]:
            layout = "dashboard"
        elif len(state.agent_responses) > 2:
            layout = "split"
        else:
            layout = "chat"

        # Generate components based on responses
        for agent_id, response in state.agent_responses.items():
            if response and not response.get("error"):
                result = response.get("result", response)

                # Determine component type based on content
                if isinstance(result, dict):
                    if "metrics" in result or "stats" in result:
                        components.append({
                            "type": "metric_card",
                            "props": {
                                "title": agent_id.title(),
                                "data": result.get("metrics", result.get("stats", result))
                            }
                        })
                    elif "items" in result or "list" in result:
                        components.append({
                            "type": "data_list",
                            "props": {
                                "title": agent_id.title(),
                                "items": result.get("items", result.get("list", []))
                            }
                        })
                    elif "chart" in result or "series" in result:
                        components.append({
                            "type": "chart",
                            "props": {
                                "title": agent_id.title(),
                                "chartType": result.get("chartType", "line"),
                                "data": result.get("series", result.get("chart", {}))
                            }
                        })
                    else:
                        components.append({
                            "type": "card",
                            "props": {
                                "title": agent_id.title(),
                                "content": result.get("summary", str(result))
                            }
                        })
                else:
                    components.append({
                        "type": "message",
                        "props": {
                            "role": "assistant",
                            "agent": agent_id.title(),
                            "content": str(result)
                        }
                    })

        # Add error components if any
        for agent_id, response in state.agent_responses.items():
            if response and response.get("error"):
                components.append({
                    "type": "alert",
                    "props": {
                        "variant": "error",
                        "title": f"{agent_id.title()} Error",
                        "message": response.get("error")
                    }
                })

        await self._emit_progress(state, "SDUI generated", 0.9)

        return {
            "response_layout": layout,
            "response_components": components,
            "ui_components": components,
            "suggested_layout": layout
        }

    async def _synthesize_node(self, state: ZeusState) -> Dict[str, Any]:
        """Synthesize final response."""
        self.logger.info("Synthesizing final response...")

        state.phase = WorkflowPhase.COMPLETED

        # Build final response
        final_response = state.synthesized_response or "Task completed."

        # Add metadata
        if state.delegation_count > 0:
            final_response += f"\n\n_Coordinated {state.successful_delegations}/{state.delegation_count} agents._"

        if state.failed_delegations > 0:
            final_response += f"\n_({state.failed_delegations} agents encountered errors)_"

        await self._emit_progress(state, "Complete", 1.0)

        return {
            "final_response": final_response,
            "final_result": {
                "response": final_response,
                "agents_used": state.delegated_agents,
                "complexity": state.task_complexity.value,
                "estimated_cost": state.estimated_cost,
                "governance_required": state.requires_governance,
                "layout": state.response_layout,
                "components": state.response_components
            },
            "phase": state.phase
        }

    async def _handle_error_node(self, state: ZeusState) -> Dict[str, Any]:
        """Handle workflow errors."""
        self.logger.error("Handling error", error=state.error)

        state.phase = WorkflowPhase.FAILED

        return {
            "final_response": f"Request could not be completed: {state.error}",
            "final_result": {"error": state.error},
            "phase": state.phase,
            "ui_components": [{
                "type": "alert",
                "props": {
                    "variant": "error",
                    "title": "Error",
                    "message": state.error
                }
            }]
        }

    # =========================================================================
    # Public Interface
    # =========================================================================

    async def orchestrate(
        self,
        query: str,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Main entry point for orchestrating a user request.

        Args:
            query: The user's request
            user_id: Optional user identifier
            tenant_id: Optional tenant identifier
            trace_id: Optional trace ID for distributed tracing

        Returns:
            Orchestration result with response, agents used, and SDUI components
        """
        return await self.process(
            task=query,
            context={
                "user_id": user_id,
                "tenant_id": tenant_id,
                "trace_id": trace_id
            }
        )


# ============================================================================
# Factory Function
# ============================================================================

_zeus_instance: Optional[ZeusAgent] = None


async def get_zeus() -> ZeusAgent:
    """Get the singleton Zeus agent instance."""
    global _zeus_instance
    if _zeus_instance is None:
        _zeus_instance = ZeusAgent()
        await _zeus_instance.initialize()
    return _zeus_instance


async def close_zeus() -> None:
    """Shutdown the Zeus agent."""
    global _zeus_instance
    if _zeus_instance:
        await _zeus_instance.shutdown()
        _zeus_instance = None
