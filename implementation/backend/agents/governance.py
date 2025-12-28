"""
KOSMOS V2.0 Pentarchy Governance System (LangGraph Enhanced)

The Pentarchy is a 3-agent voting system for high-stakes decisions:
- Athena (Analytics): Votes based on strategic value
- Hephaestus (Development): Votes based on technical feasibility
- Nur PROMETHEUS (Finance): Votes based on cost-benefit

AEGIS has security veto power over any decision.

Integrated with:
- Database persistence for proposals and votes
- LangGraph agent voting API
- SDUI component generation
- Async vote collection with timeouts
"""

from typing import Any, Dict, List, Optional, Callable, Awaitable
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from uuid import uuid4
import asyncio
import json

import structlog

from core.config import settings
from core.messaging import GovernanceBus

logger = structlog.get_logger()


class ProposalType(str, Enum):
    """Types of governance proposals."""
    TASK_EXECUTION = "task_execution"           # Execute a high-cost task
    RESOURCE_ALLOCATION = "resource_allocation" # Allocate resources
    CONFIGURATION_CHANGE = "configuration_change"  # Change system config
    EMERGENCY_ACTION = "emergency_action"       # Emergency override
    AGENT_DELEGATION = "agent_delegation"       # Multi-agent task
    DATA_ACCESS = "data_access"                 # Sensitive data access
    EXTERNAL_API = "external_api"               # External API calls


class ProposalStatus(str, Enum):
    """Status of a proposal."""
    PENDING = "pending"
    SECURITY_REVIEW = "security_review"
    VOTING = "voting"
    APPROVED = "approved"
    DENIED = "denied"
    VETOED = "vetoed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class VoteDecision(str, Enum):
    """Vote decision."""
    APPROVE = "approve"
    DENY = "deny"
    ABSTAIN = "abstain"


@dataclass
class Vote:
    """A vote from a Pentarchy member."""
    id: str = field(default_factory=lambda: str(uuid4()))
    agent_id: str = ""
    agent_name: str = ""
    decision: VoteDecision = VoteDecision.ABSTAIN
    confidence: float = 0.0
    score: float = 0.5
    reasons: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "decision": self.decision.value,
            "confidence": self.confidence,
            "score": self.score,
            "reasons": self.reasons,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class SecurityReview:
    """Security review by AEGIS."""
    id: str = field(default_factory=lambda: str(uuid4()))
    veto: bool = False
    reason: Optional[str] = None
    risks: List[str] = field(default_factory=list)
    threat_level: str = "none"
    timestamp: datetime = field(default_factory=datetime.utcnow)
    reviewed_by: str = "aegis"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "veto": self.veto,
            "reason": self.reason,
            "risks": self.risks,
            "threat_level": self.threat_level,
            "timestamp": self.timestamp.isoformat(),
            "reviewed_by": self.reviewed_by
        }


@dataclass
class Proposal:
    """A governance proposal."""
    id: str = field(default_factory=lambda: f"prop_{datetime.utcnow().timestamp()}")
    type: ProposalType = ProposalType.TASK_EXECUTION
    title: str = ""
    description: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)
    requestor_id: str = ""
    requestor_agent: str = ""
    tenant_id: str = ""
    status: ProposalStatus = ProposalStatus.PENDING
    votes: List[Vote] = field(default_factory=list)
    security_review: Optional[SecurityReview] = None
    estimated_cost: float = 0.0
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "title": self.title,
            "description": self.description,
            "payload": self.payload,
            "requestor_id": self.requestor_id,
            "requestor_agent": self.requestor_agent,
            "tenant_id": self.tenant_id,
            "status": self.status.value,
            "votes": [v.to_dict() for v in self.votes],
            "security_review": self.security_review.to_dict() if self.security_review else None,
            "estimated_cost": self.estimated_cost,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "result": self.result,
            "metadata": self.metadata
        }


