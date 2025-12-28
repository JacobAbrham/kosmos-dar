"""
KOSMOS V2.0 Agents Module

All 11 KOSMOS agents and their supporting infrastructure.
"""

from .aegis import AEGISAgent as AegisAgent
from .athena import AthenaAgent
from .base import AgentConfig, AgentMessage, AgentMetrics, AgentState, BaseAgent
from .chronos import ChronosAgent
from .governance import (
    PentarchyGovernor,
    Proposal,
    ProposalStatus,
    ProposalType,
    Vote,
    VoteDecision,
    close_governor,
    get_governor,
)
from .hephaestus import HephaestusAgent
from .hermes import HermesAgent
from .hestia import HestiaAgent
from .iris import IrisAgent
from .memorix import MemorixAgent
from .morpheus import MorpheusAgent
from .nur_prometheus import NurPrometheusAgent
from .registry import (
    AGENT_CLASSES,
    AgentRegistry,
    close_registry,
    get_agent,
    get_registry,
    route_to_agent,
)

# Individual agents
from .zeus import ZeusAgent

__all__ = [
    # Base classes
    "BaseAgent",
    "AgentConfig",
    "AgentMessage",
    "AgentMetrics",
    "AgentState",
    # Registry
    "AgentRegistry",
    "get_registry",
    "close_registry",
    "get_agent",
    "route_to_agent",
    "AGENT_CLASSES",
    # Governance
    "PentarchyGovernor",
    "Proposal",
    "ProposalType",
    "ProposalStatus",
    "Vote",
    "VoteDecision",
    "get_governor",
    "close_governor",
    # Agents
    "ZeusAgent",
    "HermesAgent",
    "AegisAgent",
    "AthenaAgent",
    "ChronosAgent",
    "HephaestusAgent",
    "NurPrometheusAgent",
    "IrisAgent",
    "MemorixAgent",
    "HestiaAgent",
    "MorpheusAgent",
]
