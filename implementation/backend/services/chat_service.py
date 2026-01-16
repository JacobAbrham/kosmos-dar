"""
Chat Service for KOSMOS V2.0

Service layer for chat/conversation operations.
"""

import time
from typing import Any, Dict, List, Optional
from uuid import uuid4

from core.intent_router import IntentRouter, get_intent_router, RoutingContext
from core.semantic_router import SemanticRouter
from services.agent_service import AgentService, get_agent_service
from services.base import BaseService, ServiceContext


class ChatService(BaseService):
    """
    Service for chat/conversation operations.

    Responsibilities:
    - Message processing and routing
    - Conversation management
    - Agent coordination for multi-agent responses
    - Response generation and formatting
    """

    def __init__(self):
        super().__init__("ChatService")
        self._intent_router: Optional[IntentRouter] = None
        self._agent_service: Optional[AgentService] = None

    async def initialize(self) -> None:
        """Initialize service dependencies."""
        self._intent_router = await get_intent_router()
        self._agent_service = await get_agent_service()

    async def process_message(
        self,
        ctx: ServiceContext,
        message: str,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Process a chat message and return response.

        Args:
            ctx: Service context
            message: User message
            conversation_id: Optional conversation ID
            context: Optional context dictionary

        Returns:
            Chat response with agent routing and result
        """
        start_time = time.perf_counter()

        try:
            if not self._intent_router:
                await self.initialize()

            # Generate conversation ID if not provided
            conv_id = conversation_id or str(uuid4())

            # Create routing context
            routing_context = RoutingContext(
                conversation_id=conv_id,
                user_id=ctx.user_id,
                tenant_id=ctx.tenant_id,
            )

            # Route intent to agent
            resolution = await self._intent_router.resolve_intent(
                message, routing_context
            )

            # Get agent details
            agent_id = resolution.agent_id
            agent_name = resolution.agent_name
            intent_hint = (
                resolution.routing_result.matched_intent_id or "unknown"
            )
            confidence = resolution.routing_result.confidence

            # Execute agent if requested (for now, just return routing info)
            # In production, this would execute the agent workflow
            response_text = (
                f"Routed your message to {agent_name} "
                f"(intent: {intent_hint}, confidence: {confidence:.2f}).\n\n"
                "Agent routing complete. Ready for execution."
            )

            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)

            return {
                "success": True,
                "response": response_text,
                "conversation_id": conv_id,
                "primary_agent": agent_name,
                "agent_id": agent_id,
                "agents_used": [agent_name],
                "intent": intent_hint,
                "confidence": confidence,
                "cost": 0.0,  # TODO: Calculate actual cost
                "latency_ms": latency_ms,
            }

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            self.logger.error(
                "Failed to process message",
                message=message[:100],
                error=str(e),
                exc_info=True,
            )
            raise

    async def execute_with_agent(
        self,
        ctx: ServiceContext,
        message: str,
        agent_id: str,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute a message with a specific agent.

        Args:
            ctx: Service context
            message: User message
            agent_id: Agent identifier
            conversation_id: Optional conversation ID
            context: Optional context

        Returns:
            Execution result
        """
        start_time = time.perf_counter()

        try:
            if not self._agent_service:
                await self.initialize()

            # Execute agent
            result = await self._agent_service.execute_agent(
                ctx=ctx,
                agent_id=agent_id,
                task=message,
                context=context,
            )

            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)

            return {
                "success": True,
                "conversation_id": conversation_id or str(uuid4()),
                "agent_id": agent_id,
                "result": result,
                "latency_ms": latency_ms,
            }

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            self.logger.error(
                "Failed to execute with agent",
                agent_id=agent_id,
                error=str(e),
                exc_info=True,
            )
            raise


# Global service instance
_chat_service: Optional[ChatService] = None


async def get_chat_service() -> ChatService:
    """Get global chat service instance."""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
        await _chat_service.initialize()
    return _chat_service
