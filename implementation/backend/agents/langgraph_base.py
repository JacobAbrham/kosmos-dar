"""
KOSMOS V2.0 LangGraph Base Template

Enhanced base class for LangGraph-powered agents with:
- State persistence (checkpointing)
- Human-in-the-loop (HITL) support
- Semantic router integration
- SDUI response generation
- Tool selection via Global Tool Registry
- Streaming support
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import (
    Any, Dict, List, Optional, Callable, Set, Tuple,
    TypeVar, Generic, Literal, Annotated, Sequence, Union
)
from uuid import UUID, uuid4
import asyncio
import json

import structlog
from pydantic import BaseModel, Field
from langchain_core.messages import (
    BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
)
from langgraph.graph import StateGraph, END, START
from langgraph.graph.message import add_messages
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import ToolNode, tools_condition

from core.config import settings
from core.messaging import AgentBus
from core.tool_registry import (
    GlobalToolRegistry, ToolCategory, MCPTool, ToolCallResult, get_tool_registry
)
from core.circuit_breaker import CircuitBreakerRegistry, CircuitState
from core.semantic_router import SemanticRouter, RoutingResult, RoutingContext
from core.intent_router import IntentRouter, IntentResolution, get_intent_router

logger = structlog.get_logger()


# ============================================================================
# State Types
# ============================================================================

class WorkflowPhase(str, Enum):
    """Workflow execution phases."""
    PLANNING = "planning"
    EXECUTING = "executing"
    REVIEWING = "reviewing"
    AWAITING_INPUT = "awaiting_input"
    COMPLETED = "completed"
    FAILED = "failed"


class HumanInputType(str, Enum):
    """Types of human input requests."""
    APPROVAL = "approval"          # Yes/No decision
    SELECTION = "selection"        # Choose from options
    TEXT_INPUT = "text_input"      # Free-form text
    CONFIRMATION = "confirmation"  # Confirm action
    CLARIFICATION = "clarification"  # Clarify intent


@dataclass
class HumanInputRequest:
    """Request for human input during workflow."""
    id: str
    type: HumanInputType
    prompt: str
    options: Optional[List[str]] = None
    context: Dict[str, Any] = field(default_factory=dict)
    timeout_seconds: int = 300
    required: bool = True
    default: Optional[str] = None


@dataclass
class HumanInputResponse:
    """Response from human input."""
    request_id: str
    value: Any
    timestamp: datetime = field(default_factory=datetime.utcnow)
    skipped: bool = False


@dataclass
class ToolSelection:
    """Selected tool for execution."""
    tool_path: str
    tool_name: str
    server: str
    params: Dict[str, Any]
    reason: str
    confidence: float


@dataclass
class ExecutionStep:
    """A single execution step in the workflow."""
    id: str
    name: str
    description: str
    tool_selection: Optional[ToolSelection] = None
    status: str = "pending"  # pending, running, completed, failed, skipped
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @property
    def duration_ms(self) -> Optional[float]:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds() * 1000
        return None


class AgentGraphState(BaseModel):
    """
    Base state for LangGraph agent workflows.

    This state is passed through all nodes and checkpointed.
    Agents should extend this with domain-specific fields.
    """
    # Core identifiers
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    trace_id: Optional[str] = None
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None

    # Messages (with LangGraph reducer for proper handling)
    messages: Annotated[List[BaseMessage], add_messages] = Field(default_factory=list)

    # Current task
    current_task: Optional[str] = None
    task_context: Dict[str, Any] = Field(default_factory=dict)

    # Intent routing
    intent_id: Optional[str] = None
    intent_confidence: float = 0.0
    target_agent: Optional[str] = None
    routing_method: Optional[str] = None

    # Execution planning
    phase: WorkflowPhase = WorkflowPhase.PLANNING
    execution_plan: List[Dict[str, Any]] = Field(default_factory=list)
    current_step: int = 0
    steps_completed: List[str] = Field(default_factory=list)
    steps_failed: List[str] = Field(default_factory=list)

    # Tool selection
    available_tools: List[Dict[str, Any]] = Field(default_factory=list)
    selected_tools: List[Dict[str, Any]] = Field(default_factory=list)
    tool_results: Dict[str, Any] = Field(default_factory=dict)

    # Human-in-the-loop
    requires_human_input: bool = False
    human_input_request: Optional[Dict[str, Any]] = None
    human_input_response: Optional[Dict[str, Any]] = None
    human_inputs_log: List[Dict[str, Any]] = Field(default_factory=list)

    # Governance
    requires_governance: bool = False
    governance_proposal_id: Optional[str] = None
    governance_approved: Optional[bool] = None
    governance_reason: Optional[str] = None

    # Cost tracking
    estimated_cost: float = 0.0
    actual_cost: float = 0.0
    token_usage: Dict[str, int] = Field(default_factory=dict)

    # Results
    final_result: Optional[Any] = None
    final_response: Optional[str] = None
    error: Optional[str] = None

    # Metadata
    iteration: int = 0
    max_iterations: int = 10
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # SDUI rendering hints
    suggested_layout: Optional[str] = None
    ui_components: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True


# ============================================================================
# Checkpointer Configuration
# ============================================================================

class PostgresCheckpointSaver(BaseCheckpointSaver):
    """
    PostgreSQL-backed checkpoint saver for state persistence.

    Uses the workflow_checkpoints table for durable storage.
    """

    def __init__(self, pool):
        self.pool = pool

    async def aget(self, config: Dict) -> Optional[Dict]:
        """Get checkpoint from database."""
        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            return None

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT checkpoint_data, parent_id, created_at
                FROM workflow_checkpoints
                WHERE thread_id = $1
                ORDER BY created_at DESC
                LIMIT 1
                """,
                thread_id
            )

            if row:
                return {
                    "v": 1,
                    "ts": row["created_at"].isoformat(),
                    "channel_values": json.loads(row["checkpoint_data"]),
                    "parent_id": row["parent_id"]
                }

        return None

    async def aput(self, config: Dict, checkpoint: Dict) -> Dict:
        """Save checkpoint to database."""
        thread_id = config.get("configurable", {}).get("thread_id")
        checkpoint_id = str(uuid4())

        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO workflow_checkpoints (
                    id, thread_id, checkpoint_data, parent_id, metadata
                ) VALUES ($1, $2, $3, $4, $5)
                """,
                checkpoint_id,
                thread_id,
                json.dumps(checkpoint.get("channel_values", {})),
                checkpoint.get("parent_id"),
                json.dumps({"ts": checkpoint.get("ts")})
            )

        return {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_id": checkpoint_id
            }
        }

    def get(self, config: Dict) -> Optional[Dict]:
        """Sync version - wraps async."""
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self.aget(config))

    def put(self, config: Dict, checkpoint: Dict) -> Dict:
        """Sync version - wraps async."""
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self.aput(config, checkpoint))


def get_checkpointer(use_postgres: bool = False, pool=None) -> BaseCheckpointSaver:
    """Get appropriate checkpointer based on configuration."""
    if use_postgres and pool:
        return PostgresCheckpointSaver(pool)
    return MemorySaver()


# ============================================================================
# LangGraph Enhanced Base Agent
# ============================================================================

StateT = TypeVar("StateT", bound=AgentGraphState)


class LangGraphAgent(ABC, Generic[StateT]):
    """
    Enhanced base class for LangGraph-powered agents.

    Features:
    - Automatic state checkpointing
    - Human-in-the-loop support with async callbacks
    - Semantic router integration for tool selection
    - SDUI component generation
    - Streaming execution with progress updates

    Subclasses must implement:
    - create_state_class(): Return the custom state class
    - define_nodes(): Define workflow nodes
    - define_edges(): Define workflow edges and conditionals
    """

    # Class-level shared instances
    _intent_router: Optional[IntentRouter] = None
    _checkpointer: Optional[BaseCheckpointSaver] = None

    def __init__(
        self,
        agent_id: str,
        name: str,
        domain: str,
        description: str,
        tool_categories: Optional[List[ToolCategory]] = None,
        mcp_servers: Optional[List[str]] = None,
        pentarchy_voter: bool = False,
        security_veto: bool = False,
        max_iterations: int = 10,
        timeout_seconds: int = 120,
    ):
        self.agent_id = agent_id
        self.name = name
        self.domain = domain
        self.description = description
        self.tool_categories = tool_categories or []
        self.mcp_servers = mcp_servers or []
        self.pentarchy_voter = pentarchy_voter
        self.security_veto = security_veto
        self.max_iterations = max_iterations
        self.timeout_seconds = timeout_seconds

        # Components
        self.bus: Optional[AgentBus] = None
        self._graph = None
        self._available_tools: Dict[str, MCPTool] = {}

        # Callbacks for HITL and streaming
        self._human_input_callback: Optional[Callable] = None
        self._progress_callback: Optional[Callable] = None
        self._sdui_callback: Optional[Callable] = None

        self.logger = logger.bind(agent_id=agent_id, agent_name=name)

    # =========================================================================
    # Initialization
    # =========================================================================

    async def initialize(self) -> None:
        """Initialize the agent and build the graph."""
        self.logger.info("Initializing LangGraph agent...")

        try:
            # Initialize intent router
            await self._ensure_router_initialized()

            # Initialize message bus
            self.bus = AgentBus(self.agent_id)

            # Discover available tools
            await self._discover_tools()

            # Build the workflow graph
            self._graph = await self._build_workflow()

            self.logger.info(
                "LangGraph agent initialized",
                tools_available=len(self._available_tools)
            )

        except Exception as e:
            self.logger.error("Failed to initialize agent", error=str(e))
            raise

    @classmethod
    async def _ensure_router_initialized(cls) -> IntentRouter:
        """Ensure intent router is initialized (singleton)."""
        if cls._intent_router is None:
            cls._intent_router = await get_intent_router()
            cls._checkpointer = get_checkpointer()
            logger.info("Intent router initialized for LangGraph agents")
        return cls._intent_router

    async def _discover_tools(self) -> None:
        """Discover available MCP tools for this agent."""
        if not self._intent_router:
            return

        # Get tools by category
        for category in self.tool_categories:
            tools = self._intent_router.get_tools_by_category(category)
            for tool in tools:
                self._available_tools[tool.path] = tool

        # Get tools by server
        for server in self.mcp_servers:
            tools = self._intent_router.get_tools_by_server(server)
            for tool in tools:
                if tool.path not in self._available_tools:
                    self._available_tools[tool.path] = tool

        self.logger.info(f"Discovered {len(self._available_tools)} tools")

    # =========================================================================
    # Graph Construction (Template Pattern)
    # =========================================================================

    async def _build_workflow(self) -> Any:
        """Build the LangGraph workflow with checkpointing."""
        # Get state class
        state_class = self.create_state_class()

        # Create workflow builder
        workflow = StateGraph(state_class)

        # Add common nodes
        workflow.add_node("plan", self._plan_node)
        workflow.add_node("select_tools", self._select_tools_node)
        workflow.add_node("execute_step", self._execute_step_node)
        workflow.add_node("check_human_input", self._check_human_input_node)
        workflow.add_node("await_human_input", self._await_human_input_node)
        workflow.add_node("check_governance", self._check_governance_node)
        workflow.add_node("await_governance", self._await_governance_node)
        workflow.add_node("synthesize", self._synthesize_node)
        workflow.add_node("handle_error", self._handle_error_node)

        # Add custom nodes from subclass
        custom_nodes = self.define_nodes()
        for node_name, node_func in custom_nodes.items():
            workflow.add_node(node_name, node_func)

        # Set entry point
        workflow.set_entry_point("plan")

        # Add common edges
        workflow.add_edge("plan", "select_tools")
        workflow.add_edge("select_tools", "check_governance")

        workflow.add_conditional_edges(
            "check_governance",
            self._needs_governance_condition,
            {
                True: "await_governance",
                False: "execute_step"
            }
        )

        workflow.add_conditional_edges(
            "await_governance",
            self._governance_approved_condition,
            {
                True: "execute_step",
                False: "handle_error"
            }
        )

        workflow.add_conditional_edges(
            "execute_step",
            self._after_execute_condition,
            {
                "continue": "check_human_input",
                "complete": "synthesize",
                "error": "handle_error"
            }
        )

        workflow.add_conditional_edges(
            "check_human_input",
            self._needs_human_input_condition,
            {
                True: "await_human_input",
                False: "execute_step"
            }
        )

        workflow.add_edge("await_human_input", "execute_step")
        workflow.add_edge("synthesize", END)
        workflow.add_edge("handle_error", END)

        # Add custom edges from subclass
        custom_edges = self.define_edges()
        for edge in custom_edges:
            if len(edge) == 2:
                workflow.add_edge(edge[0], edge[1])
            elif len(edge) == 4:
                # Conditional edge: (source, condition_fn, mapping, fallback)
                workflow.add_conditional_edges(edge[0], edge[1], edge[2])

        # Compile with checkpointing
        return workflow.compile(checkpointer=self._checkpointer)

    @abstractmethod
    def create_state_class(self) -> type:
        """Return the state class for this agent's workflow."""
        pass

    def define_nodes(self) -> Dict[str, Callable]:
        """
        Define custom nodes for this agent.

        Override in subclass to add domain-specific nodes.
        Return dict of {node_name: node_function}
        """
        return {}

    def define_edges(self) -> List[Tuple]:
        """
        Define custom edges for this agent.

        Override in subclass to add domain-specific edges.
        Return list of edges as tuples:
        - Simple edge: (source, target)
        - Conditional: (source, condition_fn, {result: target})
        """
        return []

    # =========================================================================
    # Common Workflow Nodes
    # =========================================================================

    async def _plan_node(self, state: StateT) -> Dict[str, Any]:
        """Plan the execution steps based on the task."""
        self.logger.info("Planning execution...", task=state.current_task)

        # Route the intent
        if self._intent_router and state.current_task:
            context = RoutingContext(
                session_id=state.session_id,
                user_id=state.user_id,
                tenant_id=state.tenant_id
            )

            resolution = await self._intent_router.resolve_intent(
                state.current_task, context
            )

            # Update state with routing info
            state.intent_id = resolution.routing_result.matched_intent_id
            state.intent_confidence = resolution.routing_result.confidence
            state.target_agent = resolution.agent_id
            state.routing_method = resolution.routing_result.method.value

            # Get recommended tools
            state.available_tools = [
                {
                    "path": t.path,
                    "name": t.name,
                    "description": t.description,
                    "server": t.server,
                    "category": t.category.value if t.category else None
                }
                for t in resolution.recommended_tools[:10]
            ]

            # Set suggested layout for SDUI
            state.suggested_layout = resolution.routing_result.metadata.get(
                "suggested_layout", "chat"
            )

        # Create execution plan (subclasses can override)
        execution_plan = await self._create_execution_plan(state)
        state.execution_plan = execution_plan
        state.phase = WorkflowPhase.EXECUTING

        await self._emit_progress(state, "Planning complete", 0.1)

        return {"execution_plan": execution_plan, "phase": state.phase}

    async def _create_execution_plan(self, state: StateT) -> List[Dict[str, Any]]:
        """
        Create execution plan for the task.

        Override in subclass for domain-specific planning.
        """
        return [
            {
                "id": "step_1",
                "name": "analyze",
                "description": "Analyze the request",
                "requires_tool": False
            },
            {
                "id": "step_2",
                "name": "execute",
                "description": "Execute the main action",
                "requires_tool": True
            },
            {
                "id": "step_3",
                "name": "verify",
                "description": "Verify the result",
                "requires_tool": False
            }
        ]

    async def _select_tools_node(self, state: StateT) -> Dict[str, Any]:
        """Select appropriate tools for execution steps."""
        self.logger.info("Selecting tools...")

        selected_tools = []

        for step in state.execution_plan:
            if step.get("requires_tool"):
                # Find best matching tool
                tool = await self._find_best_tool(state, step)
                if tool:
                    selected_tools.append({
                        "step_id": step["id"],
                        "tool_path": tool["path"],
                        "tool_name": tool["name"],
                        "reason": f"Best match for {step['name']}"
                    })

        state.selected_tools = selected_tools

        return {"selected_tools": selected_tools}

    async def _find_best_tool(
        self, state: StateT, step: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Find the best tool for an execution step."""
        if not state.available_tools:
            return None

        # Simple matching by step name in tool description
        step_name = step.get("name", "").lower()

        for tool in state.available_tools:
            if step_name in tool.get("description", "").lower():
                return tool

        # Return first available tool as fallback
        return state.available_tools[0] if state.available_tools else None

    async def _execute_step_node(self, state: StateT) -> Dict[str, Any]:
        """Execute the current step."""
        if state.current_step >= len(state.execution_plan):
            return {"phase": WorkflowPhase.COMPLETED}

        step = state.execution_plan[state.current_step]
        self.logger.info(f"Executing step {step['id']}: {step['name']}")

        try:
            # Find tool for this step
            tool_selection = next(
                (t for t in state.selected_tools if t["step_id"] == step["id"]),
                None
            )

            if tool_selection:
                # Execute via MCP
                result = await self._execute_mcp_tool(
                    tool_selection["tool_path"],
                    step.get("params", {})
                )
                state.tool_results[step["id"]] = result
            else:
                # Execute step logic directly
                result = await self._execute_step_logic(state, step)
                state.tool_results[step["id"]] = result

            state.steps_completed.append(step["id"])
            state.current_step += 1

            progress = (state.current_step / len(state.execution_plan)) * 0.8 + 0.1
            await self._emit_progress(state, f"Completed {step['name']}", progress)

        except Exception as e:
            self.logger.error(f"Step failed: {e}")
            state.steps_failed.append(step["id"])
            state.error = str(e)
            return {"phase": WorkflowPhase.FAILED, "error": str(e)}

        return {
            "current_step": state.current_step,
            "steps_completed": state.steps_completed,
            "tool_results": state.tool_results
        }

    async def _execute_step_logic(
        self, state: StateT, step: Dict[str, Any]
    ) -> Any:
        """
        Execute step logic when no tool is available.

        Override in subclass for domain-specific step execution.
        """
        return {"step": step["id"], "status": "completed"}

    async def _execute_mcp_tool(
        self, tool_path: str, params: Dict[str, Any]
    ) -> ToolCallResult:
        """Execute an MCP tool via intent router."""
        if not self._intent_router:
            raise RuntimeError("Intent router not initialized")

        return await self._intent_router.execute_tool(
            tool_path, params, timeout=self.timeout_seconds
        )

    async def _check_human_input_node(self, state: StateT) -> Dict[str, Any]:
        """Check if human input is needed before continuing."""
        # Default: no human input needed
        # Subclasses can override to add HITL checkpoints
        return {"requires_human_input": False}

    async def _await_human_input_node(self, state: StateT) -> Dict[str, Any]:
        """Wait for and process human input."""
        if not state.human_input_request:
            return {}

        self.logger.info("Awaiting human input...", request_type=state.human_input_request.get("type"))

        state.phase = WorkflowPhase.AWAITING_INPUT

        # Invoke callback if registered
        if self._human_input_callback:
            response = await self._human_input_callback(state.human_input_request)
            state.human_input_response = response
            state.human_inputs_log.append({
                "request": state.human_input_request,
                "response": response,
                "timestamp": datetime.utcnow().isoformat()
            })
        else:
            # Default: auto-approve with default value
            state.human_input_response = {
                "value": state.human_input_request.get("default"),
                "auto_approved": True
            }

        state.requires_human_input = False
        state.phase = WorkflowPhase.EXECUTING

        return {
            "human_input_response": state.human_input_response,
            "phase": state.phase
        }

    async def _check_governance_node(self, state: StateT) -> Dict[str, Any]:
        """Check if governance approval is needed."""
        requires_governance = False

        # Check cost threshold
        if state.estimated_cost > settings.cost_auto_approve_max:
            requires_governance = True

        # Check for high-risk keywords
        if state.current_task:
            high_risk = ["delete", "remove", "production", "financial", "security"]
            if any(kw in state.current_task.lower() for kw in high_risk):
                requires_governance = True

        return {"requires_governance": requires_governance}

    async def _await_governance_node(self, state: StateT) -> Dict[str, Any]:
        """Request and wait for governance approval."""
        self.logger.info("Requesting governance approval...")

        if self.bus:
            try:
                result = await self.bus.request_vote(
                    proposal={
                        "type": "task_execution",
                        "task": state.current_task,
                        "estimated_cost": state.estimated_cost,
                        "agent": self.agent_id,
                        "tools": [t["tool_path"] for t in state.selected_tools]
                    },
                    timeout=settings.pentarchy_vote_timeout_seconds
                )

                return {
                    "governance_approved": result.get("approved", False),
                    "governance_reason": result.get("reason")
                }

            except Exception as e:
                self.logger.error("Governance request failed", error=str(e))
                return {
                    "governance_approved": False,
                    "governance_reason": f"Request failed: {e}"
                }

        # Default: auto-approve if no bus
        return {"governance_approved": True}

    async def _synthesize_node(self, state: StateT) -> Dict[str, Any]:
        """Synthesize final response from execution results."""
        self.logger.info("Synthesizing response...")

        state.phase = WorkflowPhase.COMPLETED

        # Combine results
        results_summary = []
        for step_id, result in state.tool_results.items():
            if isinstance(result, ToolCallResult):
                results_summary.append(f"{step_id}: {result.result if result.success else result.error}")
            else:
                results_summary.append(f"{step_id}: {result}")

        final_response = "\n".join(results_summary) if results_summary else "Task completed."

        # Generate SDUI components
        ui_components = await self._generate_sdui_components(state)

        await self._emit_progress(state, "Complete", 1.0)

        return {
            "final_response": final_response,
            "final_result": state.tool_results,
            "ui_components": ui_components,
            "phase": state.phase
        }

    async def _generate_sdui_components(self, state: StateT) -> List[Dict[str, Any]]:
        """
        Generate SDUI components for the response.

        Override in subclass for domain-specific UI generation.
        """
        return [
            {
                "type": "message",
                "props": {
                    "role": "assistant",
                    "content": state.final_response or "Done"
                }
            }
        ]

    async def _handle_error_node(self, state: StateT) -> Dict[str, Any]:
        """Handle workflow errors."""
        self.logger.error("Handling error", error=state.error)

        state.phase = WorkflowPhase.FAILED

        return {
            "final_response": f"Error: {state.error}",
            "phase": state.phase
        }

    # =========================================================================
    # Conditional Edge Functions
    # =========================================================================

    def _needs_governance_condition(self, state: StateT) -> bool:
        """Check if governance is required."""
        return state.requires_governance

    def _governance_approved_condition(self, state: StateT) -> bool:
        """Check if governance was approved."""
        return state.governance_approved is True

    def _needs_human_input_condition(self, state: StateT) -> bool:
        """Check if human input is needed."""
        return state.requires_human_input

    def _after_execute_condition(self, state: StateT) -> Literal["continue", "complete", "error"]:
        """Determine next action after executing a step."""
        if state.error:
            return "error"
        if state.current_step >= len(state.execution_plan):
            return "complete"
        return "continue"

    # =========================================================================
    # Execution Interface
    # =========================================================================

    async def process(
        self,
        task: str,
        context: Optional[Dict[str, Any]] = None,
        thread_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process a task through the workflow.

        Args:
            task: The task description
            context: Optional context (user_id, tenant_id, etc.)
            thread_id: Optional thread ID for resuming checkpointed state

        Returns:
            Final state as dictionary
        """
        if not self._graph:
            raise RuntimeError("Agent not initialized. Call initialize() first.")

        context = context or {}

        # Create initial state
        initial_state = {
            "current_task": task,
            "task_context": context,
            "session_id": thread_id or str(uuid4()),
            "user_id": context.get("user_id"),
            "tenant_id": context.get("tenant_id"),
            "trace_id": context.get("trace_id"),
            "max_iterations": self.max_iterations,
            "messages": [HumanMessage(content=task)]
        }

        # Run with checkpointing
        config = {"configurable": {"thread_id": thread_id or initial_state["session_id"]}}

        try:
            final_state = await self._graph.ainvoke(initial_state, config=config)
            return dict(final_state)

        except Exception as e:
            self.logger.error("Workflow execution failed", error=str(e))
            return {
                "error": str(e),
                "phase": WorkflowPhase.FAILED.value
            }

    async def resume(
        self,
        thread_id: str,
        human_input: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Resume a checkpointed workflow.

        Args:
            thread_id: The thread ID to resume
            human_input: Optional human input to inject

        Returns:
            Final state as dictionary
        """
        if not self._graph:
            raise RuntimeError("Agent not initialized")

        config = {"configurable": {"thread_id": thread_id}}

        # Get current state
        current_state = await self._graph.aget_state(config)

        if not current_state:
            raise ValueError(f"No checkpoint found for thread: {thread_id}")

        # Inject human input if provided
        if human_input and current_state.values.get("requires_human_input"):
            current_state.values["human_input_response"] = human_input
            current_state.values["requires_human_input"] = False

        # Continue execution
        final_state = await self._graph.ainvoke(
            current_state.values, config=config
        )

        return dict(final_state)

    async def stream(
        self,
        task: str,
        context: Optional[Dict[str, Any]] = None,
    ):
        """
        Stream workflow execution with progress updates.

        Yields progress events as the workflow executes.
        """
        if not self._graph:
            raise RuntimeError("Agent not initialized")

        context = context or {}
        thread_id = str(uuid4())

        initial_state = {
            "current_task": task,
            "task_context": context,
            "session_id": thread_id,
            "messages": [HumanMessage(content=task)]
        }

        config = {"configurable": {"thread_id": thread_id}}

        async for event in self._graph.astream_events(
            initial_state, config=config, version="v1"
        ):
            yield event

    # =========================================================================
    # Callbacks and Helpers
    # =========================================================================

    def set_human_input_callback(self, callback: Callable) -> None:
        """Set callback for human-in-the-loop requests."""
        self._human_input_callback = callback

    def set_progress_callback(self, callback: Callable) -> None:
        """Set callback for progress updates."""
        self._progress_callback = callback

    def set_sdui_callback(self, callback: Callable) -> None:
        """Set callback for SDUI component updates."""
        self._sdui_callback = callback

    async def _emit_progress(
        self, state: StateT, message: str, progress: float
    ) -> None:
        """Emit progress update to callback."""
        if self._progress_callback:
            await self._progress_callback({
                "session_id": state.session_id,
                "message": message,
                "progress": progress,
                "phase": state.phase.value,
                "step": state.current_step,
                "total_steps": len(state.execution_plan)
            })

    def get_available_tools(self) -> List[Dict[str, Any]]:
        """Get list of available tools for this agent."""
        return [
            {
                "path": tool.path,
                "name": tool.name,
                "description": tool.description,
                "server": tool.server,
                "category": tool.category.value if tool.category else None,
                "schema": tool.input_schema
            }
            for tool in self._available_tools.values()
        ]

    def get_status(self) -> Dict[str, Any]:
        """Get agent status."""
        return {
            "id": self.agent_id,
            "name": self.name,
            "domain": self.domain,
            "initialized": self._graph is not None,
            "tools_available": len(self._available_tools),
            "pentarchy_voter": self.pentarchy_voter,
            "security_veto": self.security_veto
        }

    async def shutdown(self) -> None:
        """Shutdown the agent."""
        self.logger.info("Shutting down agent...")
        self._available_tools.clear()
        if self.bus:
            await self.bus.close()
        self.logger.info("Agent shutdown complete")


# ============================================================================
# Human-in-the-Loop Utilities
# ============================================================================

def require_approval(
    prompt: str,
    context: Optional[Dict[str, Any]] = None,
    timeout: int = 300
) -> HumanInputRequest:
    """Create an approval request for human-in-the-loop."""
    return HumanInputRequest(
        id=str(uuid4()),
        type=HumanInputType.APPROVAL,
        prompt=prompt,
        options=["Approve", "Deny"],
        context=context or {},
        timeout_seconds=timeout,
        required=True
    )


def require_selection(
    prompt: str,
    options: List[str],
    context: Optional[Dict[str, Any]] = None,
    timeout: int = 300
) -> HumanInputRequest:
    """Create a selection request for human-in-the-loop."""
    return HumanInputRequest(
        id=str(uuid4()),
        type=HumanInputType.SELECTION,
        prompt=prompt,
        options=options,
        context=context or {},
        timeout_seconds=timeout,
        required=True
    )


def require_confirmation(
    action: str,
    details: Dict[str, Any],
    timeout: int = 120
) -> HumanInputRequest:
    """Create a confirmation request for high-stakes actions."""
    return HumanInputRequest(
        id=str(uuid4()),
        type=HumanInputType.CONFIRMATION,
        prompt=f"Please confirm: {action}",
        context={"action": action, "details": details},
        timeout_seconds=timeout,
        required=True,
        default="cancel"
    )
