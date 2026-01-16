"""
Agent Workflow Executor

Handles execution of agent workflows with MCP tool integration.
"""

import asyncio
from typing import Any, Dict, List, Optional
from uuid import uuid4

import structlog
from agents.base import AgentMessage
from agents.registry import AgentRegistry, get_registry
from core.tool_registry import GlobalToolRegistry, get_tool_registry
from core.messaging import AgentBus, get_agent_bus

logger = structlog.get_logger()


class AgentWorkflowExecutor:
    """
    Executes agent workflows with MCP tool integration.
    
    Features:
    - Multi-agent coordination
    - MCP tool execution
    - Human-in-the-loop checkpoints
    - Progress tracking
    """

    def __init__(
        self,
        agent_registry: Optional[AgentRegistry] = None,
        tool_registry: Optional[GlobalToolRegistry] = None,
        agent_bus: Optional[AgentBus] = None,
    ):
        self.agent_registry = agent_registry
        self.tool_registry = tool_registry
        self.agent_bus = agent_bus
        self._active_workflows: Dict[str, Dict[str, Any]] = {}

    async def initialize(self):
        """Initialize executor with required services."""
        if not self.agent_registry:
            self.agent_registry = await get_registry()
        if not self.tool_registry:
            self.tool_registry = await get_tool_registry()
        if not self.agent_bus:
            self.agent_bus = await get_agent_bus()

    async def execute_workflow(
        self,
        workflow_id: str,
        initial_message: str,
        tenant_id: str,
        user_id: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute a multi-agent workflow.
        
        Args:
            workflow_id: Unique workflow identifier
            initial_message: Initial user message
            tenant_id: Tenant ID
            user_id: User ID
            context: Optional context dictionary
            
        Returns:
            Workflow execution result
        """
        workflow_state = {
            "workflow_id": workflow_id,
            "status": "running",
            "current_agent": None,
            "steps_completed": [],
            "steps_failed": [],
            "results": {},
            "requires_human_input": False,
            "human_input_pending": None,
        }

        self._active_workflows[workflow_id] = workflow_state

        try:
            # Step 1: Route intent to determine primary agent
            primary_agent_id = await self._route_intent(initial_message)
            workflow_state["current_agent"] = primary_agent_id

            # Step 2: Execute primary agent
            primary_result = await self._execute_agent(
                primary_agent_id,
                initial_message,
                tenant_id,
                user_id,
                context or {},
            )
            workflow_state["results"][primary_agent_id] = primary_result
            workflow_state["steps_completed"].append(f"execute_{primary_agent_id}")

            # Step 3: Check if additional agents are needed
            if primary_result.get("requires_additional_agents"):
                additional_agents = primary_result.get("additional_agents", [])
                for agent_id in additional_agents:
                    agent_result = await self._execute_agent(
                        agent_id,
                        primary_result.get("message", initial_message),
                        tenant_id,
                        user_id,
                        {**context or {}, **primary_result},
                    )
                    workflow_state["results"][agent_id] = agent_result
                    workflow_state["steps_completed"].append(f"execute_{agent_id}")

            # Step 4: Synthesize results
            final_result = await self._synthesize_results(workflow_state)

            workflow_state["status"] = "completed"
            workflow_state["final_result"] = final_result

            return {
                "success": True,
                "workflow_id": workflow_id,
                "result": final_result,
                "steps_completed": workflow_state["steps_completed"],
            }

        except Exception as e:
            logger.error("Workflow execution failed", workflow_id=workflow_id, error=str(e))
            workflow_state["status"] = "failed"
            workflow_state["error"] = str(e)
            raise

        finally:
            # Clean up
            if workflow_id in self._active_workflows:
                del self._active_workflows[workflow_id]

    async def _route_intent(self, message: str) -> str:
        """Route intent to determine primary agent."""
        # Use intent router to determine agent
        from core.intent_router import get_intent_router

        router = await get_intent_router()
        routing_result = await router.route(message)

        return routing_result.get("agent_id", "zeus")  # Default to Zeus

    async def _execute_agent(
        self,
        agent_id: str,
        message: str,
        tenant_id: str,
        user_id: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute an agent with message and context."""
        agent = self.agent_registry.get_agent(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        # Create agent message
        agent_message = AgentMessage(
            id=str(uuid4()),
            from_agent="user",
            to_agent=agent_id,
            payload={
                "message": message,
                "context": context,
                "tenant_id": tenant_id,
                "user_id": user_id,
            },
        )

        # Execute agent
        result = await agent.process(agent_message)

        return {
            "agent_id": agent_id,
            "result": result,
            "requires_additional_agents": result.get("requires_additional_agents", False),
            "additional_agents": result.get("additional_agents", []),
            "message": result.get("response", message),
        }

    async def _synthesize_results(self, workflow_state: Dict[str, Any]) -> Dict[str, Any]:
        """Synthesize results from multiple agents."""
        results = workflow_state.get("results", {})

        # Combine results from all agents
        synthesized = {
            "agents_executed": list(results.keys()),
            "results": results,
            "summary": f"Workflow completed with {len(results)} agent(s)",
        }

        return synthesized

    async def execute_with_mcp_tools(
        self,
        agent_id: str,
        tool_calls: List[Dict[str, Any]],
        tenant_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Execute agent workflow with MCP tool calls.
        
        Args:
            agent_id: Agent identifier
            tool_calls: List of tool calls to execute
            tenant_id: Tenant ID
            user_id: User ID
            
        Returns:
            Execution results
        """
        results = {}

        for tool_call in tool_calls:
            tool_path = tool_call.get("tool_path")
            params = tool_call.get("params", {})

            if not tool_path:
                continue

            try:
                # Execute tool via registry
                result = await self.tool_registry.call_tool(
                    tool_path=tool_path,
                    params=params,
                    tenant_id=tenant_id,
                )

                results[tool_path] = {
                    "success": result.success,
                    "result": result.result,
                    "latency_ms": result.latency_ms,
                }

            except Exception as e:
                logger.error(
                    "Tool execution failed",
                    tool_path=tool_path,
                    error=str(e),
                )
                results[tool_path] = {
                    "success": False,
                    "error": str(e),
                }

        return {
            "agent_id": agent_id,
            "tool_results": results,
            "success": all(r.get("success") for r in results.values()),
        }

    async def request_human_input(
        self,
        workflow_id: str,
        prompt: str,
        options: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Request human input during workflow execution.
        
        Args:
            workflow_id: Workflow identifier
            prompt: Prompt for human
            options: Optional list of options
            
        Returns:
            Human input response
        """
        if workflow_id not in self._active_workflows:
            raise ValueError(f"Workflow {workflow_id} not found")

        workflow_state = self._active_workflows[workflow_id]
        workflow_state["requires_human_input"] = True
        workflow_state["human_input_pending"] = {
            "prompt": prompt,
            "options": options,
        }

        # In real implementation, this would:
        # 1. Emit WebSocket event to frontend
        # 2. Wait for human response
        # 3. Return response

        # For now, return mock response
        return {
            "workflow_id": workflow_id,
            "status": "waiting_for_input",
            "prompt": prompt,
            "options": options,
        }

    async def submit_human_input(
        self,
        workflow_id: str,
        response: str,
    ) -> Dict[str, Any]:
        """
        Submit human input response.
        
        Args:
            workflow_id: Workflow identifier
            response: Human response
            
        Returns:
            Updated workflow state
        """
        if workflow_id not in self._active_workflows:
            raise ValueError(f"Workflow {workflow_id} not found")

        workflow_state = self._active_workflows[workflow_id]
        workflow_state["requires_human_input"] = False
        workflow_state["human_input_response"] = response
        workflow_state["human_input_pending"] = None

        return {
            "workflow_id": workflow_id,
            "status": "resumed",
            "response": response,
        }


# Singleton instance
_executor: Optional[AgentWorkflowExecutor] = None


async def get_workflow_executor() -> AgentWorkflowExecutor:
    """Get singleton workflow executor instance."""
    global _executor
    if _executor is None:
        _executor = AgentWorkflowExecutor()
        await _executor.initialize()
    return _executor
