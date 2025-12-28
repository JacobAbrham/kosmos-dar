"""
KOSMOS V2.0 SDUI WebSocket Transport

WebSocket handler for real-time SDUI communication.
"""

import asyncio
import json
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect
import structlog

from sdui.controller import SDUIController, get_sdui_controller
from sdui.protocol import SDUIEvent, SDUIAction, ActionType

logger = structlog.get_logger()


class SDUIWebSocketManager:
    """
    Manages WebSocket connections for SDUI.

    Features:
    - Connection lifecycle management
    - Session binding
    - Message routing
    - Heartbeat/keepalive
    - Reconnection support
    """

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.session_to_websocket: Dict[str, str] = {}  # session_id -> connection_id
        self.websocket_to_session: Dict[str, str] = {}  # connection_id -> session_id
        self._heartbeat_tasks: Dict[str, asyncio.Task] = {}
        self.logger = logger.bind(component="SDUIWebSocketManager")

    async def connect(
        self,
        websocket: WebSocket,
        connection_id: str,
        session_id: Optional[str] = None
    ) -> str:
        """Accept a new WebSocket connection."""
        await websocket.accept()

        self.active_connections[connection_id] = websocket

        if session_id:
            self.session_to_websocket[session_id] = connection_id
            self.websocket_to_session[connection_id] = session_id

        # Start heartbeat
        self._heartbeat_tasks[connection_id] = asyncio.create_task(
            self._heartbeat_loop(connection_id)
        )

        self.logger.info(
            f"WebSocket connected: {connection_id}",
            session_id=session_id,
            total_connections=len(self.active_connections)
        )

        return connection_id

    async def disconnect(self, connection_id: str) -> None:
        """Disconnect a WebSocket."""
        # Cancel heartbeat
        if connection_id in self._heartbeat_tasks:
            self._heartbeat_tasks[connection_id].cancel()
            del self._heartbeat_tasks[connection_id]

        # Clean up session mapping
        if connection_id in self.websocket_to_session:
            session_id = self.websocket_to_session[connection_id]
            del self.websocket_to_session[connection_id]
            if session_id in self.session_to_websocket:
                del self.session_to_websocket[session_id]

        # Remove connection
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]

        self.logger.info(
            f"WebSocket disconnected: {connection_id}",
            total_connections=len(self.active_connections)
        )

    async def send_message(
        self,
        connection_id: str,
        message: str
    ) -> bool:
        """Send a message to a specific connection."""
        websocket = self.active_connections.get(connection_id)
        if websocket:
            try:
                await websocket.send_text(message)
                return True
            except Exception as e:
                self.logger.error(f"Failed to send message: {e}")
                await self.disconnect(connection_id)
        return False

    async def send_to_session(
        self,
        session_id: str,
        message: str
    ) -> bool:
        """Send a message to a session's WebSocket."""
        connection_id = self.session_to_websocket.get(session_id)
        if connection_id:
            return await self.send_message(connection_id, message)
        return False

    async def broadcast(
        self,
        message: str,
        exclude: Optional[Set[str]] = None
    ) -> int:
        """Broadcast a message to all connections."""
        exclude = exclude or set()
        sent_count = 0

        for connection_id in list(self.active_connections.keys()):
            if connection_id not in exclude:
                if await self.send_message(connection_id, message):
                    sent_count += 1

        return sent_count

    async def _heartbeat_loop(
        self,
        connection_id: str,
        interval: int = 30
    ) -> None:
        """Send periodic heartbeat pings."""
        try:
            while True:
                await asyncio.sleep(interval)
                websocket = self.active_connections.get(connection_id)
                if websocket:
                    try:
                        await websocket.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
                    except Exception:
                        await self.disconnect(connection_id)
                        break
                else:
                    break
        except asyncio.CancelledError:
            pass

    def get_connection_count(self) -> int:
        """Get active connection count."""
        return len(self.active_connections)

    def get_session_connection(self, session_id: str) -> Optional[str]:
        """Get connection ID for a session."""
        return self.session_to_websocket.get(session_id)


