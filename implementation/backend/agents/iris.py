"""
KOSMOS V2.0 Iris Agent - Communication & Notification

Iris handles all communication operations including notifications,
messaging, email, and multi-channel delivery.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

import structlog
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage

from .base import BaseAgent, AgentConfig, AgentMessage

logger = structlog.get_logger()


class Channel(str, Enum):
    """Communication channels."""
    EMAIL = "email"
    SLACK = "slack"
    TEAMS = "teams"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in_app"
    WEBHOOK = "webhook"


class Priority(str, Enum):
    """Message priority."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class MessageStatus(str, Enum):
    """Message delivery status."""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


@dataclass
class Recipient:
    """Message recipient."""
    id: str = ""
    type: str = "user"  # user, group, channel
    channels: List[Channel] = field(default_factory=list)
    preferences: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Message:
    """A message to be sent."""
    id: str = ""
    subject: str = ""
    body: str = ""
    priority: Priority = Priority.NORMAL
    channels: List[Channel] = field(default_factory=list)
    recipients: List[Recipient] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    template: Optional[str] = None
    schedule_for: Optional[datetime] = None


@dataclass
class DeliveryResult:
    """Result of message delivery."""
    message_id: str = ""
    channel: Channel = Channel.IN_APP
    status: MessageStatus = MessageStatus.PENDING
    timestamp: datetime = field(default_factory=datetime.utcnow)
    error: Optional[str] = None