class PentarchyGovernor:
    """
    Pentarchy Governance Controller (LangGraph Enhanced)

    Manages the voting process for high-stakes decisions with:
    - Async vote collection from LangGraph agents
    - Security veto by AEGIS
    - Database persistence
    - Configurable quorum and thresholds
    - SDUI component generation for voting UI
    """

    # Voting members of the Pentarchy
    VOTING_MEMBERS = {
        "athena": "Analytics & Strategy",
        "hephaestus": "Development & Engineering",
        "nur_prometheus": "Finance & Cost"
    }

    # Default configuration
    DEFAULT_QUORUM = 2          # Minimum votes needed
    DEFAULT_THRESHOLD = 0.5     # Majority needed for approval
    DEFAULT_TIMEOUT = 30.0      # Vote timeout in seconds

    def __init__(self):
        self.bus: Optional[GovernanceBus] = None
        self.active_proposals: Dict[str, Proposal] = {}
        self._agent_vote_handlers: Dict[str, Callable] = {}
        self._aegis_handler: Optional[Callable] = None
        self._db_pool = None
        self.logger = logger.bind(component="pentarchy")

        # Configuration
        self.quorum_size = self.DEFAULT_QUORUM
        self.approval_threshold = self.DEFAULT_THRESHOLD
        self.vote_timeout = self.DEFAULT_TIMEOUT

    async def initialize(self, db_pool=None) -> None:
        """Initialize the governance system."""
        self.logger.info("Initializing Pentarchy governance...")

        self._db_pool = db_pool
        self.bus = GovernanceBus()

        try:
            await self.bus.connect()
        except Exception as e:
            self.logger.warning("Bus connection failed, using direct mode", error=str(e))

        self.logger.info(
            "Pentarchy governance initialized",
            voting_members=list(self.VOTING_MEMBERS.keys()),
            quorum=self.quorum_size,
            threshold=self.approval_threshold
        )

    def register_agent_voter(
        self,
        agent_id: str,
        vote_handler: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]
    ) -> None:
        """
        Register a LangGraph agent's vote handler.

        Args:
            agent_id: The agent ID
            vote_handler: Async function that accepts proposal dict and returns vote dict
        """
        self._agent_vote_handlers[agent_id] = vote_handler
        self.logger.info(f"Registered voter: {agent_id}")

    def register_security_reviewer(
        self,
        handler: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]
    ) -> None:
        """Register AEGIS security review handler."""
        self._aegis_handler = handler
        self.logger.info("Registered AEGIS security reviewer")

    async def submit_proposal(
        self,
        proposal_type: ProposalType,
        title: str,
        description: str,
        payload: Dict[str, Any],
        requestor_id: str,
        tenant_id: str,
        estimated_cost: float = 0.0,
        requestor_agent: str = "",
        expires_in_seconds: int = 300,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Proposal:
        """Submit a new proposal for governance review."""
        proposal = Proposal(
            type=proposal_type,
            title=title,
            description=description,
            payload=payload,
            requestor_id=requestor_id,
            requestor_agent=requestor_agent,
            tenant_id=tenant_id,
            estimated_cost=estimated_cost,
            expires_at=datetime.utcnow() + timedelta(seconds=expires_in_seconds),
            metadata=metadata or {}
        )

        self.active_proposals[proposal.id] = proposal

        # Persist to database
        await self._persist_proposal(proposal)

        self.logger.info(
            "Proposal submitted",
            proposal_id=proposal.id,
            type=proposal_type.value,
            cost=estimated_cost,
            requestor=requestor_agent or requestor_id
        )

        return proposal

    async def request_vote(
        self,
        proposal_id: str,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Request votes from Pentarchy members.

        Returns the final decision after all votes are collected or timeout.
        """
        if timeout is None:
            timeout = self.vote_timeout

        proposal = self.active_proposals.get(proposal_id)
        if not proposal:
            raise ValueError(f"Proposal not found: {proposal_id}")

        # Check if expired
        if proposal.expires_at and datetime.utcnow() > proposal.expires_at:
            proposal.status = ProposalStatus.EXPIRED
            proposal.resolved_at = datetime.utcnow()
            return {"approved": False, "reason": "Proposal expired"}

        self.logger.info(
            "Starting vote process",
            proposal_id=proposal_id,
            timeout=timeout
        )

        # Phase 1: Security review by AEGIS
        proposal.status = ProposalStatus.SECURITY_REVIEW
        security_review = await self._get_security_review(proposal, timeout=timeout / 3)
        proposal.security_review = security_review

        if security_review.veto:
            proposal.status = ProposalStatus.VETOED
            proposal.resolved_at = datetime.utcnow()
            proposal.result = {
                "approved": False,
                "reason": f"Security veto: {security_review.reason}",
                "vetoed_by": "aegis",
                "security_review": security_review.to_dict()
            }

            await self._persist_proposal(proposal)

            self.logger.warning(
                "Proposal vetoed by AEGIS",
                proposal_id=proposal_id,
                reason=security_review.reason,
                risks=security_review.risks
            )

            return proposal.result

        # Phase 2: Collect votes from Pentarchy members
        proposal.status = ProposalStatus.VOTING
        votes = await self._collect_votes(proposal, timeout=timeout * 2 / 3)

        for vote in votes:
            proposal.votes.append(vote)

        # Phase 3: Tally votes and make decision
        result = self._tally_votes(proposal)
        proposal.result = result
        proposal.status = ProposalStatus.APPROVED if result["approved"] else ProposalStatus.DENIED
        proposal.resolved_at = datetime.utcnow()

        # Persist final state
        await self._persist_proposal(proposal)

        self.logger.info(
            "Voting complete",
            proposal_id=proposal_id,
            approved=result["approved"],
            votes_for=result["votes_for"],
            votes_against=result["votes_against"],
            quorum_met=result["quorum_met"]
        )

        return result

    async def quick_vote(
        self,
        proposal: Dict[str, Any],
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Quick vote for inline governance checks.

        Accepts a proposal dict and returns decision without full proposal lifecycle.
        """
        # Create lightweight proposal
        prop = await self.submit_proposal(
            proposal_type=ProposalType(proposal.get("type", "task_execution")),
            title=proposal.get("title", "Quick Vote"),
            description=proposal.get("description", ""),
            payload=proposal,
            requestor_id=proposal.get("requestor_id", "system"),
            tenant_id=proposal.get("tenant_id", "default"),
            estimated_cost=proposal.get("estimated_cost", 0.0),
            requestor_agent=proposal.get("agent", ""),
            expires_in_seconds=int(timeout or self.vote_timeout) * 2,
        )

        result = await self.request_vote(prop.id, timeout=timeout)

        # Clean up inline proposal
        del self.active_proposals[prop.id]

        return result

    async def _get_security_review(
        self,
        proposal: Proposal,
        timeout: float = 10.0
    ) -> SecurityReview:
        """Get security review from AEGIS."""
        self.logger.info("Requesting security review...")

        proposal_dict = {
            "id": proposal.id,
            "type": proposal.type.value,
            "title": proposal.title,
            "task": proposal.description or proposal.title,
            "payload": proposal.payload,
            "estimated_cost": proposal.estimated_cost,
            "tenant_id": proposal.tenant_id
        }

        try:
            # Try direct handler first
            if self._aegis_handler:
                response = await asyncio.wait_for(
                    self._aegis_handler(proposal_dict),
                    timeout=timeout
                )
            elif self.bus:
                response = await self.bus.publish_request(
                    target_agent="aegis",
                    payload={"action": "security_veto", "proposal": proposal_dict},
                    timeout=timeout
                )
            else:
                # Default: no veto
                return SecurityReview(veto=False, threat_level="none")

            return SecurityReview(
                veto=response.get("veto", False),
                reason=response.get("reason"),
                risks=response.get("risks", []),
                threat_level=response.get("threat_level", "none"),
            )

        except asyncio.TimeoutError:
            self.logger.warning("Security review timeout")
            return SecurityReview(veto=False, reason="Review timeout")
        except Exception as e:
            self.logger.warning("Security review failed", error=str(e))
            return SecurityReview(veto=False, reason=f"Review error: {e}")

    async def _collect_votes(
        self,
        proposal: Proposal,
        timeout: float = 20.0
    ) -> List[Vote]:
        """Collect votes from all Pentarchy members."""
        self.logger.info("Collecting votes...")

        proposal_dict = {
            "id": proposal.id,
            "type": proposal.type.value,
            "title": proposal.title,
            "description": proposal.description,
            "task": proposal.description or proposal.title,
            "payload": proposal.payload,
            "estimated_cost": proposal.estimated_cost,
            "tenant_id": proposal.tenant_id
        }

        # Create vote tasks for all members
        async def get_vote(agent_id: str) -> Vote:
            agent_name = self.VOTING_MEMBERS.get(agent_id, agent_id)

            try:
                # Try direct handler first
                if agent_id in self._agent_vote_handlers:
                    response = await asyncio.wait_for(
                        self._agent_vote_handlers[agent_id](proposal_dict),
                        timeout=timeout / len(self.VOTING_MEMBERS)
                    )
                elif self.bus:
                    response = await self.bus.publish_request(
                        target_agent=agent_id,
                        payload={"action": "vote", "proposal": proposal_dict},
                        timeout=timeout / len(self.VOTING_MEMBERS)
                    )
                else:
                    # Default: abstain
                    return Vote(
                        agent_id=agent_id,
                        agent_name=agent_name,
                        decision=VoteDecision.ABSTAIN,
                        reasons=["no_handler_available"]
                    )

                decision = (
                    VoteDecision.APPROVE if response.get("approve")
                    else VoteDecision.DENY
                )

                return Vote(
                    agent_id=agent_id,
                    agent_name=agent_name,
                    decision=decision,
                    confidence=response.get("confidence", 0.5),
                    score=response.get("score", 0.5),
                    reasons=response.get("reasons", [])
                )

            except asyncio.TimeoutError:
                self.logger.warning(f"Vote timeout from {agent_id}")
                return Vote(
                    agent_id=agent_id,
                    agent_name=agent_name,
                    decision=VoteDecision.ABSTAIN,
                    reasons=["vote_timeout"]
                )
            except Exception as e:
                self.logger.warning(f"Vote error from {agent_id}", error=str(e))
                return Vote(
                    agent_id=agent_id,
                    agent_name=agent_name,
                    decision=VoteDecision.ABSTAIN,
                    reasons=[f"vote_error:{str(e)}"]
                )

        # Collect votes in parallel
        vote_tasks = [get_vote(agent_id) for agent_id in self.VOTING_MEMBERS.keys()]

        try:
            votes = await asyncio.wait_for(
                asyncio.gather(*vote_tasks),
                timeout=timeout
            )
            return list(votes)

        except asyncio.TimeoutError:
            self.logger.warning("Overall vote collection timeout")
            return []

    def _tally_votes(self, proposal: Proposal) -> Dict[str, Any]:
        """Tally votes and determine outcome."""
        votes_for = 0
        votes_against = 0
        abstentions = 0
        total_confidence = 0.0
        total_score = 0.0

        vote_details = []

        for vote in proposal.votes:
            if vote.decision == VoteDecision.APPROVE:
                votes_for += 1
                total_confidence += vote.confidence
                total_score += vote.score
            elif vote.decision == VoteDecision.DENY:
                votes_against += 1
                total_score += (1 - vote.score)
            else:
                abstentions += 1

            vote_details.append(vote.to_dict())

        # Check quorum
        total_votes = votes_for + votes_against
        has_quorum = total_votes >= self.quorum_size

        # Check approval threshold
        if has_quorum and total_votes > 0:
            approval_ratio = votes_for / total_votes
            approved = approval_ratio >= self.approval_threshold
        else:
            approved = False
            approval_ratio = 0.0

        avg_confidence = total_confidence / votes_for if votes_for > 0 else 0.0
        avg_score = total_score / len(proposal.votes) if proposal.votes else 0.5

        result = {
            "approved": approved,
            "votes_for": votes_for,
            "votes_against": votes_against,
            "abstentions": abstentions,
            "total_votes": total_votes,
            "quorum_met": has_quorum,
            "quorum_required": self.quorum_size,
            "approval_ratio": approval_ratio,
            "approval_threshold": self.approval_threshold,
            "average_confidence": avg_confidence,
            "average_score": avg_score,
            "vote_details": vote_details,
            "proposal_id": proposal.id,
            "security_review": proposal.security_review.to_dict() if proposal.security_review else None
        }

        # Add reason
        if not has_quorum:
            result["reason"] = f"Quorum not met ({total_votes}/{self.quorum_size})"
        elif approved:
            result["reason"] = f"Approved ({votes_for}/{total_votes} votes)"
        else:
            result["reason"] = f"Denied ({votes_against}/{total_votes} votes against)"

        return result

    async def _persist_proposal(self, proposal: Proposal) -> None:
        """Persist proposal to database."""
        if not self._db_pool:
            return

        try:
            async with self._db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO governance_proposals (
                        id, proposal_type, title, description, payload,
                        requestor_id, requestor_agent, tenant_id, status,
                        estimated_cost, votes, security_reviewed,
                        security_veto, security_reason, security_risks,
                        created_at, resolved_at, metadata
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        votes = EXCLUDED.votes,
                        security_reviewed = EXCLUDED.security_reviewed,
                        security_veto = EXCLUDED.security_veto,
                        security_reason = EXCLUDED.security_reason,
                        resolved_at = EXCLUDED.resolved_at,
                        metadata = EXCLUDED.metadata
                    """,
                    proposal.id,
                    proposal.type.value,
                    proposal.title,
                    proposal.description,
                    json.dumps(proposal.payload),
                    proposal.requestor_id,
                    proposal.requestor_agent,
                    proposal.tenant_id,
                    proposal.status.value,
                    proposal.estimated_cost,
                    json.dumps([v.to_dict() for v in proposal.votes]),
                    proposal.security_review is not None,
                    proposal.security_review.veto if proposal.security_review else False,
                    proposal.security_review.reason if proposal.security_review else None,
                    json.dumps(proposal.security_review.risks) if proposal.security_review else "[]",
                    proposal.created_at,
                    proposal.resolved_at,
                    json.dumps(proposal.metadata or {})
                )
        except Exception as e:
            self.logger.warning("Failed to persist proposal", error=str(e))

    # =========================================================================
    # Query Methods
    # =========================================================================

    def get_proposal(self, proposal_id: str) -> Optional[Proposal]:
        """Get a proposal by ID."""
        return self.active_proposals.get(proposal_id)

    def get_active_proposals(
        self,
        tenant_id: Optional[str] = None
    ) -> List[Proposal]:
        """Get all active proposals, optionally filtered by tenant."""
        proposals = [
            p for p in self.active_proposals.values()
            if p.status in [ProposalStatus.PENDING, ProposalStatus.VOTING, ProposalStatus.SECURITY_REVIEW]
        ]

        if tenant_id:
            proposals = [p for p in proposals if p.tenant_id == tenant_id]

        return sorted(proposals, key=lambda p: p.created_at, reverse=True)

    def get_proposal_history(
        self,
        tenant_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Proposal]:
        """Get completed proposals."""
        proposals = [
            p for p in self.active_proposals.values()
            if p.status in [ProposalStatus.APPROVED, ProposalStatus.DENIED, ProposalStatus.VETOED]
        ]

        if tenant_id:
            proposals = [p for p in proposals if p.tenant_id == tenant_id]

        return sorted(proposals, key=lambda p: p.resolved_at or p.created_at, reverse=True)[:limit]

    # =========================================================================
    # SDUI Component Generation
    # =========================================================================

    def generate_sdui_components(
        self,
        proposal: Proposal,
        include_voting: bool = True
    ) -> List[Dict[str, Any]]:
        """Generate SDUI components for proposal display."""
        components = []

        # Header card
        components.append({
            "type": "card",
            "props": {
                "title": f"Governance: {proposal.title}",
                "variant": "info",
                "content": proposal.description
            }
        })

        # Status metric
        status_colors = {
            "pending": "neutral",
            "voting": "info",
            "approved": "success",
            "denied": "error",
            "vetoed": "error"
        }

        components.append({
            "type": "metric",
            "props": {
                "label": "Status",
                "value": proposal.status.value.upper(),
                "variant": status_colors.get(proposal.status.value, "neutral")
            }
        })

        # Cost estimate
        if proposal.estimated_cost > 0:
            components.append({
                "type": "metric",
                "props": {
                    "label": "Estimated Cost",
                    "value": f"${proposal.estimated_cost:.4f}",
                    "trend": "up" if proposal.estimated_cost > 0.1 else "neutral"
                }
            })

        # Security review
        if proposal.security_review:
            components.append({
                "type": "alert",
                "props": {
                    "variant": "error" if proposal.security_review.veto else "success",
                    "title": "Security Review",
                    "message": proposal.security_review.reason or "Passed security review"
                }
            })

        # Votes
        if proposal.votes and include_voting:
            vote_data = [v.to_dict() for v in proposal.votes]
            components.append({
                "type": "data_table",
                "props": {
                    "title": "Pentarchy Votes",
                    "data": vote_data,
                    "columns": ["agent_name", "decision", "confidence", "reasons"]
                }
            })

        # Result summary
        if proposal.result:
            result = proposal.result
            components.append({
                "type": "card",
                "props": {
                    "title": "Decision",
                    "variant": "success" if result.get("approved") else "error",
                    "content": result.get("reason", "")
                }
            })

        return components

    # =========================================================================
    # Lifecycle
    # =========================================================================

    async def shutdown(self) -> None:
        """Shutdown the governance system."""
        self.logger.info("Shutting down Pentarchy governance...")
        if self.bus:
            await self.bus.close()
        self._agent_vote_handlers.clear()
        self._aegis_handler = None
        self.logger.info("Pentarchy governance shut down")


# Singleton instance
_governor: Optional[PentarchyGovernor] = None


async def get_governor(db_pool=None) -> PentarchyGovernor:
    """Get the Pentarchy governor instance."""
    global _governor
    if _governor is None:
        _governor = PentarchyGovernor()
        await _governor.initialize(db_pool=db_pool)
    return _governor


async def close_governor() -> None:
    """Close the Pentarchy governor."""
    global _governor
    if _governor:
        await _governor.shutdown()
        _governor = None
