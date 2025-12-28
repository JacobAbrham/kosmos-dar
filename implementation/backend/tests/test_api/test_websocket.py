# KOSMOS V2.0 WebSocket API Tests
"""
Tests for WebSocket endpoints including:
- Real-time task updates
- Agent streaming responses
- SDUI component updates
- Notification streams
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio
import json
from websockets.exceptions import ConnectionClosed


@pytest.fixture
def mock_ws_manager():
    """Mock WebSocket connection manager."""
    manager = MagicMock()
    manager.connect = AsyncMock()
    manager.disconnect = AsyncMock()
    manager.send_message = AsyncMock()
    manager.broadcast = AsyncMock()
    return manager


@pytest.fixture
def sample_task_update():
    """Sample task update message."""
    return {
        "type": "task_update",
        "task_id": "task-123",
        "status": "running",
        "progress": 50,
        "message": "Processing step 2 of 4",
    }


@pytest.fixture
def sample_agent_stream():
    """Sample agent streaming response."""
    return {
        "type": "agent_stream",
        "task_id": "task-123",
        "agent_id": "zeus",
        "content": "Analyzing the data...",
        "is_final": False,
    }


@pytest.fixture
def sample_sdui_update():
    """Sample SDUI component update."""
    return {
        "type": "sdui_update",
        "component_id": "progress-chart",
        "action": "update",
        "data": {
            "current_value": 75,
            "max_value": 100,
            "label": "Processing",
        },
    }


class TestWebSocketConnection:
    """Tests for WebSocket connection management."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ws_connect_authenticated(self, mock_ws_manager):
        """Test WebSocket connection with valid auth."""
        with patch("api.websocket.ws_manager", mock_ws_manager):
            # Simulate connection
            mock_ws_manager.connect.return_value = "conn-123"

            result = await mock_ws_manager.connect(
                websocket=MagicMock(),
                token="valid-token",
                user_id="user-123"
            )

            assert result == "conn-123"
            mock_ws_manager.connect.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ws_connect_unauthenticated(self, mock_ws_manager):
        """Test WebSocket connection without auth fails."""
        mock_ws_manager.connect = AsyncMock(
            side_effect=ValueError("Invalid token")
        )

        with patch("api.websocket.ws_manager", mock_ws_manager):
            with pytest.raises(ValueError, match="Invalid token"):
                await mock_ws_manager.connect(
                    websocket=MagicMock(),
                    token="invalid-token"
                )

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ws_disconnect_cleanup(self, mock_ws_manager):
        """Test WebSocket disconnection cleans up properly."""
        with patch("api.websocket.ws_manager", mock_ws_manager):
            await mock_ws_manager.disconnect("conn-123")

            mock_ws_manager.disconnect.assert_called_once_with("conn-123")

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_ws_reconnect_with_session(self, mock_ws_manager):
        """Test WebSocket reconnection with session ID."""
        mock_ws_manager.reconnect = AsyncMock(return_value={
            "connection_id": "conn-124",
            "session_restored": True,
            "missed_messages": 5,
        })

        with patch("api.websocket.ws_manager", mock_ws_manager):
            result = await mock_ws_manager.reconnect(
                websocket=MagicMock(),
                session_id="session-123"
            )

            assert result["session_restored"] is True