# Global WebSocket manager
_ws_manager: Optional[SDUIWebSocketManager] = None


def get_ws_manager() -> SDUIWebSocketManager:
    """Get the global WebSocket manager."""
    global _ws_manager
    if _ws_manager is None:
        _ws_manager = SDUIWebSocketManager()
    return _ws_manager


async def handle_sdui_websocket(
    websocket: WebSocket,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None
):
    """
    FastAPI WebSocket endpoint handler for SDUI.

    Usage in FastAPI:
        @app.websocket("/ws/sdui")
        async def sdui_websocket(websocket: WebSocket):
            await handle_sdui_websocket(websocket)
    """
    import uuid

    ws_manager = get_ws_manager()
    controller = await get_sdui_controller()

    connection_id = str(uuid.uuid4())[:8]

    # Create SDUI session with WebSocket send callback
    async def send_callback(message: str):
        await ws_manager.send_message(connection_id, message)

    session = controller.create_session(
        user_id=user_id,
        tenant_id=tenant_id,
        send_callback=send_callback
    )

    try:
        # Accept connection
        await ws_manager.connect(
            websocket,
            connection_id,
            session.session_id
        )

        # Send initial welcome message
        await websocket.send_json({
            "type": "connected",
            "session_id": session.session_id,
            "connection_id": connection_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Main message loop
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                await _handle_client_message(
                    controller,
                    session.session_id,
                    message
                )

            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON"
                })

    except WebSocketDisconnect:
        pass

    finally:
        await ws_manager.disconnect(connection_id)
        controller.close_session(session.session_id)


async def _handle_client_message(
    controller: SDUIController,
    session_id: str,
    message: Dict[str, Any]
) -> None:
    """Handle incoming client messages."""
    msg_type = message.get("type")

    if msg_type == "event":
        # Handle component event
        event = SDUIEvent(
            type=message.get("event_type", "click"),
            component_id=message.get("component_id", ""),
            action=SDUIAction(**message["action"]) if message.get("action") else None,
            value=message.get("value"),
            metadata=message.get("metadata", {})
        )
        await controller.handle_event(session_id, event)

    elif msg_type == "action":
        # Handle direct action
        action = SDUIAction(
            type=ActionType(message.get("action_type", "custom")),
            target=message.get("target"),
            payload=message.get("payload")
        )
        session = controller.get_session(session_id)
        if session:
            await controller._handle_action(session, action)

    elif msg_type == "state_update":
        # Handle state update from client
        key = message.get("key")
        value = message.get("value")
        if key:
            session = controller.get_session(session_id)
            if session:
                session.state[key] = value

    elif msg_type == "render_request":
        # Client requests a layout render
        from sdui.protocol import LayoutType
        layout_type = LayoutType(message.get("layout_type", "chat"))
        data = message.get("data", {})
        await controller.render_layout(session_id, layout_type, data)

    elif msg_type == "pong":
        # Heartbeat response
        session = controller.get_session(session_id)
        if session:
            session.last_activity = datetime.utcnow()


# FastAPI Router for SDUI WebSocket
def create_sdui_websocket_router():
    """Create FastAPI router with SDUI WebSocket endpoint."""
    from fastapi import APIRouter, Query

    router = APIRouter(tags=["sdui-ws"])

    @router.websocket("/ws/sdui")
    async def sdui_websocket_endpoint(
        websocket: WebSocket,
        user_id: Optional[str] = Query(None),
        tenant_id: Optional[str] = Query(None)
    ):
        await handle_sdui_websocket(websocket, user_id, tenant_id)

    @router.get("/ws/sdui/status")
    async def websocket_status():
        """Get WebSocket connection status."""
        ws_manager = get_ws_manager()
        controller = await get_sdui_controller()

        return {
            "active_connections": ws_manager.get_connection_count(),
            "active_sessions": len(controller.sessions),
            "active_streams": len(controller._active_streams)
        }

    return router
