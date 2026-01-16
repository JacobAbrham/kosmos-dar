"""
KOSMOS V2.0 Messaging Configuration (NATS)
"""

from typing import Callable, Optional, Any
import asyncio

import structlog
import nats
from nats.aio.client import Client as NATSClient
from nats.js import JetStreamContext

from .config import settings

logger = structlog.get_logger()

# Global NATS client
_client: Optional[NATSClient] = None
_js: Optional[JetStreamContext] = None


async def init_nats() -> None:
    """Initialize NATS connection (optional - skipped if NATS_URL not configured)."""
    global _client, _js

    # Skip NATS if not configured or disabled
    if not settings.nats_url or settings.nats_url == "nats://localhost:4222":
        logger.warning("NATS not configured - skipping NATS initialization. Inter-agent messaging will be disabled.")
        return

    logger.info("Initializing NATS connection...")

    try:
        _client = await nats.connect(
            servers=[settings.nats_url],
            reconnect_time_wait=2,
            max_reconnect_attempts=3,  # Reduced for faster startup failure
        )

        # Initialize JetStream
        _js = _client.jetstream()

        # Create streams for KOSMOS
        await _create_streams()

        logger.info("NATS connection established")
    except Exception as e:
        logger.warning(f"NATS connection failed - continuing without messaging: {e}")
        _client = None
        _js = None


async def _create_streams() -> None:
    """Create JetStream streams for KOSMOS."""
    if not _js:
        return

    streams = [
        {
            "name": "KOSMOS_AGENTS",
            "subjects": ["kosmos.agents.*", "kosmos.agents.*.requests", "kosmos.agents.*.responses"],
            "retention": "limits",
            "max_age": 86400 * 7,  # 7 days
        },
        {
            "name": "KOSMOS_EVENTS",
            "subjects": ["kosmos.events.*"],
            "retention": "limits",
            "max_age": 86400 * 30,  # 30 days
        },
        {
            "name": "KOSMOS_GOVERNANCE",
            "subjects": ["kosmos.governance.*", "kosmos.governance.votes.*"],
            "retention": "limits",
            "max_age": 86400 * 90,  # 90 days
        },
    ]

    for stream_config in streams:
        try:
            await _js.add_stream(**stream_config)
            logger.info(f"Created stream: {stream_config['name']}")
        except Exception as e:
            if "already exists" not in str(e).lower():
                logger.warning(f"Failed to create stream {stream_config['name']}: {e}")


async def close_nats() -> None:
    """Close NATS connection."""
    global _client
    logger.info("Closing NATS connection...")

    if _client:
        await _client.drain()
        await _client.close()

    logger.info("NATS connection closed")


async def check_nats_connection() -> bool:
    """Check if NATS is connected."""
    try:
        if _client and _client.is_connected:
            return True
        return False
    except Exception as e:
        logger.error("NATS connection check failed", error=str(e))
        return False


def get_nats() -> NATSClient:
    """Get NATS client."""
    if _client is None:
        raise RuntimeError("NATS not initialized")
    return _client


def get_jetstream() -> JetStreamContext:
    """Get JetStream context."""
    if _js is None:
        raise RuntimeError("JetStream not initialized")
    return _js


