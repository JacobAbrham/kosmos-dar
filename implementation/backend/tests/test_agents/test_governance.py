"""
Tests for Governance Agent - Pentarchy Voting System

Tests voting protocol, weighted voting, and governance decisions.
"""

import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.unit
@pytest.mark.agent
class TestPentarchyVoting:
    """Tests for Pentarchy voting system."""

    def test_voting_initialization(self):
        """Test voting system initialization."""
        from agents.governance import PentarchyVoting

        voting = PentarchyVoting()

        assert voting is not None
        assert hasattr(voting, 'cast_vote')
        assert hasattr(voting, 'tally_votes')

    def test_pentarchy_members(self):
        """Test that pentarchy has correct members."""
        from agents.governance import PentarchyVoting, PENTARCHY_MEMBERS

        # Should have 5 members (Pentarchy)
        assert len(PENTARCHY_MEMBERS) == 5

        expected_members = ["zeus", "aegis", "athena", "hermes", "chronos"]
        for member in expected_members:
            assert member in [m.lower() for m in PENTARCHY_MEMBERS]

    def test_vote_creation(self):
        """Test creating a vote."""
        from agents.governance import Vote, VoteType

        vote = Vote(
            proposal_id="prop-123",
            voter="zeus",
            vote_type=VoteType.APPROVE,
            weight=1.0,
            reason="Meets all requirements"
        )

        assert vote.proposal_id == "prop-123"
        assert vote.voter == "zeus"
        assert vote.vote_type == VoteType.APPROVE

    def test_weighted_voting(self):
        """Test weighted voting calculation."""
        from agents.governance import PentarchyVoting, Vote, VoteType

        voting = PentarchyVoting()

        # Cast votes with different weights
        voting.cast_vote(Vote("prop-1", "zeus", VoteType.APPROVE, weight=2.0))
        voting.cast_vote(Vote("prop-1", "aegis", VoteType.REJECT, weight=1.5))
        voting.cast_vote(Vote("prop-1", "athena", VoteType.APPROVE, weight=1.0))

        result = voting.tally_votes("prop-1")

        # Approve: 2.0 + 1.0 = 3.0, Reject: 1.5
        assert result["approve_weight"] == 3.0
        assert result["reject_weight"] == 1.5
        assert result["decision"] == "approved"

    def test_majority_required(self):
        """Test that majority is required for approval."""
        from agents.governance import PentarchyVoting, Vote, VoteType

        voting = PentarchyVoting()

        # 2 approve, 3 reject - should be rejected
        voting.cast_vote(Vote("prop-2", "zeus", VoteType.APPROVE, weight=1.0))
        voting.cast_vote(Vote("prop-2", "aegis", VoteType.REJECT, weight=1.0))
        voting.cast_vote(Vote("prop-2", "athena", VoteType.REJECT, weight=1.0))
        voting.cast_vote(Vote("prop-2", "hermes", VoteType.APPROVE, weight=1.0))
        voting.cast_vote(Vote("prop-2", "chronos", VoteType.REJECT, weight=1.0))

        result = voting.tally_votes("prop-2")

        assert result["decision"] == "rejected"

    def test_abstain_vote(self):
        """Test abstaining from vote."""
        from agents.governance import PentarchyVoting, Vote, VoteType

        voting = PentarchyVoting()

        voting.cast_vote(Vote("prop-3", "zeus", VoteType.APPROVE, weight=1.0))
        voting.cast_vote(Vote("prop-3", "aegis", VoteType.ABSTAIN, weight=1.0))
        voting.cast_vote(Vote("prop-3", "athena", VoteType.APPROVE, weight=1.0))
        voting.cast_vote(Vote("prop-3", "hermes", VoteType.ABSTAIN, weight=1.0))
        voting.cast_vote(Vote("prop-3", "chronos", VoteType.APPROVE, weight=1.0))

        result = voting.tally_votes("prop-3")

        # 3 approve, 0 reject, 2 abstain - should pass
        assert result["decision"] == "approved"
        assert result["abstain_count"] == 2


@pytest.mark.unit
@pytest.mark.agent
class TestVetoMechanism:
    """Tests for security veto mechanism."""

    def test_aegis_veto(self):
        """Test AEGIS security veto."""
        from agents.governance import PentarchyVoting, Vote, VoteType

        voting = PentarchyVoting()

        # Even with majority approval, AEGIS veto should block
        voting.cast_vote(Vote("prop-4", "zeus", VoteType.APPROVE, weight=1.0))
        voting.cast_vote(Vote("prop-4", "aegis", VoteType.VETO, weight=1.0, reason="Security risk"))
        voting.cast_vote(Vote("prop-4", "athena", VoteType.APPROVE, weight=1.0))
        voting.cast_vote(Vote("prop-4", "hermes", VoteType.APPROVE, weight=1.0))
        voting.cast_vote(Vote("prop-4", "chronos", VoteType.APPROVE, weight=1.0))

        result = voting.tally_votes("prop-4")

        assert result["decision"] == "vetoed"
        assert result["veto_by"] == "aegis"
        assert "Security risk" in result["veto_reason"]

    def test_veto_only_by_aegis(self):
        """Test that only AEGIS can veto."""
        from agents.governance import PentarchyVoting, Vote, VoteType

        voting = PentarchyVoting()

        # Other agents trying to veto should be treated as reject
        vote = Vote("prop-5", "zeus", VoteType.VETO, weight=1.0)

        # Should raise or convert to reject
        with pytest.raises(ValueError) as exc_info:
            voting.cast_vote(vote)

        assert "only AEGIS" in str(exc_info.value).lower() or voting.get_vote("prop-5", "zeus").vote_type == VoteType.REJECT


