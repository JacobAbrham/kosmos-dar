"""
Unit tests for ChatService.

Tests chat service layer functionality.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from services.chat_service import ChatService
from services.base import ServiceContext


@pytest.fixture
def service_context():
    """Create service context."""
    return ServiceContext(
        tenant_id=str(uuid4()),
        user_id=str(uuid4()),
        session_id=str(uuid4())
    )


@pytest.fixture
def chat_service():
    """Create chat service instance."""
    service = ChatService()
    service._intent_router = AsyncMock()
    service._agent_registry = AsyncMock()
    return service


@pytest.mark.asyncio
async def test_process_message(chat_service, service_context):
    """Test processing a chat message."""
    chat_service._intent_router.route.return_value = {
        "agent_id": "athena",
        "confidence": 0.95
    }

    agent = MagicMock()
    agent.process = AsyncMock(return_value={"response": "Test response"})
    chat_service._agent_registry.get_agent.return_value = agent

    result = await chat_service.process_message(
        service_context,
        "What is the weather?",
        conversation_id=str(uuid4())
    )

    assert "response" in result
    assert result["response"] == "Test response"
    assert "agent_id" in result


@pytest.mark.asyncio
async def test_execute_with_agent(chat_service, service_context):
    """Test executing message with specific agent."""
    agent = MagicMock()
    agent.process = AsyncMock(return_value={"response": "Test response"})
    chat_service._agent_registry.get_agent.return_value = agent

    result = await chat_service.execute_with_agent(
        service_context,
        "athena",
        "What is the weather?",
        conversation_id=str(uuid4())
    )

    assert "response" in result
    assert result["response"] == "Test response"
    assert result["agent_id"] == "athena"