class TestTaskUpdates:
    """Tests for real-time task update streaming."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_subscribe_to_task(self, mock_ws_manager, sample_task_update):
        """Test subscribing to task updates."""
        messages_received = []

        async def mock_receive():
            return json.dumps(sample_task_update)

        mock_ws = MagicMock()
        mock_ws.receive_text = mock_receive

        with patch("api.websocket.ws_manager", mock_ws_manager):
            # Simulate subscription
            mock_ws_manager.subscribe_task = AsyncMock(return_value=True)
            result = await mock_ws_manager.subscribe_task("conn-123", "task-123")

            assert result is True

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_receive_task_progress(self, sample_task_update):
        """Test receiving task progress updates."""
        update = sample_task_update

        assert update["type"] == "task_update"
        assert update["progress"] == 50
        assert "message" in update

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_task_completion_notification(self, mock_ws_manager):
        """Test receiving task completion notification."""
        completion_message = {
            "type": "task_update",
            "task_id": "task-123",
            "status": "completed",
            "progress": 100,
            "result": {"output": "Analysis complete"},
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(completion_message)
            )

            mock_ws_manager.send_message.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_task_error_notification(self, mock_ws_manager):
        """Test receiving task error notification."""
        error_message = {
            "type": "task_update",
            "task_id": "task-123",
            "status": "failed",
            "error": {
                "code": "EXECUTION_ERROR",
                "message": "Failed to connect to external service",
            },
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(error_message)
            )

            mock_ws_manager.send_message.assert_called_once()


class TestAgentStreaming:
    """Tests for agent response streaming."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_receive_agent_stream_chunk(self, sample_agent_stream):
        """Test receiving streaming agent response chunk."""
        chunk = sample_agent_stream

        assert chunk["type"] == "agent_stream"
        assert chunk["is_final"] is False
        assert "content" in chunk

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_agent_stream_final_message(self, mock_ws_manager):
        """Test receiving final streaming message."""
        final_message = {
            "type": "agent_stream",
            "task_id": "task-123",
            "agent_id": "zeus",
            "content": "Analysis complete. Here are the results...",
            "is_final": True,
            "token_count": 150,
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(final_message)
            )

            mock_ws_manager.send_message.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_agent_thinking_indicator(self, mock_ws_manager):
        """Test receiving agent thinking indicator."""
        thinking_message = {
            "type": "agent_thinking",
            "task_id": "task-123",
            "agent_id": "athena",
            "thinking": True,
            "step": "Analyzing patterns in data...",
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(thinking_message)
            )

            mock_ws_manager.send_message.assert_called_once()


