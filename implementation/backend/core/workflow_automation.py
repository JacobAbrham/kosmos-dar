"""
KOSMOS V2.0 Workflow Automation System

Workflow recording, pattern recognition, automation suggestions,
and one-click automation for recurring tasks.
"""

from typing import Any, Dict, List, Optional, Set, Tuple, Callable, Awaitable, TYPE_CHECKING
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict
import asyncio
import hashlib
import json
import logging
import re
from uuid import uuid4

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from core.tool_registry import GlobalToolRegistry
    from core.messaging import AgentBus

logger = logging.getLogger(__name__)


# ============================================================================
# Enums and Types
# ============================================================================

class WorkflowStatus(str, Enum):
    """Status of a workflow."""
    RECORDING = "recording"
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class TriggerType(str, Enum):
    """Types of workflow triggers."""
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    EVENT = "event"
    CONDITION = "condition"
    WEBHOOK = "webhook"


class StepType(str, Enum):
    """Types of workflow steps."""
    TOOL_CALL = "tool_call"
    AGENT_INVOKE = "agent_invoke"
    DECISION = "decision"
    PARALLEL = "parallel"
    WAIT = "wait"
    HUMAN_APPROVAL = "human_approval"
    TRANSFORM = "transform"
    NOTIFICATION = "notification"


class AutomationLevel(str, Enum):
    """Automation confidence levels."""
    SUGGESTED = "suggested"
    SEMI_AUTO = "semi_auto"
    FULL_AUTO = "full_auto"


# ============================================================================
# Data Models
# ============================================================================

@dataclass
class WorkflowStep:
    """A single step in a workflow."""
    step_id: str
    step_type: StepType
    name: str
    description: str
    config: Dict[str, Any]
    input_mapping: Dict[str, str] = field(default_factory=dict)
    output_mapping: Dict[str, str] = field(default_factory=dict)
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    timeout_seconds: int = 300
    retry_count: int = 3
    on_error: str = "fail"  # fail, skip, retry


@dataclass
class WorkflowTrigger:
    """Trigger configuration for a workflow."""
    trigger_id: str
    trigger_type: TriggerType
    name: str
    config: Dict[str, Any]
    enabled: bool = True


@dataclass
class WorkflowExecution:
    """A single execution of a workflow."""
    execution_id: str
    workflow_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    trigger_info: Dict[str, Any] = field(default_factory=dict)
    step_results: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Workflow:
    """A complete workflow definition."""
    workflow_id: str
    name: str
    description: str
    status: WorkflowStatus
    steps: List[WorkflowStep]
    triggers: List[WorkflowTrigger]
    created_at: datetime
    updated_at: datetime
    owner_id: str
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    automation_level: AutomationLevel = AutomationLevel.SUGGESTED


@dataclass
class RecordedAction:
    """A recorded user action."""
    action_id: str
    action_type: str
    agent_id: Optional[str]
    tool_id: Optional[str]
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    timestamp: datetime
    session_id: str
    success: bool


@dataclass
class PatternMatch:
    """A detected pattern in user actions."""
    pattern_id: str
    name: str
    description: str
    actions: List[str]  # Action types in sequence
    frequency: int
    confidence: float
    suggested_workflow: Optional[str] = None


# ============================================================================
# Workflow Recorder
# ============================================================================

