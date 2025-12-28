"""KOSMOS V2.0 Chat API

This is a lightweight chat façade used by the web UI.

The current backend focuses on routing + tool registry. The UI expects a
single /api/v1/chat endpoint, so we provide a small shim that:
- Resolves the intent to a primary agent
- Returns a deterministic response payload compatible with the frontend
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from core.intent_router import IntentRouter, get_intent_router
from core.semantic_router import RoutingContext
from core.auth import get_current_user


router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    response: str
    primary_agent: str
    agents_used: List[str]
    cost: float = 0.0
    conversation_id: str


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse, include_in_schema=False)
async def chat(
    request: ChatRequest,
    intent_router: IntentRouter = Depends(get_intent_router),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ChatResponse:
    """Send a message to KOSMOS.

    Note: This endpoint currently does not execute external LLM calls.
    It resolves the user's intent to a primary agent and returns a
    structured response for the frontend.

    Requires authentication via Bearer token.
    """

    conversation_id = request.conversation_id or str(uuid4())
    routing_context = RoutingContext(
        conversation_id=conversation_id,
        user_id=current_user.get("user_id"),
        tenant_id=current_user.get("tenant_id")
    )

    resolution = await intent_router.resolve_intent(request.message, routing_context)

    intent_hint = resolution.routing_result.matched_intent_id or "unknown"
    response_text = (
        f"Routed your message to {resolution.agent_name} "
        f"(intent: {intent_hint}, confidence: {resolution.routing_result.confidence:.2f}).\n\n"
        "This environment is running in demo mode: routing + tool discovery are active, "
        "but no external LLM response generation is configured by default."
    )

    # Keep compatibility with the frontend payload shape.
    return ChatResponse(
        response=response_text,
        primary_agent=resolution.agent_name,
        agents_used=[resolution.agent_name],
        cost=0.0,
        conversation_id=conversation_id,
    )
