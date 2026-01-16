"""
Agent Service for KOSMOS V2.0

Service layer for agent operations, providing a clean interface
between API routes and agent implementations.
"""

import time
from typing import Any, Dict, List, Optional

from agents.registry import AgentRegistry, get_registry
from core.intent_router import IntentRouter, get_intent_router
from core.tool_registry import GlobalToolRegistry, get_tool_registry
from core.metrics import (
    agent_executions_total,
    agent_execution_duration_seconds,
    agent_executions_failed_total,
)
from services.base import BaseService, ServiceContext

from agents.base import AgentMessage


class AgentService(BaseService):
    """
    Service for agent operations.

    Responsibilities:
    - Agent discovery and listing
    - Agent capability queries
    - Agent execution coordination
    - Agent metrics and statistics
    """

    def __init__(self):
        super().__init__("AgentService")
        self._agent_registry: Optional[AgentRegistry] = None
        self._intent_router: Optional[IntentRouter] = None
        self._tool_registry: Optional[GlobalToolRegistry] = None

    async def initialize(self) -> None:
        """Initialize service dependencies."""
        self._agent_registry = await get_registry()
        self._intent_router = await get_intent_router()
        self._tool_registry = await get_tool_registry()

    async def list_agents(
        self, ctx: ServiceContext, include_stats: bool = False
    ) -> List[Dict[str, Any]]:
        """
        List all available agents.

        Args:
            ctx: Service context
            include_stats: Include statistics in response

        Returns:
            List of agent definitions
        """
        start_time = time.perf_counter()

        try:
            if not self._agent_registry:
                await self.initialize()

            agents = self._agent_registry.list_agents()
            agent_list = []

            for agent_id in agents:
                agent = self._agent_registry.get_agent(agent_id)
                if not agent:
                    continue

                agent_def = {
                    "id": agent.agent_id,
                    "name": agent.name,
                    "domain": agent.domain,
                    "description": agent.description,
                    "tool_categories": [cat.value for cat in agent.tool_categories],
                    "tools_count": len(agent.tools) if hasattr(agent, "tools") else 0,
                }

                if include_stats:
                    agent_def["stats"] = {
                        "requests_total": agent.metrics.requests_total,
                        "requests_success": agent.metrics.requests_success,
                        "requests_failed": agent.metrics.requests_failed,
                        "avg_latency_ms": (
                            agent.metrics.total_latency_ms / agent.metrics.requests_total
                            if agent.metrics.requests_total > 0
                            else 0.0
                        ),
                    }

                agent_list.append(agent_def)

            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)

            return agent_list

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            self.logger.error("Failed to list agents", error=str(e), exc_info=True)
            raise

    async def get_agent(
        self, ctx: ServiceContext, agent_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get agent details by ID.

        Args:
            ctx: Service context
            agent_id: Agent identifier

        Returns:
            Agent definition or None
        """
        start_time = time.perf_counter()

        try:
            if not self._agent_registry:
                await self.initialize()

            agent = self._agent_registry.get_agent(agent_id)
            if not agent:
                return None

            # Get tools for this agent
            tools = []
            if self._tool_registry:
                agent_tools = self._tool_registry.list_tools_by_category(
                    agent.tool_categories
                )
                tools = [
                    {
                        "path": tool.path,
                        "name": tool.name,
                        "server": tool.server,
                        "description": tool.description,
                        "category": tool.category.value,
                    }
                    for tool in agent_tools
                ]

            agent_def = {
                "id": agent.agent_id,
                "name": agent.name,
                "domain": agent.domain,
                "description": agent.description,
                "tool_categories": [cat.value for cat in agent.tool_categories],
                "tools": tools,
                "tools_count": len(tools),
                "stats": {
                    "requests_total": agent.metrics.requests_total,
                    "requests_success": agent.metrics.requests_success,
                    "requests_failed": agent.metrics.requests_failed,
                    "avg_latency_ms": (
                        agent.metrics.total_latency_ms / agent.metrics.requests_total
                        if agent.metrics.requests_total > 0
                        else 0.0
                    ),
                },
            }

            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)

            return agent_def

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            self.logger.error(
                "Failed to get agent", agent_id=agent_id, error=str(e), exc_info=True
            )
            raise

    async def execute_agent(
        self,
        ctx: ServiceContext,
        agent_id: str,
        task: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute an agent with a task.

        Args:
            ctx: Service context
            agent_id: Agent identifier
            task: Task description
            context: Optional context dictionary

        Returns:
            Execution result
        """
        start_time = time.perf_counter()

        try:
            if not self._agent_registry:
                await self.initialize()

            agent = self._agent_registry.get_agent(agent_id)
            if not agent:
                raise ValueError(f"Agent {agent_id} not found")

            # Create agent message
            message = AgentMessage(
                id=str(time.time()),
                from_agent="user",
                to_agent=agent_id,
                payload={
                    "task": task,
                    "context": context or {},
                    **ctx.to_dict(),
                },
            )

            # Execute agent
            result = await agent.process(message)

            latency_ms = (time.perf_counter() - start_time) * 1000
            latency_seconds = latency_ms / 1000.0

            # Emit Prometheus metrics
            agent_executions_total.labels(agent_id=agent_id, status="success").inc()
            agent_execution_duration_seconds.labels(agent_id=agent_id).observe(latency_seconds)

            self._track_request(True, latency_ms)

            return {
                "success": True,
                "agent_id": agent_id,
                "result": result,
                "latency_ms": latency_ms,
            }

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            latency_seconds = latency_ms / 1000.0
            error_type = type(e).__name__

            # Emit Prometheus metrics
            agent_executions_total.labels(agent_id=agent_id, status="failed").inc()
            agent_executions_failed_total.labels(agent_id=agent_id, error_type=error_type).inc()
            agent_execution_duration_seconds.labels(agent_id=agent_id).observe(latency_seconds)

            self._track_request(False, latency_ms)
            self.logger.error(
                "Failed to execute agent",
                agent_id=agent_id,
                error=str(e),
                exc_info=True,
            )
            raise

    async def get_agent_capabilities(
        self, ctx: ServiceContext, agent_id: str
    ) -> Dict[str, Any]:
        """
        Get agent capabilities and supported intents.

        Args:
            ctx: Service context
            agent_id: Agent identifier

        Returns:
            Capabilities dictionary
        """
        start_time = time.perf_counter()

        try:
            if not self._intent_router:
                await self.initialize()

            capabilities = self._intent_router.get_agent_capabilities(agent_id)

            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)

            return {
                "agent_id": agent_id,
                "capabilities": capabilities,
            }

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            self.logger.error(
                "Failed to get agent capabilities",
                agent_id=agent_id,
                error=str(e),
                exc_info=True,
            )
            raise

    async def route_intent(
        self, ctx: ServiceContext, intent: str, context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Route an intent to the appropriate agent.

        Args:
            ctx: Service context
            intent: User intent/query
            context: Optional context

        Returns:
            Routing result with selected agent
        """
        start_time = time.perf_counter()

        try:
            if not self._intent_router:
                await self.initialize()

            result = await self._intent_router.route(intent, context or {})

            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)

            return {
                "intent": intent,
                "selected_agent": result.get("agent"),
                "confidence": result.get("confidence"),
                "reasoning": result.get("reasoning"),
                "alternatives": result.get("alternatives", []),
            }

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            self.logger.error(
                "Failed to route intent", intent=intent, error=str(e), exc_info=True
            )
            raise


# Global service instance
_agent_service: Optional[AgentService] = None


async def get_agent_service() -> AgentService:
    """Get global agent service instance."""
    global _agent_service
    if _agent_service is None:
        _agent_service = AgentService()
        await _agent_service.initialize()
    return _agent_service