class AgentBus:
    """Message bus for inter-agent communication."""

    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self._subscriptions = []
        self._governance_bus: Optional["GovernanceBus"] = None

    async def publish_request(
        self,
        target_agent: str,
        payload: dict,
        timeout: float = 30.0
    ) -> Optional[dict]:
        """Publish request to another agent and wait for response."""
        client = get_nats()
        subject = f"kosmos.agents.{target_agent}.requests"

        try:
            response = await client.request(
                subject,
                payload=self._encode(payload),
                timeout=timeout
            )
            return self._decode(response.data)
        except asyncio.TimeoutError:
            logger.warning(f"Request to {target_agent} timed out")
            return None

    async def publish_event(self, event_type: str, payload: dict) -> None:
        """Publish event to event stream."""
        js = get_jetstream()
        subject = f"kosmos.events.{event_type}"

        await js.publish(
            subject,
            payload=self._encode(payload)
        )

    async def subscribe_requests(
        self,
        handler: Callable[[dict], Any]
    ) -> None:
        """Subscribe to incoming requests."""
        client = get_nats()
        subject = f"kosmos.agents.{self.agent_id}.requests"

        async def message_handler(msg):
            payload = self._decode(msg.data)
            response = await handler(payload)
            if msg.reply:
                await client.publish(msg.reply, self._encode(response))

        sub = await client.subscribe(subject, cb=message_handler)
        self._subscriptions.append(sub)

    async def subscribe_events(
        self,
        event_type: str,
        handler: Callable[[dict], Any]
    ) -> None:
        """Subscribe to events."""
        js = get_jetstream()
        subject = f"kosmos.events.{event_type}"

        async def message_handler(msg):
            payload = self._decode(msg.data)
            await handler(payload)
            await msg.ack()

        sub = await js.subscribe(
            subject,
            durable=f"{self.agent_id}_{event_type}",
            cb=message_handler
        )
        self._subscriptions.append(sub)

    async def send_task(
        self,
        agent_id: str,
        task: str,
        context: Optional[dict] = None,
        timeout: float = 30.0
    ) -> Optional[dict]:
        """
        Send a task to another agent.

        Used by WorkflowEngine to invoke agents.

        Args:
            agent_id: Target agent identifier
            task: Task description
            context: Optional context dictionary
            timeout: Request timeout in seconds

        Returns:
            Agent response or None if timeout
        """
        payload = {
            "from_agent": self.agent_id,
            "task": task,
            "context": context or {}
        }
        return await self.publish_request(agent_id, payload, timeout)

    async def request_vote(
        self,
        proposal_id: str,
        proposal_type: str,
        proposal_data: dict,
        voting_agents: list[str],
        timeout: float = 30.0
    ) -> dict[str, Any]:
        """
        Request votes from Pentarchy agents.

        Used by Zeus agent for governance decisions requiring consensus.

        Args:
            proposal_id: Unique identifier for the proposal
            proposal_type: Type of proposal (e.g., "high_cost_operation", "policy_change")
            proposal_data: Proposal details including cost, description, etc.
            voting_agents: List of agent IDs to participate in voting
            timeout: Voting timeout in seconds

        Returns:
            Dictionary containing vote results:
            {
                "approved": bool,
                "votes": {"agent_id": {"vote": "approve/reject", "reason": str}},
                "quorum_met": bool,
                "approval_percentage": float
            }
        """
        # Initialize governance bus if needed
        if not self._governance_bus:
            self._governance_bus = GovernanceBus()

        proposal = {
            "id": proposal_id,
            "type": proposal_type,
            "data": proposal_data,
            "voters": voting_agents,
            "timeout": timeout
        }

        # Request vote via governance bus
        await self._governance_bus.request_vote(proposal_id, proposal)

        # Collect votes from voting agents
        votes = {}
        for agent_id in voting_agents:
            try:
                response = await self.publish_request(
                    agent_id,
                    {
                        "type": "vote_request",
                        "proposal": proposal
                    },
                    timeout=timeout / len(voting_agents)  # Distribute timeout
                )
                if response:
                    votes[agent_id] = response
            except Exception as e:
                logger.warning(f"Failed to get vote from {agent_id}", error=str(e))
                votes[agent_id] = {"vote": "abstain", "reason": "timeout or error"}

        # Calculate results
        approve_count = sum(1 for v in votes.values() if v.get("vote") == "approve")
        total_votes = len(votes)
        approval_percentage = (approve_count / total_votes * 100) if total_votes > 0 else 0
        quorum_met = total_votes >= len(voting_agents) * 0.5  # 50% quorum
        approved = approve_count > total_votes / 2  # Simple majority

        return {
            "approved": approved,
            "votes": votes,
            "quorum_met": quorum_met,
            "approval_percentage": approval_percentage,
            "total_voters": len(voting_agents),
            "votes_received": total_votes
        }

    async def close(self) -> None:
        """Unsubscribe from all subscriptions."""
        for sub in self._subscriptions:
            await sub.unsubscribe()
        self._subscriptions.clear()

    def _encode(self, data: dict) -> bytes:
        """Encode data for transmission."""
        import orjson
        return orjson.dumps(data)

    def _decode(self, data: bytes) -> dict:
        """Decode received data."""
        import orjson
        return orjson.loads(data)


class GovernanceBus:
    """Message bus for governance (Pentarchy) communication."""

    async def request_vote(
        self,
        proposal_id: str,
        proposal: dict
    ) -> None:
        """Request votes from Pentarchy agents."""
        js = get_jetstream()

        await js.publish(
            "kosmos.governance.vote_request",
            payload=self._encode({
                "proposal_id": proposal_id,
                "proposal": proposal
            })
        )

    async def submit_vote(
        self,
        proposal_id: str,
        voter_agent: str,
        vote: dict
    ) -> None:
        """Submit a vote for a proposal."""
        js = get_jetstream()

        await js.publish(
            f"kosmos.governance.votes.{proposal_id}",
            payload=self._encode({
                "voter": voter_agent,
                "vote": vote
            })
        )

    async def subscribe_vote_requests(
        self,
        agent_id: str,
        handler: Callable[[dict], Any]
    ) -> None:
        """Subscribe to vote requests."""
        js = get_jetstream()

        async def message_handler(msg):
            payload = self._decode(msg.data)
            await handler(payload)
            await msg.ack()

        await js.subscribe(
            "kosmos.governance.vote_request",
            durable=f"voter_{agent_id}",
            cb=message_handler
        )

    def _encode(self, data: dict) -> bytes:
        import orjson
        return orjson.dumps(data)

    def _decode(self, data: bytes) -> dict:
        import orjson
        return orjson.loads(data)
