"""
Integration tests for API endpoints.

Tests API routes with service layer integration.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mock_auth():
    """Mock authentication."""
    with patch("core.middleware.validate_jwt_token") as mock:
        mock.return_value = {
            "sub": "user-123",
            "tenant_id": "tenant-123",
            "email": "test@test.com"
        }
        yield mock


@pytest.mark.asyncio
def test_list_agents_endpoint(client, mock_auth):
    """Test GET /api/v1/agents endpoint."""
    with patch("services.agent_service.get_agent_service") as mock_service:
        mock_service.return_value.list_agents = AsyncMock(return_value=[
            {
                "id": "athena",
                "name": "Athena",
                "domain": "Knowledge",
                "description": "Knowledge agent"
            }
        ])

        response = client.get("/api/v1/agents")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "athena"


@pytest.mark.asyncio
def test_get_agent_endpoint(client, mock_auth):
    """Test GET /api/v1/agents/{agent_id} endpoint."""
    with patch("services.agent_service.get_agent_service") as mock_service:
        mock_service.return_value.get_agent = AsyncMock(return_value={
            "id": "athena",
            "name": "Athena",
            "domain": "Knowledge"
        })

        response = client.get("/api/v1/agents/athena")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "athena"


@pytest.mark.asyncio
def test_chat_endpoint(client, mock_auth):
    """Test POST /api/v1/chat endpoint."""
    with patch("services.chat_service.get_chat_service") as mock_service:
        mock_service.return_value.process_message = AsyncMock(return_value={
            "response": "Test response",
            "agent_id": "athena"
        })

        response = client.post(
            "/api/v1/chat",
            json={
                "message": "What is the weather?",
                "conversation_id": "conv-123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["agent_id"] == "athena"


@pytest.mark.asyncio
def test_health_endpoint(client):
    """Test GET /health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