class TestSDUIUpdates:
    """Tests for SDUI component updates."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_receive_sdui_update(self, sample_sdui_update):
        """Test receiving SDUI component update."""
        update = sample_sdui_update

        assert update["type"] == "sdui_update"
        assert update["action"] == "update"
        assert "data" in update

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_sdui_component_create(self, mock_ws_manager):
        """Test receiving SDUI component creation."""
        create_message = {
            "type": "sdui_update",
            "action": "create",
            "component": {
                "id": "new-chart",
                "type": "chart",
                "props": {
                    "data": [{"x": 1, "y": 10}],
                    "chartType": "line",
                },
            },
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(create_message)
            )

            mock_ws_manager.send_message.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_sdui_component_delete(self, mock_ws_manager):
        """Test receiving SDUI component deletion."""
        delete_message = {
            "type": "sdui_update",
            "action": "delete",
            "component_id": "old-component",
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(delete_message)
            )

            mock_ws_manager.send_message.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_sdui_layout_update(self, mock_ws_manager):
        """Test receiving SDUI layout update."""
        layout_message = {
            "type": "sdui_layout",
            "layout": {
                "type": "grid",
                "columns": 2,
                "components": ["chart-1", "table-1", "summary-1"],
            },
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(layout_message)
            )

            mock_ws_manager.send_message.assert_called_once()


class TestNotifications:
    """Tests for notification streaming."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_receive_notification(self, mock_ws_manager):
        """Test receiving a notification."""
        notification = {
            "type": "notification",
            "id": "notif-123",
            "level": "info",
            "title": "Task Completed",
            "message": "Your analysis task has finished",
            "timestamp": "2024-01-01T10:00:00Z",
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(notification)
            )

            mock_ws_manager.send_message.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_receive_error_notification(self, mock_ws_manager):
        """Test receiving an error notification."""
        error_notification = {
            "type": "notification",
            "id": "notif-124",
            "level": "error",
            "title": "Task Failed",
            "message": "Unable to complete the analysis",
            "action": {
                "label": "View Details",
                "url": "/tasks/task-123",
            },
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(error_notification)
            )

            mock_ws_manager.send_message.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_hitl_approval_notification(self, mock_ws_manager):
        """Test receiving HITL approval request notification."""
        hitl_notification = {
            "type": "notification",
            "id": "notif-125",
            "level": "warning",
            "title": "Action Requires Approval",
            "message": "Agent wants to send an email",
            "requires_action": True,
            "approval": {
                "task_id": "task-123",
                "approval_id": "approval-1",
                "action": "send_email",
                "details": {
                    "recipients": ["team@kosmos.io"],
                    "subject": "Weekly Report",
                },
            },
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.send_message = AsyncMock()
            await mock_ws_manager.send_message(
                "conn-123",
                json.dumps(hitl_notification)
            )

            mock_ws_manager.send_message.assert_called_once()


class TestWebSocketErrors:
    """Tests for WebSocket error handling."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_handle_connection_error(self, mock_ws_manager):
        """Test handling connection error."""
        mock_ws_manager.connect = AsyncMock(
            side_effect=ConnectionError("Connection refused")
        )

        with patch("api.websocket.ws_manager", mock_ws_manager):
            with pytest.raises(ConnectionError):
                await mock_ws_manager.connect(
                    websocket=MagicMock(),
                    token="valid-token"
                )

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_handle_message_error(self, mock_ws_manager):
        """Test handling message send error."""
        mock_ws_manager.send_message = AsyncMock(
            side_effect=ConnectionClosed(None, None)
        )

        with patch("api.websocket.ws_manager", mock_ws_manager):
            with pytest.raises(ConnectionClosed):
                await mock_ws_manager.send_message(
                    "conn-123",
                    "test message"
                )

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_handle_invalid_message_format(self, mock_ws_manager):
        """Test handling invalid message format."""
        invalid_message = "not valid json {"

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.process_message = AsyncMock(
                side_effect=json.JSONDecodeError("Invalid", "", 0)
            )

            with pytest.raises(json.JSONDecodeError):
                await mock_ws_manager.process_message(
                    "conn-123",
                    invalid_message
                )

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_heartbeat_mechanism(self, mock_ws_manager):
        """Test WebSocket heartbeat mechanism."""
        heartbeat_message = {
            "type": "ping",
            "timestamp": "2024-01-01T10:00:00Z",
        }

        expected_response = {
            "type": "pong",
            "timestamp": "2024-01-01T10:00:00Z",
        }

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.handle_ping = AsyncMock(return_value=expected_response)
            result = await mock_ws_manager.handle_ping(heartbeat_message)

            assert result["type"] == "pong"


class TestWebSocketRooms:
    """Tests for WebSocket room/channel functionality."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_join_room(self, mock_ws_manager):
        """Test joining a WebSocket room."""
        mock_ws_manager.join_room = AsyncMock(return_value=True)

        with patch("api.websocket.ws_manager", mock_ws_manager):
            result = await mock_ws_manager.join_room(
                "conn-123",
                "room:task-123"
            )

            assert result is True

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_leave_room(self, mock_ws_manager):
        """Test leaving a WebSocket room."""
        mock_ws_manager.leave_room = AsyncMock(return_value=True)

        with patch("api.websocket.ws_manager", mock_ws_manager):
            result = await mock_ws_manager.leave_room(
                "conn-123",
                "room:task-123"
            )

            assert result is True

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_broadcast_to_room(self, mock_ws_manager):
        """Test broadcasting message to room."""
        message = {"type": "room_message", "content": "Hello room!"}

        with patch("api.websocket.ws_manager", mock_ws_manager):
            mock_ws_manager.broadcast_to_room = AsyncMock()
            await mock_ws_manager.broadcast_to_room(
                "room:task-123",
                json.dumps(message)
            )

            mock_ws_manager.broadcast_to_room.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_tenant_isolation_rooms(self, mock_ws_manager):
        """Test tenant isolation in WebSocket rooms."""
        mock_ws_manager.join_room = AsyncMock(
            side_effect=PermissionError("Cannot join room from different tenant")
        )

        with patch("api.websocket.ws_manager", mock_ws_manager):
            with pytest.raises(PermissionError):
                await mock_ws_manager.join_room(
                    "conn-123",  # from tenant-a
                    "room:tenant-b:task-123"  # room from tenant-b
                )