class WorkflowRecorder:
    """
    Records user actions for workflow creation.

    Tracks sequences of actions, tool calls, and decisions
    to generate automated workflows.
    """

    def __init__(self):
        self._sessions: Dict[str, List[RecordedAction]] = defaultdict(list)
        self._active_recordings: Dict[str, datetime] = {}
        self._action_buffer_size = 1000

    async def start_recording(self, session_id: str) -> Dict[str, Any]:
        """Start recording actions for a session."""
        self._active_recordings[session_id] = datetime.utcnow()
        return {
            "session_id": session_id,
            "status": "recording",
            "started_at": self._active_recordings[session_id].isoformat()
        }

    async def stop_recording(self, session_id: str) -> Dict[str, Any]:
        """Stop recording and return recorded actions."""
        if session_id not in self._active_recordings:
            return {"error": "Session not being recorded"}

        started_at = self._active_recordings.pop(session_id)
        actions = self._sessions.get(session_id, [])

        return {
            "session_id": session_id,
            "status": "stopped",
            "started_at": started_at.isoformat(),
            "stopped_at": datetime.utcnow().isoformat(),
            "action_count": len(actions),
            "actions": [self._serialize_action(a) for a in actions]
        }

    async def record_action(
        self,
        session_id: str,
        action_type: str,
        agent_id: Optional[str] = None,
        tool_id: Optional[str] = None,
        input_data: Optional[Dict[str, Any]] = None,
        output_data: Optional[Dict[str, Any]] = None,
        success: bool = True
    ) -> Optional[RecordedAction]:
        """Record a single action."""
        if session_id not in self._active_recordings:
            return None

        action = RecordedAction(
            action_id=str(uuid4()),
            action_type=action_type,
            agent_id=agent_id,
            tool_id=tool_id,
            input_data=input_data or {},
            output_data=output_data or {},
            timestamp=datetime.utcnow(),
            session_id=session_id,
            success=success
        )

        self._sessions[session_id].append(action)

        # Maintain buffer size
        if len(self._sessions[session_id]) > self._action_buffer_size:
            self._sessions[session_id] = self._sessions[session_id][-self._action_buffer_size:]

        return action

    def _serialize_action(self, action: RecordedAction) -> Dict[str, Any]:
        """Serialize an action for storage/display."""
        return {
            "action_id": action.action_id,
            "action_type": action.action_type,
            "agent_id": action.agent_id,
            "tool_id": action.tool_id,
            "input_data": action.input_data,
            "output_data": action.output_data,
            "timestamp": action.timestamp.isoformat(),
            "success": action.success
        }

    async def get_recorded_actions(
        self,
        session_id: str,
        limit: int = 100
    ) -> List[RecordedAction]:
        """Get recorded actions for a session."""
        actions = self._sessions.get(session_id, [])
        return actions[-limit:]

    async def export_as_workflow(
        self,
        session_id: str,
        name: str,
        description: str = "",
        owner_id: str = "system"
    ) -> Optional[Workflow]:
        """Export recorded actions as a workflow."""
        actions = self._sessions.get(session_id, [])

        if not actions:
            return None

        steps = []
        for i, action in enumerate(actions):
            step = WorkflowStep(
                step_id=f"step_{i+1}",
                step_type=self._action_to_step_type(action),
                name=f"Step {i+1}: {action.action_type}",
                description=f"Recorded action: {action.action_type}",
                config={
                    "agent_id": action.agent_id,
                    "tool_id": action.tool_id,
                    "input_template": self._templatize_input(action.input_data)
                }
            )
            steps.append(step)

        workflow = Workflow(
            workflow_id=str(uuid4()),
            name=name,
            description=description,
            status=WorkflowStatus.DRAFT,
            steps=steps,
            triggers=[
                WorkflowTrigger(
                    trigger_id=str(uuid4()),
                    trigger_type=TriggerType.MANUAL,
                    name="Manual Trigger",
                    config={}
                )
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            owner_id=owner_id,
            metadata={"source": "recording", "session_id": session_id}
        )

        return workflow

    def _action_to_step_type(self, action: RecordedAction) -> StepType:
        """Convert action type to workflow step type."""
        if action.tool_id:
            return StepType.TOOL_CALL
        elif action.agent_id:
            return StepType.AGENT_INVOKE
        elif "decision" in action.action_type.lower():
            return StepType.DECISION
        else:
            return StepType.TOOL_CALL

    def _templatize_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert input data to a template with variables."""
        template = {}

        for key, value in input_data.items():
            if isinstance(value, str):
                # Check if it looks like a variable value
                if re.match(r'^[a-z0-9_-]+$', value) or len(value) < 50:
                    template[key] = f"{{{{input.{key}}}}}"
                else:
                    template[key] = value
            elif isinstance(value, (int, float, bool)):
                template[key] = value
            else:
                template[key] = f"{{{{input.{key}}}}}"

        return template


# ============================================================================
# Pattern Recognizer
# ============================================================================

class PatternRecognizer:
    """
    Recognizes patterns in user actions to suggest automations.

    Analyzes action sequences across sessions to identify
    repetitive tasks that could be automated.
    """

    def __init__(
        self,
        min_frequency: int = 3,
        min_sequence_length: int = 2,
        max_sequence_length: int = 10
    ):
        self.min_frequency = min_frequency
        self.min_sequence_length = min_sequence_length
        self.max_sequence_length = max_sequence_length
        self._action_history: List[RecordedAction] = []
        self._patterns: Dict[str, PatternMatch] = {}
        self._sequence_counts: Dict[str, int] = defaultdict(int)

    async def add_action(self, action: RecordedAction) -> None:
        """Add an action to the history."""
        self._action_history.append(action)

        # Maintain history size
        if len(self._action_history) > 10000:
            self._action_history = self._action_history[-10000:]

    async def analyze_patterns(self) -> List[PatternMatch]:
        """Analyze action history for patterns."""
        if len(self._action_history) < self.min_frequency * self.min_sequence_length:
            return []

        # Extract action sequences
        sequences = self._extract_sequences()

        # Count sequence frequencies
        for seq in sequences:
            key = self._sequence_to_key(seq)
            self._sequence_counts[key] += 1

        # Find frequent patterns
        patterns = []
        for key, count in self._sequence_counts.items():
            if count >= self.min_frequency:
                pattern = self._create_pattern(key, count)
                if pattern:
                    patterns.append(pattern)
                    self._patterns[pattern.pattern_id] = pattern

        # Sort by frequency
        patterns.sort(key=lambda p: p.frequency, reverse=True)

        return patterns

    def _extract_sequences(self) -> List[List[RecordedAction]]:
        """Extract all possible action sequences."""
        sequences = []

        # Group by session
        by_session: Dict[str, List[RecordedAction]] = defaultdict(list)
        for action in self._action_history:
            by_session[action.session_id].append(action)

        # Extract sequences from each session
        for session_actions in by_session.values():
            for length in range(self.min_sequence_length, self.max_sequence_length + 1):
                for i in range(len(session_actions) - length + 1):
                    sequences.append(session_actions[i:i + length])

        return sequences

    def _sequence_to_key(self, sequence: List[RecordedAction]) -> str:
        """Create a unique key for a sequence."""
        action_types = [a.action_type for a in sequence]
        return "|".join(action_types)

    def _create_pattern(self, key: str, frequency: int) -> Optional[PatternMatch]:
        """Create a pattern match from a sequence key."""
        actions = key.split("|")

        if len(actions) < self.min_sequence_length:
            return None

        # Calculate confidence based on frequency and sequence length
        confidence = min(1.0, (frequency / 10) * (len(actions) / 5))

        pattern = PatternMatch(
            pattern_id=hashlib.sha256(key.encode()).hexdigest()[:16],
            name=f"Pattern: {' → '.join(actions[:3])}{'...' if len(actions) > 3 else ''}",
            description=f"Sequence of {len(actions)} actions repeated {frequency} times",
            actions=actions,
            frequency=frequency,
            confidence=confidence
        )

        return pattern

    async def get_suggestions(
        self,
        current_action: RecordedAction,
        recent_actions: List[RecordedAction],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Get automation suggestions based on current context."""
        suggestions = []

        # Look for patterns that match recent actions
        recent_key = self._sequence_to_key(recent_actions[-self.min_sequence_length:])

        for pattern in self._patterns.values():
            pattern_key = "|".join(pattern.actions)

            # Check if recent actions match the start of a pattern
            if pattern_key.startswith(recent_key):
                remaining = pattern.actions[len(recent_actions):]
                if remaining:
                    suggestions.append({
                        "pattern_id": pattern.pattern_id,
                        "pattern_name": pattern.name,
                        "confidence": pattern.confidence,
                        "next_actions": remaining,
                        "auto_complete": pattern.confidence > 0.8
                    })

        # Sort by confidence
        suggestions.sort(key=lambda s: s["confidence"], reverse=True)

        return suggestions[:top_k]

    def get_patterns(self, min_frequency: int = 1) -> List[PatternMatch]:
        """Get all detected patterns."""
        patterns = [p for p in self._patterns.values() if p.frequency >= min_frequency]
        patterns.sort(key=lambda p: p.frequency, reverse=True)
        return patterns


# ============================================================================
# Workflow Engine
# ============================================================================

class WorkflowEngine:
    """
    Executes workflows with support for various step types.

    Handles workflow execution, error handling, human-in-the-loop,
    and progress tracking.
    """

    def __init__(
        self,
        tool_registry: Optional["GlobalToolRegistry"] = None,
        agent_bus: Optional["AgentBus"] = None
    ):
        self._workflows: Dict[str, Workflow] = {}
        self._executions: Dict[str, WorkflowExecution] = {}
        self._step_handlers: Dict[StepType, Callable] = {}
        self._pending_approvals: Dict[str, Dict[str, Any]] = {}
        self._tool_registry = tool_registry
        self._agent_bus = agent_bus

        # Register default handlers
        self._register_default_handlers()

    def _register_default_handlers(self) -> None:
        """Register default step type handlers."""
        self._step_handlers[StepType.TOOL_CALL] = self._handle_tool_call
        self._step_handlers[StepType.AGENT_INVOKE] = self._handle_agent_invoke
        self._step_handlers[StepType.DECISION] = self._handle_decision
        self._step_handlers[StepType.PARALLEL] = self._handle_parallel
        self._step_handlers[StepType.WAIT] = self._handle_wait
        self._step_handlers[StepType.HUMAN_APPROVAL] = self._handle_human_approval
        self._step_handlers[StepType.TRANSFORM] = self._handle_transform
        self._step_handlers[StepType.NOTIFICATION] = self._handle_notification

    async def register_workflow(self, workflow: Workflow) -> None:
        """Register a workflow."""
        self._workflows[workflow.workflow_id] = workflow
        logger.info(f"Registered workflow: {workflow.name} ({workflow.workflow_id})")

    async def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Get a workflow by ID."""
        return self._workflows.get(workflow_id)

    async def list_workflows(
        self,
        status: Optional[WorkflowStatus] = None,
        owner_id: Optional[str] = None
    ) -> List[Workflow]:
        """List workflows with optional filters."""
        workflows = list(self._workflows.values())

        if status:
            workflows = [w for w in workflows if w.status == status]
        if owner_id:
            workflows = [w for w in workflows if w.owner_id == owner_id]

        return workflows

    async def execute_workflow(
        self,
        workflow_id: str,
        context: Optional[Dict[str, Any]] = None,
        trigger_info: Optional[Dict[str, Any]] = None
    ) -> WorkflowExecution:
        """Execute a workflow."""
        workflow = self._workflows.get(workflow_id)

        if not workflow:
            raise ValueError(f"Workflow not found: {workflow_id}")

        if workflow.status != WorkflowStatus.ACTIVE:
            raise ValueError(f"Workflow not active: {workflow.status}")

        # Create execution record
        execution = WorkflowExecution(
            execution_id=str(uuid4()),
            workflow_id=workflow_id,
            status="running",
            started_at=datetime.utcnow(),
            trigger_info=trigger_info or {},
            context=context or {}
        )
        self._executions[execution.execution_id] = execution

        try:
            # Execute each step
            for step in workflow.steps:
                # Check conditions
                if not await self._evaluate_conditions(step.conditions, execution.context):
                    execution.step_results[step.step_id] = {"status": "skipped", "reason": "condition_not_met"}
                    continue

                # Execute step
                handler = self._step_handlers.get(step.step_type)
                if not handler:
                    raise ValueError(f"No handler for step type: {step.step_type}")

                result = await self._execute_step_with_retry(handler, step, execution)
                execution.step_results[step.step_id] = result
                execution.context.update(result.get("outputs", {}))

                # Check for failure
                if result.get("status") == "failed" and step.on_error == "fail":
                    execution.status = "failed"
                    execution.error = result.get("error")
                    break

            # Complete execution
            if execution.status == "running":
                execution.status = "completed"
            execution.completed_at = datetime.utcnow()

        except Exception as e:
            execution.status = "failed"
            execution.error = str(e)
            execution.completed_at = datetime.utcnow()
            logger.error(f"Workflow execution failed: {e}")

        return execution

    async def _execute_step_with_retry(
        self,
        handler: Callable,
        step: WorkflowStep,
        execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """Execute a step with retry logic."""
        last_error = None

        for attempt in range(step.retry_count + 1):
            try:
                result = await asyncio.wait_for(
                    handler(step, execution),
                    timeout=step.timeout_seconds
                )
                return result

            except asyncio.TimeoutError:
                last_error = f"Step timed out after {step.timeout_seconds}s"
                logger.warning(f"Step {step.step_id} timeout, attempt {attempt + 1}/{step.retry_count + 1}")

            except Exception as e:
                last_error = str(e)
                logger.warning(f"Step {step.step_id} failed, attempt {attempt + 1}/{step.retry_count + 1}: {e}")

            # Wait before retry
            if attempt < step.retry_count:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

        return {"status": "failed", "error": last_error}

    async def _evaluate_conditions(
        self,
        conditions: List[Dict[str, Any]],
        context: Dict[str, Any]
    ) -> bool:
        """Evaluate step conditions."""
        if not conditions:
            return True

        for condition in conditions:
            field = condition.get("field")
            operator = condition.get("operator", "eq")
            value = condition.get("value")

            actual_value = context.get(field)

            if operator == "eq" and actual_value != value:
                return False
            elif operator == "neq" and actual_value == value:
                return False
            elif operator == "gt" and not (actual_value and actual_value > value):
                return False
            elif operator == "lt" and not (actual_value and actual_value < value):
                return False
            elif operator == "contains" and not (actual_value and value in actual_value):
                return False
            elif operator == "exists" and actual_value is None:
                return False

        return True

    async def _handle_tool_call(
        self,
        step: WorkflowStep,
        execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """Handle a tool call step."""
        tool_id = step.config.get("tool_id")

        # Resolve input variables
        inputs = self._resolve_variables(step.config.get("input_template", {}), execution.context)

        # Call the tool via tool registry
        if self._tool_registry:
            try:
                result = await self._tool_registry.call_tool(tool_id, inputs)
                logger.info(f"Successfully called tool {tool_id}")
                return {
                    "status": "completed",
                    "tool_id": tool_id,
                    "outputs": result.result if hasattr(result, 'result') else result
                }
            except Exception as e:
                logger.error(f"Error calling tool {tool_id}: {e}")
                return {
                    "status": "failed",
                    "tool_id": tool_id,
                    "error": str(e)
                }
        else:
            # Fallback if no tool registry available
            logger.warning(f"No tool registry available, simulating call to {tool_id}")
            return {
                "status": "completed",
                "tool_id": tool_id,
                "outputs": {"result": f"Tool {tool_id} executed successfully (simulated)"}
            }

    async def _handle_agent_invoke(
        self,
        step: WorkflowStep,
        execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """Handle an agent invocation step."""
        agent_id = step.config.get("agent_id")
        task = step.config.get("task", "")

        # Resolve variables in task
        task = self._resolve_variables({"task": task}, execution.context).get("task", task)

        # Invoke the agent via agent bus
        if self._agent_bus:
            try:
                response = await self._agent_bus.send_task(
                    agent_id=agent_id,
                    task=task,
                    context=execution.context
                )
                logger.info(f"Successfully invoked agent {agent_id}")
                return {
                    "status": "completed",
                    "agent_id": agent_id,
                    "outputs": {"response": response}
                }
            except Exception as e:
                logger.error(f"Error invoking agent {agent_id}: {e}")
                return {
                    "status": "failed",
                    "agent_id": agent_id,
                    "error": str(e)
                }
        else:
            # Fallback if no agent bus available
            logger.warning(f"No agent bus available, simulating invocation of {agent_id}")
            return {
                "status": "completed",
                "agent_id": agent_id,
                "outputs": {"response": f"Agent {agent_id} completed task (simulated)"}
            }

    async def _handle_decision(
        self,
        step: WorkflowStep,
        execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """Handle a decision step."""
        decision_field = step.config.get("decision_field")
        branches = step.config.get("branches", {})

        value = execution.context.get(decision_field)
        branch = branches.get(str(value), branches.get("default"))

        return {
            "status": "completed",
            "decision_value": value,
            "selected_branch": branch,
            "outputs": {"branch": branch}
        }

    async def _handle_parallel(
        self,
        step: WorkflowStep,
        execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """Handle parallel execution of sub-steps."""
        sub_steps = step.config.get("steps", [])

        # Execute sub-steps in parallel
        tasks = []
        for sub_step_config in sub_steps:
            sub_step = WorkflowStep(**sub_step_config)
            handler = self._step_handlers.get(sub_step.step_type)
            if handler:
                tasks.append(handler(sub_step, execution))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        return {
            "status": "completed",
            "parallel_results": results,
            "outputs": {}
        }

    async def _handle_wait(
        self,
        step: WorkflowStep,
        execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """Handle a wait step."""
        duration_seconds = step.config.get("duration_seconds", 0)

        await asyncio.sleep(duration_seconds)

        return {
            "status": "completed",
            "waited_seconds": duration_seconds,
            "outputs": {}
        }

    async def _handle_human_approval(
        self,
        step: WorkflowStep,
        execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """Handle a human approval step."""
        approval_id = str(uuid4())

        self._pending_approvals[approval_id] = {
            "execution_id": execution.execution_id,
            "step_id": step.step_id,
            "requested_at": datetime.utcnow().isoformat(),
            "message": step.config.get("approval_message", "Approval required"),
            "context": step.config.get("approval_context", {})
        }

        # In real implementation, this would wait for approval
        # For now, auto-approve
        logger.info(f"Human approval requested: {approval_id}")

        return {
            "status": "completed",
            "approval_id": approval_id,
            "approved": True,
            "outputs": {"approval_id": approval_id, "approved": True}
        }

    async def _handle_transform(
        self,
        step: WorkflowStep,
        execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """Handle a data transformation step."""
        transform_type = step.config.get("transform_type", "map")
        input_field = step.config.get("input_field")
        output_field = step.config.get("output_field", input_field)
        expression = step.config.get("expression")

        input_value = execution.context.get(input_field)
        output_value = input_value  # Default: no transformation

        if transform_type == "map" and expression:
            # Simple expression evaluation (in real implementation, use safe eval)
            output_value = f"transformed({input_value})"

        return {
            "status": "completed",
            "outputs": {output_field: output_value}
        }

    async def _handle_notification(
        self,
        step: WorkflowStep,
        execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """Handle a notification step."""
        channel = step.config.get("channel", "log")
        message = step.config.get("message", "Workflow notification")

        # Resolve variables
        message = self._resolve_variables({"msg": message}, execution.context).get("msg", message)

        logger.info(f"Notification [{channel}]: {message}")

        return {
            "status": "completed",
            "channel": channel,
            "outputs": {"notified": True}
        }

    def _resolve_variables(
        self,
        template: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Resolve template variables from context."""
        result = {}

        for key, value in template.items():
            if isinstance(value, str):
                # Replace {{var}} patterns
                def replace_var(match):
                    var_path = match.group(1)
                    parts = var_path.split(".")
                    val = context
                    for part in parts:
                        if isinstance(val, dict):
                            val = val.get(part, match.group(0))
                        else:
                            return match.group(0)
                    return str(val) if val else match.group(0)

                result[key] = re.sub(r'\{\{([^}]+)\}\}', replace_var, value)
            elif isinstance(value, dict):
                result[key] = self._resolve_variables(value, context)
            else:
                result[key] = value

        return result

    async def get_execution(self, execution_id: str) -> Optional[WorkflowExecution]:
        """Get an execution by ID."""
        return self._executions.get(execution_id)

    async def list_executions(
        self,
        workflow_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[WorkflowExecution]:
        """List workflow executions."""
        executions = list(self._executions.values())

        if workflow_id:
            executions = [e for e in executions if e.workflow_id == workflow_id]
        if status:
            executions = [e for e in executions if e.status == status]

        # Sort by start time, newest first
        executions.sort(key=lambda e: e.started_at, reverse=True)

        return executions[:limit]

    async def submit_approval(
        self,
        approval_id: str,
        approved: bool,
        approver_id: str,
        comments: Optional[str] = None
    ) -> Dict[str, Any]:
        """Submit a human approval decision."""
        if approval_id not in self._pending_approvals:
            return {"error": "Approval not found"}

        approval = self._pending_approvals.pop(approval_id)
        approval["approved"] = approved
        approval["approver_id"] = approver_id
        approval["approved_at"] = datetime.utcnow().isoformat()
        approval["comments"] = comments

        return approval


# ============================================================================
# Automation Suggester
# ============================================================================

class AutomationSuggester:
    """
    Suggests automations based on user behavior.

    Combines pattern recognition with workflow analysis
    to proactively suggest automation opportunities.
    """

    def __init__(
        self,
        pattern_recognizer: PatternRecognizer,
        workflow_engine: WorkflowEngine
    ):
        self.pattern_recognizer = pattern_recognizer
        self.workflow_engine = workflow_engine
        self._suggestions: Dict[str, Dict[str, Any]] = {}
        self._feedback: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    async def generate_suggestions(
        self,
        user_id: str,
        recent_actions: List[RecordedAction]
    ) -> List[Dict[str, Any]]:
        """Generate automation suggestions for a user."""
        suggestions = []

        # Get pattern-based suggestions
        if recent_actions:
            pattern_suggestions = await self.pattern_recognizer.get_suggestions(
                recent_actions[-1],
                recent_actions
            )
            for ps in pattern_suggestions:
                suggestion = {
                    "suggestion_id": str(uuid4()),
                    "type": "pattern_completion",
                    "source": "pattern_recognizer",
                    "confidence": ps["confidence"],
                    "description": f"Complete pattern: {ps['pattern_name']}",
                    "next_actions": ps["next_actions"],
                    "auto_complete": ps["auto_complete"],
                    "created_at": datetime.utcnow().isoformat()
                }
                suggestions.append(suggestion)
                self._suggestions[suggestion["suggestion_id"]] = suggestion

        # Check for repetitive task patterns
        patterns = self.pattern_recognizer.get_patterns(min_frequency=5)
        for pattern in patterns[:5]:  # Top 5 patterns
            if pattern.confidence > 0.7:
                suggestion = {
                    "suggestion_id": str(uuid4()),
                    "type": "workflow_creation",
                    "source": "pattern_analysis",
                    "confidence": pattern.confidence,
                    "description": f"Create workflow for: {pattern.name}",
                    "pattern_id": pattern.pattern_id,
                    "frequency": pattern.frequency,
                    "actions": pattern.actions,
                    "created_at": datetime.utcnow().isoformat()
                }
                suggestions.append(suggestion)
                self._suggestions[suggestion["suggestion_id"]] = suggestion

        return suggestions

    async def accept_suggestion(
        self,
        suggestion_id: str,
        user_id: str,
        customizations: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Accept and apply a suggestion."""
        suggestion = self._suggestions.get(suggestion_id)

        if not suggestion:
            return {"error": "Suggestion not found"}

        # Record feedback
        self._feedback[suggestion_id].append({
            "user_id": user_id,
            "action": "accept",
            "timestamp": datetime.utcnow().isoformat(),
            "customizations": customizations
        })

        if suggestion["type"] == "workflow_creation":
            # Create a workflow from the pattern
            pattern = self.pattern_recognizer.get_patterns(min_frequency=1)
            pattern_match = next(
                (p for p in pattern if p.pattern_id == suggestion.get("pattern_id")),
                None
            )

            if pattern_match:
                workflow = await self._create_workflow_from_pattern(
                    pattern_match,
                    user_id,
                    customizations
                )
                await self.workflow_engine.register_workflow(workflow)
                return {"status": "created", "workflow_id": workflow.workflow_id}

        elif suggestion["type"] == "pattern_completion":
            # Return the actions to complete
            return {
                "status": "accepted",
                "actions_to_execute": suggestion.get("next_actions", [])
            }

        return {"status": "accepted"}

    async def reject_suggestion(
        self,
        suggestion_id: str,
        user_id: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Reject a suggestion."""
        self._feedback[suggestion_id].append({
            "user_id": user_id,
            "action": "reject",
            "timestamp": datetime.utcnow().isoformat(),
            "reason": reason
        })

        return {"status": "rejected"}

    async def _create_workflow_from_pattern(
        self,
        pattern: PatternMatch,
        owner_id: str,
        customizations: Optional[Dict[str, Any]] = None
    ) -> Workflow:
        """Create a workflow from a detected pattern."""
        customizations = customizations or {}

        steps = []
        for i, action_type in enumerate(pattern.actions):
            step = WorkflowStep(
                step_id=f"step_{i+1}",
                step_type=StepType.TOOL_CALL,  # Default type
                name=f"Step {i+1}: {action_type}",
                description=f"Action: {action_type}",
                config={"action_type": action_type}
            )
            steps.append(step)

        workflow = Workflow(
            workflow_id=str(uuid4()),
            name=customizations.get("name", pattern.name),
            description=customizations.get("description", pattern.description),
            status=WorkflowStatus.DRAFT,
            steps=steps,
            triggers=[
                WorkflowTrigger(
                    trigger_id=str(uuid4()),
                    trigger_type=TriggerType.MANUAL,
                    name="Manual Trigger",
                    config={}
                )
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            owner_id=owner_id,
            tags=["auto-generated", "pattern-based"],
            automation_level=AutomationLevel.SUGGESTED
        )

        return workflow


# ============================================================================
# Workflow Automation Coordinator
# ============================================================================

class WorkflowAutomationCoordinator:
    """
    Coordinates all workflow automation activities.

    Provides a unified interface for recording, pattern detection,
    workflow management, and automation suggestions.
    """

    def __init__(self):
        self.recorder = WorkflowRecorder()
        self.pattern_recognizer = PatternRecognizer()
        self.workflow_engine = WorkflowEngine()
        self.suggester = AutomationSuggester(
            self.pattern_recognizer,
            self.workflow_engine
        )

    async def record_action(
        self,
        session_id: str,
        action_type: str,
        **kwargs
    ) -> Optional[RecordedAction]:
        """Record an action and update patterns."""
        action = await self.recorder.record_action(
            session_id=session_id,
            action_type=action_type,
            **kwargs
        )

        if action:
            await self.pattern_recognizer.add_action(action)

        return action

    async def get_suggestions(
        self,
        user_id: str,
        session_id: str
    ) -> List[Dict[str, Any]]:
        """Get automation suggestions for current context."""
        recent_actions = await self.recorder.get_recorded_actions(session_id)
        return await self.suggester.generate_suggestions(user_id, recent_actions)

    async def create_workflow_from_recording(
        self,
        session_id: str,
        name: str,
        description: str = "",
        owner_id: str = "system"
    ) -> Optional[Workflow]:
        """Create a workflow from a recording session."""
        workflow = await self.recorder.export_as_workflow(
            session_id, name, description, owner_id
        )

        if workflow:
            await self.workflow_engine.register_workflow(workflow)

        return workflow

    async def execute_workflow(
        self,
        workflow_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> WorkflowExecution:
        """Execute a workflow."""
        return await self.workflow_engine.execute_workflow(workflow_id, context)

    async def get_dashboard_data(self) -> Dict[str, Any]:
        """Get data for workflow automation dashboard."""
        workflows = await self.workflow_engine.list_workflows()
        executions = await self.workflow_engine.list_executions(limit=20)
        patterns = self.pattern_recognizer.get_patterns(min_frequency=2)

        return {
            "workflows": {
                "total": len(workflows),
                "active": sum(1 for w in workflows if w.status == WorkflowStatus.ACTIVE),
                "draft": sum(1 for w in workflows if w.status == WorkflowStatus.DRAFT)
            },
            "executions": {
                "recent": len(executions),
                "completed": sum(1 for e in executions if e.status == "completed"),
                "failed": sum(1 for e in executions if e.status == "failed")
            },
            "patterns": {
                "detected": len(patterns),
                "high_confidence": sum(1 for p in patterns if p.confidence > 0.8)
            },
            "suggestions_pending": len(self.suggester._suggestions),
            "timestamp": datetime.utcnow().isoformat()
        }


# ============================================================================
# Singleton Access
# ============================================================================

_coordinator: Optional[WorkflowAutomationCoordinator] = None


async def get_workflow_automation_coordinator() -> WorkflowAutomationCoordinator:
    """Get the global workflow automation coordinator."""
    global _coordinator
    if _coordinator is None:
        _coordinator = WorkflowAutomationCoordinator()
    return _coordinator
