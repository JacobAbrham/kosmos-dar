"""
KOSMOS V2.0 SDUI Controller

Main controller for Server-Driven UI operations.
Orchestrates layout generation, component hydration, and message dispatch.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set
import json
import uuid

import structlog

from sdui.protocol import (
    SDUIMessage,
    SDUIMessageType,
    SDUIComponent,
    SDUILayout,
    SDUISlot,
    SDUIStyle,
    SDUIAction,
    SDUIEvent,
    ComponentType,
    LayoutType,
    ActionType,
    AnimationType,
    component,
    text,
    heading,
    card,
    button,
    flex,
    grid,
)
from sdui.layouts import LayoutEngine
from sdui.components import ComponentRegistry

logger = structlog.get_logger()


@dataclass
class SDUISession:
    """Represents a client SDUI session."""
    session_id: str
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    current_layout: Optional[SDUILayout] = None
    state: Dict[str, Any] = field(default_factory=dict)
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)

    # WebSocket send callback
    send_callback: Optional[Callable] = None


class SDUIController:
    """
    Central controller for Server-Driven UI operations.

    Features:
    - Intent-to-Layout (I2L) transformation
    - Component hydration with data
    - Real-time updates via WebSocket
    - Streaming support for LLM responses
    - Session management
    - State synchronization
    """

    _instance: Optional['SDUIController'] = None

    def __new__(cls) -> 'SDUIController':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.layout_engine = LayoutEngine()
        self.component_registry = ComponentRegistry()

        # Session management
        self.sessions: Dict[str, SDUISession] = {}

        # Event handlers
        self._event_handlers: Dict[str, Callable] = {}

        # Streaming state
        self._active_streams: Dict[str, Dict[str, Any]] = {}

        self.logger = logger.bind(component="SDUIController")
        self._initialized = True

    # =========================================================================
    # Session Management
    # =========================================================================

    def create_session(
        self,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        send_callback: Optional[Callable] = None
    ) -> SDUISession:
        """Create a new SDUI session."""
        session_id = str(uuid.uuid4())
        session = SDUISession(
            session_id=session_id,
            user_id=user_id,
            tenant_id=tenant_id,
            send_callback=send_callback
        )
        self.sessions[session_id] = session
        self.logger.info(f"Created SDUI session: {session_id}")
        return session

    def get_session(self, session_id: str) -> Optional[SDUISession]:
        """Get a session by ID."""
        return self.sessions.get(session_id)

    def close_session(self, session_id: str) -> bool:
        """Close a session."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            self.logger.info(f"Closed SDUI session: {session_id}")
            return True
        return False

    # =========================================================================
    # Layout Generation
    # =========================================================================

    async def render_layout(
        self,
        session_id: str,
        layout_type: LayoutType,
        data: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> SDUIMessage:
        """
        Render a layout and send it to the client.

        Args:
            session_id: Target session
            layout_type: Type of layout to render
            data: Data to hydrate the layout with
            **kwargs: Additional layout parameters

        Returns:
            The SDUI message that was sent
        """
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        # Generate layout based on type
        layout = self._generate_layout(layout_type, data or {}, **kwargs)

        # Update session state
        session.current_layout = layout
        session.last_activity = datetime.utcnow()

        # Create and send message
        message = SDUIMessage(
            type=SDUIMessageType.RENDER,
            layout=layout
        )

        await self._send_message(session, message)
        return message

    def _generate_layout(
        self,
        layout_type: LayoutType,
        data: Dict[str, Any],
        **kwargs
    ) -> SDUILayout:
        """Generate a layout from type and data."""
        if layout_type == LayoutType.CHAT:
            return self.layout_engine.layout_for_chat(
                messages=data.get("messages", []),
                agent_name=data.get("agent_name"),
                suggestions=data.get("suggestions")
            )
        elif layout_type == LayoutType.DASHBOARD:
            return self.layout_engine.layout_for_dashboard(
                widgets=data.get("widgets", []),
                title=data.get("title", "Dashboard")
            )
        elif layout_type == LayoutType.FORM:
            return self.layout_engine.layout_for_form(
                fields=data.get("fields", []),
                title=data.get("title", "Form"),
                submit_label=data.get("submit_label", "Submit"),
                submit_action=data.get("submit_action")
            )
        elif layout_type == LayoutType.LIST_DETAIL:
            return self.layout_engine.layout_for_list(
                items=data.get("items", []),
                title=data.get("title", "Items"),
                detail_content=data.get("detail_content")
            )
        elif layout_type == LayoutType.KANBAN:
            return self.layout_engine.layout_for_kanban(
                columns=data.get("columns", []),
                title=data.get("title", "Board")
            )
        elif layout_type == LayoutType.TIMELINE:
            return self.layout_engine.layout_for_timeline(
                events=data.get("events", []),
                title=data.get("title", "Timeline")
            )
        elif layout_type == LayoutType.ANALYTICS:
            return self.layout_engine.layout_for_analytics(
                metrics=data.get("metrics", []),
                charts=data.get("charts", []),
                title=data.get("title", "Analytics")
            )
        elif layout_type == LayoutType.CONFIRMATION:
            return self.layout_engine.layout_for_confirmation(
                title=data.get("title", "Confirm"),
                message=data.get("message", "Are you sure?"),
                confirm_action=data.get("confirm_action", SDUIAction(type=ActionType.SUBMIT)),
                severity=data.get("severity", "warning")
            )
        elif layout_type == LayoutType.ERROR:
            return self.layout_engine.layout_for_error(
                title=data.get("title", "Error"),
                message=data.get("message", "An error occurred"),
                retry_action=data.get("retry_action")
            )
        elif layout_type == LayoutType.LOADING:
            return self.layout_engine.layout_for_loading(
                message=data.get("message", "Loading..."),
                progress=data.get("progress")
            )
        elif layout_type == LayoutType.EMPTY:
            return self.layout_engine.layout_for_empty(
                title=data.get("title", "No items"),
                message=data.get("message", "Nothing here yet"),
                action=data.get("action")
            )
        else:
            # Generic layout
            return self.layout_engine.create_layout(
                layout_type,
                title=data.get("title"),
                subtitle=data.get("subtitle")
            )

    # =========================================================================
    # Component Updates
    # =========================================================================

    async def update_component(
        self,
        session_id: str,
        component_id: str,
        props: Optional[Dict[str, Any]] = None,
        children: Optional[List[SDUIComponent]] = None,
        style: Optional[SDUIStyle] = None
    ) -> SDUIMessage:
        """Update a specific component."""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        message = SDUIMessage(
            type=SDUIMessageType.UPDATE,
            target_id=component_id,
            metadata={
                "props": props,
                "children": [c.to_dict() for c in children] if children else None,
                "style": style.to_dict() if style else None
            }
        )

        await self._send_message(session, message)
        return message

    async def patch_component(
        self,
        session_id: str,
        component_id: str,
        operation: str,
        component: SDUIComponent
    ) -> SDUIMessage:
        """
        Patch a component with an operation.

        Operations: 'replace', 'append', 'prepend', 'remove'
        """
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        message = SDUIMessage(
            type=SDUIMessageType.PATCH,
            target_id=component_id,
            operation=operation,
            component=component
        )

        await self._send_message(session, message)
        return message

    async def append_to_slot(
        self,
        session_id: str,
        slot_name: str,
        components: List[SDUIComponent]
    ) -> SDUIMessage:
        """Append components to a layout slot."""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        message = SDUIMessage(
            type=SDUIMessageType.UPDATE,
            target_id=f"slot:{slot_name}",
            operation="append",
            components=components
        )

        await self._send_message(session, message)
        return message

    # =========================================================================
    # Streaming Support
    # =========================================================================

    async def start_stream(
        self,
        session_id: str,
        component_id: str,
        stream_type: str = "text"
    ) -> str:
        """Start a streaming update to a component."""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        stream_id = str(uuid.uuid4())[:8]

        self._active_streams[stream_id] = {
            "session_id": session_id,
            "component_id": component_id,
            "stream_type": stream_type,
            "started_at": datetime.utcnow(),
            "chunks": []
        }

        message = SDUIMessage(
            type=SDUIMessageType.STREAM_START,
            stream_id=stream_id,
            target_id=component_id,
            metadata={"stream_type": stream_type}
        )

        await self._send_message(session, message)
        return stream_id

    async def stream_chunk(
        self,
        stream_id: str,
        chunk: str
    ) -> None:
        """Send a chunk in a stream."""
        stream = self._active_streams.get(stream_id)
        if not stream:
            raise ValueError(f"Stream not found: {stream_id}")

        session = self.get_session(stream["session_id"])
        if not session:
            return

        stream["chunks"].append(chunk)

        message = SDUIMessage(
            type=SDUIMessageType.STREAM_CHUNK,
            stream_id=stream_id,
            chunk=chunk
        )

        await self._send_message(session, message)

    async def end_stream(
        self,
        stream_id: str,
        final_component: Optional[SDUIComponent] = None
    ) -> None:
        """End a stream."""
        stream = self._active_streams.get(stream_id)
        if not stream:
            return

        session = self.get_session(stream["session_id"])
        if session:
            message = SDUIMessage(
                type=SDUIMessageType.STREAM_END,
                stream_id=stream_id,
                component=final_component
            )
            await self._send_message(session, message)

        del self._active_streams[stream_id]

    # =========================================================================
    # Modals and Drawers
    # =========================================================================

    async def show_modal(
        self,
        session_id: str,
        modal_id: str,
        title: str,
        content: List[SDUIComponent],
        size: str = "md",
        actions: Optional[List[SDUIComponent]] = None
    ) -> SDUIMessage:
        """Show a modal dialog."""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        modal_component = (
            component(ComponentType.MODAL)
            .id(modal_id)
            .props(title=title, open=True, size=size, closeable=True)
            .children(*content)
            .glass()
            .animate(AnimationType.SCALE)
            .build()
        )

        if actions:
            modal_component.children.append(
                flex(*actions, direction="row", gap="1rem")
            )

        message = SDUIMessage(
            type=SDUIMessageType.MODAL,
            modal_id=modal_id,
            component=modal_component
        )

        await self._send_message(session, message)
        return message

    async def close_modal(
        self,
        session_id: str,
        modal_id: str
    ) -> None:
        """Close a modal."""
        session = self.get_session(session_id)
        if not session:
            return

        message = SDUIMessage(
            type=SDUIMessageType.MODAL,
            modal_id=modal_id,
            metadata={"open": False}
        )

        await self._send_message(session, message)

    async def show_drawer(
        self,
        session_id: str,
        drawer_id: str,
        title: str,
        content: List[SDUIComponent],
        side: str = "right",
        width: str = "400px"
    ) -> SDUIMessage:
        """Show a drawer panel."""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        drawer_component = (
            component(ComponentType.DRAWER)
            .id(drawer_id)
            .props(title=title, open=True, side=side, width=width)
            .children(*content)
            .glass()
            .animate(AnimationType.SLIDE_LEFT if side == "right" else AnimationType.SLIDE_RIGHT)
            .build()
        )

        message = SDUIMessage(
            type=SDUIMessageType.DRAWER,
            drawer_id=drawer_id,
            component=drawer_component
        )

        await self._send_message(session, message)
        return message

    # =========================================================================
    # Toast Notifications
    # =========================================================================

    async def show_toast(
        self,
        session_id: str,
        message: str,
        severity: str = "info",
        duration: int = 5000,
        action: Optional[SDUIAction] = None
    ) -> None:
        """Show a toast notification."""
        session = self.get_session(session_id)
        if not session:
            return

        sdui_message = SDUIMessage(
            type=SDUIMessageType.TOAST,
            message=message,
            severity=severity,
            duration=duration,
            metadata={"action": action.to_dict() if action else None}
        )

        await self._send_message(session, sdui_message)

    # =========================================================================
    # State Management
    # =========================================================================

    async def set_state(
        self,
        session_id: str,
        key: str,
        value: Any
    ) -> None:
        """Set a state value and sync with client."""
        session = self.get_session(session_id)
        if not session:
            return

        session.state[key] = value

        message = SDUIMessage(
            type=SDUIMessageType.STATE_UPDATE,
            state_key=key,
            state_value=value
        )

        await self._send_message(session, message)

    def get_state(self, session_id: str, key: str, default: Any = None) -> Any:
        """Get a state value."""
        session = self.get_session(session_id)
        if not session:
            return default
        return session.state.get(key, default)

    # =========================================================================
    # Event Handling
    # =========================================================================

    def register_event_handler(
        self,
        event_type: str,
        handler: Callable[[SDUIEvent, SDUISession], Any]
    ) -> None:
        """Register a handler for an event type."""
        self._event_handlers[event_type] = handler

    async def handle_event(
        self,
        session_id: str,
        event: SDUIEvent
    ) -> Any:
        """Handle an incoming event from the client."""
        session = self.get_session(session_id)
        if not session:
            return

        session.last_activity = datetime.utcnow()

        # Look up handler
        handler = self._event_handlers.get(event.type)
        if handler:
            try:
                result = await handler(event, session) if asyncio.iscoroutinefunction(handler) else handler(event, session)
                return result
            except Exception as e:
                self.logger.error(f"Event handler error: {e}")
                await self.show_toast(
                    session_id,
                    "An error occurred",
                    severity="error"
                )

        # Handle built-in action types
        if event.action:
            await self._handle_action(session, event.action)

    async def _handle_action(
        self,
        session: SDUISession,
        action: SDUIAction
    ) -> None:
        """Handle a built-in action."""
        if action.type == ActionType.NAVIGATE:
            message = SDUIMessage(
                type=SDUIMessageType.NAVIGATE,
                url=action.target
            )
            await self._send_message(session, message)

        elif action.type == ActionType.CLOSE_MODAL:
            if action.target:
                await self.close_modal(session.session_id, action.target)

        elif action.type == ActionType.REFRESH:
            if session.current_layout:
                await self.render_layout(
                    session.session_id,
                    session.current_layout.type,
                    session.state
                )

    # =========================================================================
    # Message Dispatch
    # =========================================================================

    async def _send_message(
        self,
        session: SDUISession,
        message: SDUIMessage
    ) -> None:
        """Send a message to a session."""
        if session.send_callback:
            try:
                if asyncio.iscoroutinefunction(session.send_callback):
                    await session.send_callback(message.to_json())
                else:
                    session.send_callback(message.to_json())
            except Exception as e:
                self.logger.error(f"Failed to send message: {e}")

    async def broadcast(
        self,
        message: SDUIMessage,
        tenant_id: Optional[str] = None
    ) -> None:
        """Broadcast a message to all sessions (optionally filtered by tenant)."""
        for session in self.sessions.values():
            if tenant_id is None or session.tenant_id == tenant_id:
                await self._send_message(session, message)

    # =========================================================================
    # Intent-to-Layout (I2L) Integration
    # =========================================================================

    async def render_for_intent(
        self,
        session_id: str,
        intent_id: str,
        agent_id: str,
        data: Dict[str, Any]
    ) -> SDUIMessage:
        """
        Render appropriate layout based on intent and agent.

        This is the main I2L entry point used by agents.
        """
        # Intent to layout mapping
        intent_layouts = {
            # Communication intents
            "email.send": (LayoutType.FORM, self._email_form_data),
            "email.read": (LayoutType.LIST_DETAIL, self._email_list_data),
            "messaging.slack": (LayoutType.CHAT, None),

            # Calendar intents
            "calendar.create": (LayoutType.FORM, self._event_form_data),
            "calendar.view": (LayoutType.DASHBOARD, self._calendar_dashboard_data),

            # Analytics intents
            "analytics.report": (LayoutType.ANALYTICS, None),
            "analytics.chart": (LayoutType.ANALYTICS, None),

            # Task intents
            "task.list": (LayoutType.KANBAN, None),
            "task.create": (LayoutType.FORM, self._task_form_data),

            # Default to chat
            "default": (LayoutType.CHAT, None),
        }

        # Get layout type and data transformer
        layout_info = intent_layouts.get(intent_id, intent_layouts["default"])
        layout_type, data_transformer = layout_info

        # Transform data if needed
        if data_transformer:
            data = data_transformer(data)

        return await self.render_layout(session_id, layout_type, data)

    def _email_form_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform data for email form."""
        return {
            "title": "Compose Email",
            "fields": [
                {"name": "to", "type": "email", "label": "To", "required": True},
                {"name": "cc", "type": "email", "label": "CC"},
                {"name": "subject", "type": "text", "label": "Subject", "required": True},
                {"name": "body", "type": "textarea", "label": "Message", "rows": 10},
            ],
            "submit_label": "Send Email",
            "submit_action": SDUIAction(
                type=ActionType.EXECUTE_TOOL,
                payload={"tool": "email-mcp.send_email"}
            )
        }

    def _email_list_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform data for email list."""
        emails = data.get("emails", [])
        return {
            "title": "Inbox",
            "items": [
                {
                    "id": e.get("id"),
                    "title": e.get("subject", "No Subject"),
                    "subtitle": f"From: {e.get('from', 'Unknown')}"
                }
                for e in emails
            ]
        }

    def _event_form_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform data for event form."""
        return {
            "title": "Create Event",
            "fields": [
                {"name": "title", "type": "text", "label": "Event Title", "required": True},
                {"name": "date", "type": "date", "label": "Date", "required": True},
                {"name": "time", "type": "time", "label": "Time"},
                {"name": "duration", "type": "number", "label": "Duration (minutes)", "value": 60},
                {"name": "attendees", "type": "text", "label": "Attendees (comma-separated)"},
                {"name": "description", "type": "textarea", "label": "Description"},
            ],
            "submit_label": "Create Event",
            "submit_action": SDUIAction(
                type=ActionType.EXECUTE_TOOL,
                payload={"tool": "gcal-mcp.create_event"}
            )
        }

    def _calendar_dashboard_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform data for calendar dashboard."""
        events = data.get("events", [])
        return {
            "title": "Calendar",
            "widgets": [
                {
                    "type": "metric",
                    "label": "Today's Events",
                    "value": len([e for e in events if e.get("is_today")])
                },
                {
                    "type": "metric",
                    "label": "This Week",
                    "value": len(events)
                }
            ]
        }

    def _task_form_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform data for task form."""
        return {
            "title": "Create Task",
            "fields": [
                {"name": "title", "type": "text", "label": "Task Title", "required": True},
                {"name": "description", "type": "textarea", "label": "Description"},
                {"name": "priority", "type": "select", "label": "Priority",
                 "options": [
                     {"value": "low", "label": "Low"},
                     {"value": "medium", "label": "Medium"},
                     {"value": "high", "label": "High"}
                 ]},
                {"name": "due_date", "type": "date", "label": "Due Date"},
            ],
            "submit_label": "Create Task"
        }

    # =========================================================================
    # Metrics
    # =========================================================================

    def get_metrics(self) -> Dict[str, Any]:
        """Get SDUI controller metrics."""
        return {
            "active_sessions": len(self.sessions),
            "active_streams": len(self._active_streams),
            "registered_components": len(self.component_registry.components),
            "registered_layouts": len(self.layout_engine.templates),
            "event_handlers": len(self._event_handlers)
        }


# Singleton accessor
_controller: Optional[SDUIController] = None


async def get_sdui_controller() -> SDUIController:
    """Get the global SDUI controller instance."""
    global _controller
    if _controller is None:
        _controller = SDUIController()
    return _controller
