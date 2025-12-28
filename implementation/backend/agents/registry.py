"""
KOSMOS V2.0 Agent Registry

Central registry for managing all KOSMOS agents.
"""

import asyncio
from typing import Any, Dict, List, Optional, Type

import structlog

from .aegis import AEGISAgent as AegisAgent
from .athena import AthenaAgent
from .base import AgentConfig, AgentState, BaseAgent
from .chronos import ChronosAgent
from .governance import PentarchyGovernor, get_governor
from .hephaestus import HephaestusAgent
from .hermes import HermesAgent
from .hestia import HestiaAgent
from .iris import IrisAgent
from .memorix import MemorixAgent
from .morpheus import MorpheusAgent
from .nur_prometheus import NurPrometheusAgent
from .zeus import ZeusAgent

logger = structlog.get_logger()


# Agent class mapping
AGENT_CLASSES: Dict[str, Type[BaseAgent]] = {
    "zeus": ZeusAgent,
    "hermes": HermesAgent,
    "aegis": AegisAgent,
    "athena": AthenaAgent,
    "chronos": ChronosAgent,
    "hephaestus": HephaestusAgent,
    "nur_prometheus": NurPrometheusAgent,
    "iris": IrisAgent,
    "memorix": MemorixAgent,
    "hestia": HestiaAgent,
    "morpheus": MorpheusAgent,
}


class AgentRegistry:
    """
    Central registry for all KOSMOS agents.

    Manages agent lifecycle, discovery, and coordination.
    """

    def __init__(self):
        self.agents: Dict[str, BaseAgent] = {}
        self.governor: Optional[PentarchyGovernor] = None
        self.logger = logger.bind(component="registry")

    async def initialize(self) -> None:
        """Initialize all agents."""
        self.logger.info("Initializing agent registry...")

        # Initialize governance first
        self.governor = await get_governor()

        # Initialize all agents
        init_tasks = []
        for agent_id, agent_class in AGENT_CLASSES.items():
            try:
                agent = agent_class()
                self.agents[agent_id] = agent
                init_tasks.append(self._init_agent(agent))
            except Exception as e:
                self.logger.error(f"Failed to create agent {agent_id}", error=str(e))

        # Wait for all agents to initialize
        await asyncio.gather(*init_tasks, return_exceptions=True)

        self.logger.info("Agent registry initialized", agent_count=len(self.agents))

    async def _init_agent(self, agent: BaseAgent) -> None:
        """Initialize a single agent."""
        try:
            await agent.initialize()
            self.logger.info(f"Agent initialized: {agent.id}")
        except Exception as e:
            self.logger.error(f"Failed to initialize agent {agent.id}", error=str(e))

    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        """Get an agent by ID."""
        return self.agents.get(agent_id)

    def get_all_agents(self) -> List[BaseAgent]:
        """Get all registered agents."""
        return list(self.agents.values())

    def get_agents_by_domain(self, domain: str) -> List[BaseAgent]:
        """Get agents by domain."""
        return [
            agent for agent in self.agents.values() if agent.config.domain == domain
        ]

    def get_pentarchy_voters(self) -> List[BaseAgent]:
        """Get agents that can vote in Pentarchy."""
        return [agent for agent in self.agents.values() if agent.config.pentarchy_voter]

    def get_security_vetors(self) -> List[BaseAgent]:
        """Get agents with security veto power."""
        return [agent for agent in self.agents.values() if agent.config.security_veto]

    def get_agent_status(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific agent."""
        agent = self.agents.get(agent_id)
        if agent:
            return agent.get_status()
        return None

    def get_all_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all agents."""
        return {agent_id: agent.get_status() for agent_id, agent in self.agents.items()}

    def get_healthy_agents(self) -> List[BaseAgent]:
        """Get agents that are in READY state."""
        return [
            agent for agent in self.agents.values() if agent.state == AgentState.READY
        ]

    def get_system_health(self) -> Dict[str, Any]:
        """Get overall system health."""
        total = len(self.agents)
        ready = len(self.get_healthy_agents())

        return {
            "total_agents": total,
            "healthy_agents": ready,
            "health_percent": (ready / total * 100) if total > 0 else 0,
            "agents": {
                agent_id: {
                    "state": agent.state.value,
                    "requests": agent.metrics.requests_total,
                    "success_rate": agent.metrics.success_rate,
                }
                for agent_id, agent in self.agents.items()
            },
        }

    async def route_request(
        self,
        agent_id: str,
        payload: Dict[str, Any],
        context: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Route a request to a specific agent."""
        agent = self.agents.get(agent_id)
        if not agent:
            return {"success": False, "error": f"Agent not found: {agent_id}"}

        if agent.state != AgentState.READY:
            return {"success": False, "error": f"Agent not ready: {agent.state.value}"}

        from .base import AgentMessage

        message = AgentMessage(
            from_agent="registry",
            to_agent=agent_id,
            payload=payload,
            context=context or {},
        )

        return await agent.process(message)

    async def shutdown(self) -> None:
        """Shutdown all agents."""
        self.logger.info("Shutting down agent registry...")

        # Shutdown all agents
        shutdown_tasks = [agent.shutdown() for agent in self.agents.values()]

        await asyncio.gather(*shutdown_tasks, return_exceptions=True)

        # Clear registry
        self.agents.clear()

        self.logger.info("Agent registry shut down")


# Singleton instance
_registry: Optional[AgentRegistry] = None


async def get_registry() -> AgentRegistry:
    """Get the agent registry instance."""
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
        await _registry.initialize()
    return _registry


async def close_registry() -> None:
    """Close the agent registry."""
    global _registry
    if _registry:
        await _registry.shutdown()
        _registry = None


# Convenience functions
async def get_agent(agent_id: str) -> Optional[BaseAgent]:
    """Get an agent by ID."""
    registry = await get_registry()
    return registry.get_agent(agent_id)


async def route_to_agent(
    agent_id: str,
    payload: Dict[str, Any],
    context: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """Route a request to an agent."""
    registry = await get_registry()
    return await registry.route_request(agent_id, payload, context)