@pytest.mark.unit
@pytest.mark.agent
class TestProposalManagement:
    """Tests for proposal management."""

    def test_create_proposal(self):
        """Test creating a governance proposal."""
        from agents.governance import GovernanceManager, Proposal, ProposalType

        manager = GovernanceManager()

        proposal = manager.create_proposal(
            type=ProposalType.ACTION,
            title="Deploy new feature",
            description="Deploy the analytics dashboard",
            requester="user-123",
            data={"feature": "analytics", "environment": "production"}
        )

        assert proposal.id is not None
        assert proposal.type == ProposalType.ACTION
        assert proposal.status == "pending"

    def test_proposal_lifecycle(self):
        """Test proposal lifecycle states."""
        from agents.governance import GovernanceManager, Proposal, ProposalType

        manager = GovernanceManager()

        proposal = manager.create_proposal(
            type=ProposalType.ACTION,
            title="Test proposal",
            description="Test",
            requester="user-123"
        )

        assert proposal.status == "pending"

        # Start voting
        manager.start_voting(proposal.id)
        assert manager.get_proposal(proposal.id).status == "voting"

        # Complete voting
        manager.complete_voting(proposal.id, decision="approved")
        assert manager.get_proposal(proposal.id).status == "approved"

    def test_proposal_expiration(self):
        """Test proposal expiration."""
        from agents.governance import GovernanceManager, Proposal, ProposalType
        from datetime import timedelta

        manager = GovernanceManager()

        proposal = manager.create_proposal(
            type=ProposalType.ACTION,
            title="Expiring proposal",
            description="Test",
            requester="user-123",
            expires_in=timedelta(seconds=1)
        )

        # Wait for expiration
        import time
        time.sleep(1.5)

        manager.check_expirations()

        assert manager.get_proposal(proposal.id).status == "expired"


@pytest.mark.unit
@pytest.mark.agent
class TestAppealMechanism:
    """Tests for appeal mechanism."""

    def test_file_appeal(self):
        """Test filing an appeal."""
        from agents.governance import GovernanceManager, Appeal

        manager = GovernanceManager()

        # Create and reject a proposal first
        proposal = manager.create_proposal(
            type="action",
            title="Rejected proposal",
            description="Test",
            requester="user-123"
        )
        manager.start_voting(proposal.id)
        manager.complete_voting(proposal.id, decision="rejected")

        # File appeal
        appeal = manager.file_appeal(
            proposal_id=proposal.id,
            reason="New information available",
            evidence={"new_data": "supporting evidence"}
        )

        assert appeal.id is not None
        assert appeal.proposal_id == proposal.id
        assert appeal.status == "pending"

    def test_appeal_review(self):
        """Test appeal review process."""
        from agents.governance import GovernanceManager

        manager = GovernanceManager()

        # Setup rejected proposal and appeal
        proposal = manager.create_proposal(
            type="action",
            title="Test",
            description="Test",
            requester="user-123"
        )
        manager.complete_voting(proposal.id, decision="rejected")

        appeal = manager.file_appeal(
            proposal_id=proposal.id,
            reason="Appeal reason"
        )

        # Review appeal
        result = manager.review_appeal(appeal.id, decision="accepted")

        assert result["decision"] == "accepted"
        # Original proposal should be reopened
        assert manager.get_proposal(proposal.id).status in ["pending", "voting"]


@pytest.mark.unit
@pytest.mark.agent
class TestGovernanceDashboard:
    """Tests for governance dashboard data."""

    def test_get_active_proposals(self):
        """Test getting active proposals."""
        from agents.governance import GovernanceManager

        manager = GovernanceManager()

        # Create multiple proposals
        for i in range(5):
            manager.create_proposal(
                type="action",
                title=f"Proposal {i}",
                description=f"Test {i}",
                requester="user-123"
            )

        active = manager.get_active_proposals()

        assert len(active) == 5

    def test_get_voting_history(self):
        """Test getting voting history."""
        from agents.governance import GovernanceManager, PentarchyVoting, Vote, VoteType

        manager = GovernanceManager()

        proposal = manager.create_proposal(
            type="action",
            title="Historical proposal",
            description="Test",
            requester="user-123"
        )

        manager.start_voting(proposal.id)

        # Cast votes
        voting = manager.voting
        voting.cast_vote(Vote(proposal.id, "zeus", VoteType.APPROVE, weight=1.0))
        voting.cast_vote(Vote(proposal.id, "aegis", VoteType.APPROVE, weight=1.0))

        history = manager.get_voting_history(proposal.id)

        assert len(history) >= 2

    def test_get_governance_stats(self):
        """Test getting governance statistics."""
        from agents.governance import GovernanceManager

        manager = GovernanceManager()

        # Create some proposals
        for i in range(10):
            p = manager.create_proposal(
                type="action",
                title=f"Proposal {i}",
                description=f"Test {i}",
                requester="user-123"
            )
            if i % 2 == 0:
                manager.complete_voting(p.id, decision="approved")
            else:
                manager.complete_voting(p.id, decision="rejected")

        stats = manager.get_stats()

        assert stats["total_proposals"] >= 10
        assert stats["approved_count"] >= 5
        assert stats["rejected_count"] >= 5
        assert "approval_rate" in stats