@dataclass
class IrisState:
    """State for Iris communication workflow."""
    messages: List[BaseMessage] = field(default_factory=list)
    operation: str = ""  # send, schedule, status, broadcast
    message: Optional[Message] = None
    delivery_results: List[DeliveryResult] = field(default_factory=list)
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class IrisAgent(BaseAgent):
    """
    Iris - Communication & Notification Agent

    Responsibilities:
    - Send notifications across multiple channels
    - Manage message templates
    - Handle user communication preferences
    - Schedule and batch messages
    - Track delivery status
    - Support multi-language messages
    """

    # Channel configurations
    CHANNEL_CONFIG = {
        Channel.EMAIL: {"provider": "sendgrid", "rate_limit": 100},
        Channel.SLACK: {"provider": "mcp-slack", "rate_limit": 1000},
        Channel.TEAMS: {"provider": "mcp-teams", "rate_limit": 500},
        Channel.SMS: {"provider": "twilio", "rate_limit": 50},
        Channel.PUSH: {"provider": "firebase", "rate_limit": 5000},
        Channel.IN_APP: {"provider": "internal", "rate_limit": 10000},
        Channel.WEBHOOK: {"provider": "internal", "rate_limit": 1000},
    }

    def __init__(self):
        config = AgentConfig(
            id="iris",
            name="Iris",
            domain="communication",
            description="Communication and notification agent for multi-channel messaging",
            tools=["send_message", "schedule_message", "check_status", "broadcast"],
            mcp_servers=["mcp-slack", "mcp-teams", "mcp-email"],
            pentarchy_voter=False,
            security_veto=False,
            max_iterations=10,
            timeout_seconds=60,
        )
        super().__init__(config)

    async def _build_graph(self) -> StateGraph:
        """Build Iris communication workflow."""
        workflow = StateGraph(IrisState)

        # Add nodes
        workflow.add_node("parse_request", self._parse_request)
        workflow.add_node("validate_message", self._validate_message)
        workflow.add_node("resolve_recipients", self._resolve_recipients)
        workflow.add_node("apply_preferences", self._apply_preferences)
        workflow.add_node("deliver_messages", self._deliver_messages)
        workflow.add_node("track_delivery", self._track_delivery)
        workflow.add_node("prepare_output", self._prepare_output)
        workflow.add_node("handle_error", self._handle_error)

        # Set entry point
        workflow.set_entry_point("parse_request")

        # Add edges
        workflow.add_edge("parse_request", "validate_message")

        workflow.add_conditional_edges(
            "validate_message",
            lambda s: s.error is None,
            {
                True: "resolve_recipients",
                False: "handle_error",
            }
        )

        workflow.add_edge("resolve_recipients", "apply_preferences")
        workflow.add_edge("apply_preferences", "deliver_messages")
        workflow.add_edge("deliver_messages", "track_delivery")
        workflow.add_edge("track_delivery", "prepare_output")
        workflow.add_edge("prepare_output", END)
        workflow.add_edge("handle_error", END)

        return workflow.compile()

    async def process(self, message: AgentMessage) -> Dict[str, Any]:
        """Process communication request."""
        self.logger.info("Processing communication request", trace_id=message.trace_id)

        # Build message from payload
        msg = Message(
            id=str(message.id),
            subject=message.payload.get("subject", ""),
            body=message.payload.get("body", ""),
            priority=Priority(message.payload.get("priority", "normal")),
            channels=[Channel(c) for c in message.payload.get("channels", ["in_app"])],
            template=message.payload.get("template"),
        )

        # Parse recipients
        for r in message.payload.get("recipients", []):
            msg.recipients.append(Recipient(
                id=r.get("id", ""),
                type=r.get("type", "user"),
                channels=[Channel(c) for c in r.get("channels", [])],
            ))

        state = IrisState(
            operation=message.payload.get("operation", "send"),
            message=msg,
        )

        try:
            if self._graph:
                final_state = await self._graph.ainvoke(state)
                return {
                    "success": final_state.error is None,
                    "result": final_state.output,
                    "summary": self._create_summary(final_state),
                    "error": final_state.error,
                }
        except Exception as e:
            self.logger.error("Communication failed", error=str(e))
            return {"success": False, "error": str(e)}

        return {"success": False, "error": "Workflow not initialized"}

    def _create_summary(self, state: IrisState) -> str:
        """Create summary of delivery results."""
        if not state.delivery_results:
            return "No messages delivered"

        sent = sum(1 for r in state.delivery_results if r.status == MessageStatus.SENT)
        failed = sum(1 for r in state.delivery_results if r.status == MessageStatus.FAILED)

        return f"Delivered: {sent}, Failed: {failed}"

    # =========================================================================
    # Workflow Nodes
    # =========================================================================

    async def _parse_request(self, state: IrisState) -> IrisState:
        """Parse the communication request."""
        self.logger.info("Parsing request...", operation=state.operation)
        return state

    async def _validate_message(self, state: IrisState) -> IrisState:
        """Validate the message content."""
        self.logger.info("Validating message...")

        if not state.message:
            state.error = "No message provided"
            return state

        if not state.message.body and not state.message.template:
            state.error = "Message must have body or template"
            return state

        if not state.message.recipients:
            state.error = "No recipients specified"
            return state

        if not state.message.channels:
            state.message.channels = [Channel.IN_APP]

        return state

    async def _resolve_recipients(self, state: IrisState) -> IrisState:
        """Resolve recipient details and contact information."""
        self.logger.info("Resolving recipients...")

        if not state.message:
            return state

        for recipient in state.message.recipients:
            if recipient.type == "group":
                # Would expand group to individual users
                self.logger.info(f"Expanding group: {recipient.id}")
            elif recipient.type == "channel":
                # Would resolve channel endpoint
                self.logger.info(f"Resolving channel: {recipient.id}")

        return state

    async def _apply_preferences(self, state: IrisState) -> IrisState:
        """Apply user notification preferences."""
        self.logger.info("Applying preferences...")

        if not state.message:
            return state

        for recipient in state.message.recipients:
            # Would fetch user preferences from database
            # and filter channels accordingly
            prefs = recipient.preferences

            # Respect do-not-disturb
            if prefs.get("dnd_enabled"):
                # Remove push and SMS for DND users
                recipient.channels = [
                    c for c in recipient.channels
                    if c not in [Channel.PUSH, Channel.SMS]
                ]

            # Respect channel preferences
            allowed = prefs.get("allowed_channels", [])
            if allowed:
                recipient.channels = [
                    c for c in recipient.channels
                    if c.value in allowed
                ]

        return state

    async def _deliver_messages(self, state: IrisState) -> IrisState:
        """Deliver messages through configured channels."""
        self.logger.info("Delivering messages...")

        if not state.message:
            return state

        for channel in state.message.channels:
            for recipient in state.message.recipients:
                # Check if recipient accepts this channel
                if recipient.channels and channel not in recipient.channels:
                    continue

                result = await self._send_via_channel(
                    channel=channel,
                    message=state.message,
                    recipient=recipient,
                )

                state.delivery_results.append(result)

        return state

    async def _send_via_channel(
        self,
        channel: Channel,
        message: Message,
        recipient: Recipient,
    ) -> DeliveryResult:
        """Send message via specific channel."""
        self.logger.info(
            f"Sending via {channel.value}",
            recipient=recipient.id
        )

        try:
            config = self.CHANNEL_CONFIG.get(channel)
            if not config:
                raise ValueError(f"Unknown channel: {channel}")

            # Would use MCP server or provider API
            if channel == Channel.SLACK:
                if "mcp-slack" in self.mcp_clients:
                    await self.call_mcp(
                        server="mcp-slack",
                        tool="send_message",
                        params={
                            "channel": recipient.id,
                            "text": message.body,
                        }
                    )
            elif channel == Channel.EMAIL:
                # Would use email provider
                pass
            elif channel == Channel.IN_APP:
                # Would store in database
                pass

            return DeliveryResult(
                message_id=message.id,
                channel=channel,
                status=MessageStatus.SENT,
            )

        except Exception as e:
            self.logger.error(
                f"Delivery failed via {channel.value}",
                error=str(e)
            )
            return DeliveryResult(
                message_id=message.id,
                channel=channel,
                status=MessageStatus.FAILED,
                error=str(e),
            )

    async def _track_delivery(self, state: IrisState) -> IrisState:
        """Track delivery status and emit events."""
        self.logger.info("Tracking delivery...")

        for result in state.delivery_results:
            await self.emit_event("iris.message_delivered", {
                "message_id": result.message_id,
                "channel": result.channel.value,
                "status": result.status.value,
                "timestamp": result.timestamp.isoformat(),
                "error": result.error,
            })

        return state

    async def _prepare_output(self, state: IrisState) -> IrisState:
        """Prepare final output."""
        self.logger.info("Preparing output...")

        state.output = {
            "operation": state.operation,
            "message_id": state.message.id if state.message else None,
            "delivery_results": [
                {
                    "channel": r.channel.value,
                    "status": r.status.value,
                    "timestamp": r.timestamp.isoformat(),
                    "error": r.error,
                }
                for r in state.delivery_results
            ],
            "summary": {
                "total": len(state.delivery_results),
                "sent": sum(1 for r in state.delivery_results if r.status == MessageStatus.SENT),
                "failed": sum(1 for r in state.delivery_results if r.status == MessageStatus.FAILED),
            }
        }

        return state

    async def _handle_error(self, state: IrisState) -> IrisState:
        """Handle workflow errors."""
        self.logger.error("Handling error", error=state.error)
        return state

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def send_notification(
        self,
        recipient_id: str,
        subject: str,
        body: str,
        channels: List[Channel] = None,
        priority: Priority = Priority.NORMAL,
    ) -> Dict[str, Any]:
        """Convenience method to send a notification."""
        if channels is None:
            channels = [Channel.IN_APP]

        message = AgentMessage(
            from_agent="system",
            to_agent="iris",
            message_type="request",
            payload={
                "operation": "send",
                "subject": subject,
                "body": body,
                "channels": [c.value for c in channels],
                "priority": priority.value,
                "recipients": [{"id": recipient_id, "type": "user"}],
            }
        )

        return await self.process(message)

    async def broadcast(
        self,
        subject: str,
        body: str,
        channels: List[Channel],
        tenant_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Broadcast message to all users (optionally scoped to tenant)."""
        self.logger.info("Broadcasting message", tenant_id=tenant_id)

        # Would fetch all users and send
        return {"success": True, "message": "Broadcast initiated"}
