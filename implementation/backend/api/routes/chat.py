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
from core.dependencies import get_chat_service_dependency, get_service_context_dep
from services.chat_service import ChatService
from services.base import ServiceContext


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
    http_request: Request,
    chat_service: ChatService = Depends(get_chat_service_dependency),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ChatResponse:
    """Send a message to KOSMOS.

    Uses ChatService for clean separation of concerns.
    Routes intent to appropriate agent and returns structured response.

    Requires authentication via Bearer token.
    """
    # Create service context from current user
    ctx = ServiceContext(
        tenant_id=current_user.get("tenant_id"),
        user_id=current_user.get("user_id"),
    )

    # Process message through service layer
    result = await chat_service.process_message(
        ctx=ctx,
        message=request.message,
        conversation_id=request.conversation_id,
        context=request.context,
    )

    # Return response in expected format
    return ChatResponse(
        response=result["response"],
        primary_agent=result["primary_agent"],
        agents_used=result["agents_used"],
        cost=result["cost"],
        conversation_id=result["conversation_id"],
    )
