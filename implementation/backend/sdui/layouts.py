"""
KOSMOS V2.0 SDUI Layout Engine

Provides layout templates and the engine to transform intents into layouts.
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
from enum import Enum

import structlog

from sdui.protocol import (
    SDUILayout,
    SDUISlot,
    SDUIComponent,
    SDUIStyle,
    SDUIAction,
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

logger = structlog.get_logger()


@dataclass
class LayoutTemplate:
    """Template for generating a layout."""
    type: LayoutType
    name: str
    description: str
    slots: List[str]  # Named slots this layout supports
    default_style: Optional[SDUIStyle] = None
    responsive: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "name": self.name,
            "description": self.description,
            "slots": self.slots,
            "responsive": self.responsive
        }


class LayoutEngine:
    """
    Engine for generating SDUI layouts based on intent and data.

    Uses the Intent-to-Layout (I2L) pattern to dynamically generate
    appropriate UI layouts based on the user's intent and available data.
    """

    def __init__(self):
        self.templates: Dict[LayoutType, LayoutTemplate] = {}
        self.logger = logger.bind(component="LayoutEngine")
        self._register_default_templates()

    def _register_default_templates(self) -> None:
        """Register built-in layout templates."""
        # Dashboard layout
        self.templates[LayoutType.DASHBOARD] = LayoutTemplate(
            type=LayoutType.DASHBOARD,
            name="Dashboard",
            description="Grid-based dashboard with widgets",
            slots=["header", "widgets", "sidebar"],
            default_style=SDUIStyle(padding="1.5rem", gap="1.5rem")
        )

        # Chat layout
        self.templates[LayoutType.CHAT] = LayoutTemplate(
            type=LayoutType.CHAT,
            name="Chat",
            description="Conversational chat interface",
            slots=["messages", "input", "sidebar"],
            default_style=SDUIStyle(padding="1rem")
        )

        # Split layout
        self.templates[LayoutType.SPLIT] = LayoutTemplate(
            type=LayoutType.SPLIT,
            name="Split View",
            description="Two-pane split layout",
            slots=["left", "right"],
            default_style=SDUIStyle(gap="1rem")
        )

        # Form layout
        self.templates[LayoutType.FORM] = LayoutTemplate(
            type=LayoutType.FORM,
            name="Form",
            description="Form with fields and actions",
            slots=["fields", "actions"],
            default_style=SDUIStyle(padding="1.5rem", max_width="600px")
        )

        # List-Detail layout
        self.templates[LayoutType.LIST_DETAIL] = LayoutTemplate(
            type=LayoutType.LIST_DETAIL,
            name="List-Detail",
            description="Master-detail pattern",
            slots=["list", "detail", "actions"],
            default_style=SDUIStyle(gap="1rem")
        )

        # Kanban layout
        self.templates[LayoutType.KANBAN] = LayoutTemplate(
            type=LayoutType.KANBAN,
            name="Kanban",
            description="Kanban board with columns",
            slots=["columns"],
            default_style=SDUIStyle(padding="1rem", gap="1rem")
        )

        # Timeline layout
        self.templates[LayoutType.TIMELINE] = LayoutTemplate(
            type=LayoutType.TIMELINE,
            name="Timeline",
            description="Vertical timeline of events",
            slots=["events", "header"],
            default_style=SDUIStyle(padding="1rem")
        )

        # Analytics layout
        self.templates[LayoutType.ANALYTICS] = LayoutTemplate(
            type=LayoutType.ANALYTICS,
            name="Analytics",
            description="Charts and metrics dashboard",
            slots=["metrics", "charts", "tables"],
            default_style=SDUIStyle(padding="1.5rem", gap="1.5rem")
        )

        # Settings layout
        self.templates[LayoutType.SETTINGS] = LayoutTemplate(
            type=LayoutType.SETTINGS,
            name="Settings",
            description="Settings page with sections",
            slots=["navigation", "content"],
            default_style=SDUIStyle(padding="1.5rem")
        )

        # Workflow layout
        self.templates[LayoutType.WORKFLOW] = LayoutTemplate(
            type=LayoutType.WORKFLOW,
            name="Workflow",
            description="Multi-step workflow display",
            slots=["steps", "current", "actions"],
            default_style=SDUIStyle(padding="1.5rem")
        )

        # Wizard layout
        self.templates[LayoutType.WIZARD] = LayoutTemplate(
            type=LayoutType.WIZARD,
            name="Wizard",
            description="Step-by-step wizard",
            slots=["progress", "content", "navigation"],
            default_style=SDUIStyle(padding="2rem", max_width="800px")
        )

        # Error layout
        self.templates[LayoutType.ERROR] = LayoutTemplate(
            type=LayoutType.ERROR,
            name="Error",
            description="Error display page",
            slots=["content"],
            default_style=SDUIStyle(padding="2rem", text_align="center")
        )

        # Loading layout
        self.templates[LayoutType.LOADING] = LayoutTemplate(
            type=LayoutType.LOADING,
            name="Loading",
            description="Loading state display",
            slots=["content"],
            default_style=SDUIStyle(padding="2rem", text_align="center")
        )

        # Confirmation layout
        self.templates[LayoutType.CONFIRMATION] = LayoutTemplate(
            type=LayoutType.CONFIRMATION,
            name="Confirmation",
            description="Confirmation dialog content",
            slots=["content", "actions"],
            default_style=SDUIStyle(padding="1.5rem", max_width="500px")
        )

        # Empty layout
        self.templates[LayoutType.EMPTY] = LayoutTemplate(
            type=LayoutType.EMPTY,
            name="Empty",
            description="Empty state display",
            slots=["content"],
            default_style=SDUIStyle(padding="3rem", text_align="center")
        )

    def get_template(self, layout_type: LayoutType) -> Optional[LayoutTemplate]:
        """Get a layout template by type."""
        return self.templates.get(layout_type)

    def list_templates(self) -> List[LayoutTemplate]:
        """List all available templates."""
        return list(self.templates.values())

    def create_layout(
        self,
        layout_type: LayoutType,
        title: Optional[str] = None,
        subtitle: Optional[str] = None,
        **kwargs
    ) -> SDUILayout:
        """Create a layout from a template."""
        template = self.templates.get(layout_type)
        if not template:
            raise ValueError(f"Unknown layout type: {layout_type}")

        layout = SDUILayout(
            type=layout_type,
            title=title,
            subtitle=subtitle,
            style=template.default_style,
            slots={name: SDUISlot(name=name) for name in template.slots}
        )

        # Apply any additional kwargs
        for key, value in kwargs.items():
            if hasattr(layout, key):
                setattr(layout, key, value)

        return layout

    # =========================================================================
    # Intent-to-Layout (I2L) Methods
    # =========================================================================

    def layout_for_chat(
        self,
        messages: List[Dict[str, Any]],
        agent_name: Optional[str] = None,
        suggestions: Optional[List[str]] = None
    ) -> SDUILayout:
        """Generate a chat layout with messages."""
        layout = self.create_layout(
            LayoutType.CHAT,
            title=f"Chat with {agent_name}" if agent_name else "Chat"
        )

        # Create message components
        message_components = []
        for msg in messages:
            bubble = (
                component(ComponentType.CHAT_BUBBLE)
                .props(
                    content=msg.get("content", ""),
                    role=msg.get("role", "user"),
                    timestamp=msg.get("timestamp"),
                    agent=msg.get("agent")
                )
                .glass(blur=8, opacity=0.1)
                .animate(AnimationType.SLIDE_UP, duration=0.2)
                .build()
            )
            message_components.append(bubble)

        layout.slots["messages"].components = message_components

        # Add input field
        input_comp = (
            component(ComponentType.TEXTAREA)
            .props(placeholder="Type your message...", rows=2)
            .glass()
            .on("submit", SDUIAction(type=ActionType.SEND_MESSAGE))
            .build()
        )
        layout.slots["input"].components = [input_comp]

        # Add suggestions if provided
        if suggestions:
            suggestion_buttons = [
                button(
                    label=s,
                    action=SDUIAction(
                        type=ActionType.SEND_MESSAGE,
                        payload={"message": s}
                    ),
                    variant="outline"
                )
                for s in suggestions[:4]
            ]
            layout.slots["input"].components.append(
                flex(*suggestion_buttons, gap="0.5rem")
            )

        return layout

    def layout_for_dashboard(
        self,
        widgets: List[Dict[str, Any]],
        title: str = "Dashboard"
    ) -> SDUILayout:
        """Generate a dashboard layout with widgets."""
        layout = self.create_layout(LayoutType.DASHBOARD, title=title)

        widget_components = []
        for widget in widgets:
            widget_type = widget.get("type", "metric")

            if widget_type == "metric":
                comp = (
                    component(ComponentType.METRIC)
                    .props(
                        label=widget.get("label", ""),
                        value=widget.get("value", 0),
                        change=widget.get("change"),
                        format=widget.get("format", "number")
                    )
                    .glass()
                    .animate(AnimationType.FADE, delay=len(widget_components) * 0.1)
                    .build()
                )
            elif widget_type == "chart":
                comp = (
                    component(ComponentType.CHART)
                    .props(
                        chart_type=widget.get("chart_type", "line"),
                        data=widget.get("data", []),
                        title=widget.get("title", "")
                    )
                    .glass()
                    .style(height="300px")
                    .build()
                )
            elif widget_type == "table":
                comp = (
                    component(ComponentType.TABLE)
                    .props(
                        columns=widget.get("columns", []),
                        data=widget.get("data", []),
                        title=widget.get("title", "")
                    )
                    .glass()
                    .build()
                )
            else:
                comp = card(
                    heading(widget.get("title", "Widget")),
                    text(str(widget.get("content", "")))
                )

            widget_components.append(comp)

        layout.slots["widgets"].components = [
            grid(*widget_components, columns=3)
        ]

        return layout

    def layout_for_form(
        self,
        fields: List[Dict[str, Any]],
        title: str = "Form",
        submit_label: str = "Submit",
        submit_action: Optional[SDUIAction] = None
    ) -> SDUILayout:
        """Generate a form layout."""
        layout = self.create_layout(LayoutType.FORM, title=title)

        field_components = []
        for field_def in fields:
            field_type = field_def.get("type", "input")

            if field_type in ("text", "email", "password", "number"):
                comp = (
                    component(ComponentType.INPUT)
                    .props(
                        name=field_def.get("name", ""),
                        label=field_def.get("label", ""),
                        type=field_type,
                        placeholder=field_def.get("placeholder", ""),
                        required=field_def.get("required", False),
                        value=field_def.get("value", "")
                    )
                    .glass()
                    .build()
                )
            elif field_type == "textarea":
                comp = (
                    component(ComponentType.TEXTAREA)
                    .props(
                        name=field_def.get("name", ""),
                        label=field_def.get("label", ""),
                        rows=field_def.get("rows", 4),
                        placeholder=field_def.get("placeholder", ""),
                        value=field_def.get("value", "")
                    )
                    .glass()
                    .build()
                )
            elif field_type == "select":
                comp = (
                    component(ComponentType.SELECT)
                    .props(
                        name=field_def.get("name", ""),
                        label=field_def.get("label", ""),
                        options=field_def.get("options", []),
                        value=field_def.get("value", "")
                    )
                    .glass()
                    .build()
                )
            elif field_type == "checkbox":
                comp = (
                    component(ComponentType.CHECKBOX)
                    .props(
                        name=field_def.get("name", ""),
                        label=field_def.get("label", ""),
                        checked=field_def.get("value", False)
                    )
                    .build()
                )
            elif field_type == "date":
                comp = (
                    component(ComponentType.DATE_PICKER)
                    .props(
                        name=field_def.get("name", ""),
                        label=field_def.get("label", ""),
                        value=field_def.get("value", "")
                    )
                    .glass()
                    .build()
                )
            else:
                comp = (
                    component(ComponentType.INPUT)
                    .props(
                        name=field_def.get("name", ""),
                        label=field_def.get("label", "")
                    )
                    .glass()
                    .build()
                )

            field_components.append(comp)

        layout.slots["fields"].components = field_components

        # Add submit button
        layout.slots["actions"].components = [
            button(
                label=submit_label,
                action=submit_action or SDUIAction(type=ActionType.SUBMIT),
                variant="primary"
            )
        ]

        return layout

    def layout_for_list(
        self,
        items: List[Dict[str, Any]],
        title: str = "Items",
        on_select: Optional[SDUIAction] = None,
        detail_content: Optional[SDUIComponent] = None
    ) -> SDUILayout:
        """Generate a list-detail layout."""
        layout = self.create_layout(LayoutType.LIST_DETAIL, title=title)

        # Create list items
        list_items = []
        for item in items:
            list_item = (
                component(ComponentType.CARD)
                .props(
                    title=item.get("title", ""),
                    subtitle=item.get("subtitle", ""),
                    selected=item.get("selected", False)
                )
                .glass()
                .on("click", on_select or SDUIAction(
                    type=ActionType.SELECT,
                    payload={"id": item.get("id")}
                ))
                .key(str(item.get("id", "")))
                .build()
            )
            list_items.append(list_item)

        layout.slots["list"].components = list_items
        layout.slots["list"].style = SDUIStyle(
            max_width="400px",
            padding="1rem"
        )

        # Set detail content
        if detail_content:
            layout.slots["detail"].components = [detail_content]
        else:
            layout.slots["detail"].components = [
                (
                    component(ComponentType.TEXT)
                    .props(content="Select an item to view details")
                    .style(color="var(--text-muted)")
                    .build()
                )
            ]

        return layout

    def layout_for_kanban(
        self,
        columns: List[Dict[str, Any]],
        title: str = "Board"
    ) -> SDUILayout:
        """Generate a kanban board layout."""
        layout = self.create_layout(LayoutType.KANBAN, title=title)

        kanban_columns = []
        for col in columns:
            column_cards = [
                card(
                    heading(card_data.get("title", ""), level=4),
                    text(card_data.get("description", "")),
                    glass=True
                )
                for card_data in col.get("cards", [])
            ]

            column = (
                component(ComponentType.PANEL)
                .props(title=col.get("title", ""), count=len(col.get("cards", [])))
                .glass(opacity=0.08)
                .children(*column_cards)
                .style(min_width="300px", padding="1rem")
                .build()
            )
            kanban_columns.append(column)

        layout.slots["columns"].components = [
            flex(*kanban_columns, direction="row", gap="1rem")
        ]

        return layout

    def layout_for_timeline(
        self,
        events: List[Dict[str, Any]],
        title: str = "Timeline"
    ) -> SDUILayout:
        """Generate a timeline layout."""
        layout = self.create_layout(LayoutType.TIMELINE, title=title)

        event_components = []
        for i, event in enumerate(events):
            event_comp = (
                component(ComponentType.TIMELINE)
                .props(
                    title=event.get("title", ""),
                    description=event.get("description", ""),
                    timestamp=event.get("timestamp"),
                    icon=event.get("icon"),
                    status=event.get("status", "completed")
                )
                .animate(AnimationType.SLIDE_LEFT, delay=i * 0.1)
                .build()
            )
            event_components.append(event_comp)

        layout.slots["events"].components = event_components

        return layout

    def layout_for_analytics(
        self,
        metrics: List[Dict[str, Any]],
        charts: List[Dict[str, Any]],
        title: str = "Analytics"
    ) -> SDUILayout:
        """Generate an analytics dashboard layout."""
        layout = self.create_layout(LayoutType.ANALYTICS, title=title)

        # Metrics row
        metric_components = [
            (
                component(ComponentType.METRIC)
                .props(
                    label=m.get("label", ""),
                    value=m.get("value", 0),
                    change=m.get("change"),
                    change_type=m.get("change_type", "neutral"),
                    format=m.get("format", "number")
                )
                .glass()
                .build()
            )
            for m in metrics
        ]

        layout.slots["metrics"].components = [
            grid(*metric_components, columns=len(metrics) if len(metrics) <= 4 else 4)
        ]

        # Charts
        chart_components = [
            (
                component(ComponentType.CHART)
                .props(
                    chart_type=c.get("type", "line"),
                    data=c.get("data", []),
                    title=c.get("title", ""),
                    options=c.get("options", {})
                )
                .glass()
                .style(height="300px")
                .build()
            )
            for c in charts
        ]

        layout.slots["charts"].components = [
            grid(*chart_components, columns=2)
        ]

        return layout

    def layout_for_confirmation(
        self,
        title: str,
        message: str,
        confirm_action: SDUIAction,
        cancel_action: Optional[SDUIAction] = None,
        severity: str = "warning"
    ) -> SDUILayout:
        """Generate a confirmation dialog layout."""
        layout = self.create_layout(LayoutType.CONFIRMATION, title=title)

        icon_map = {
            "info": "info-circle",
            "success": "check-circle",
            "warning": "alert-triangle",
            "error": "x-circle"
        }

        layout.slots["content"].components = [
            flex(
                (
                    component(ComponentType.ICON_BUTTON)
                    .props(icon=icon_map.get(severity, "info-circle"), size="large")
                    .style(color=f"var(--{severity})")
                    .build()
                ),
                text(message),
                direction="column",
                gap="1rem"
            )
        ]

        layout.slots["actions"].components = [
            flex(
                button(
                    label="Cancel",
                    action=cancel_action or SDUIAction(type=ActionType.CLOSE_MODAL),
                    variant="outline"
                ),
                button(
                    label="Confirm",
                    action=confirm_action,
                    variant="primary"
                ),
                gap="1rem"
            )
        ]

        return layout

    def layout_for_error(
        self,
        title: str = "Something went wrong",
        message: str = "An unexpected error occurred.",
        retry_action: Optional[SDUIAction] = None
    ) -> SDUILayout:
        """Generate an error layout."""
        layout = self.create_layout(LayoutType.ERROR, title=title)

        children = [
            (
                component(ComponentType.ICON_BUTTON)
                .props(icon="alert-circle", size="xlarge")
                .style(color="var(--error)")
                .build()
            ),
            heading(title, level=2),
            text(message)
        ]

        if retry_action:
            children.append(
                button("Try Again", retry_action, variant="primary")
            )

        layout.slots["content"].components = [
            flex(*children, direction="column", gap="1rem")
        ]

        return layout

    def layout_for_loading(
        self,
        message: str = "Loading...",
        progress: Optional[int] = None
    ) -> SDUILayout:
        """Generate a loading layout."""
        layout = self.create_layout(LayoutType.LOADING)

        children = [
            (
                component(ComponentType.SPINNER)
                .props(size="large")
                .build()
            ),
            text(message)
        ]

        if progress is not None:
            children.append(
                (
                    component(ComponentType.PROGRESS)
                    .props(value=progress, max=100)
                    .style(width="200px")
                    .build()
                )
            )

        layout.slots["content"].components = [
            flex(*children, direction="column", gap="1rem")
        ]

        return layout

    def layout_for_empty(
        self,
        title: str = "No items",
        message: str = "There's nothing here yet.",
        action: Optional[SDUIAction] = None,
        action_label: str = "Get Started"
    ) -> SDUILayout:
        """Generate an empty state layout."""
        layout = self.create_layout(LayoutType.EMPTY, title=title)

        children = [
            (
                component(ComponentType.ICON_BUTTON)
                .props(icon="inbox", size="xlarge")
                .style(color="var(--text-muted)")
                .build()
            ),
            heading(title, level=3),
            text(message)
        ]

        if action:
            children.append(button(action_label, action, variant="primary"))

        layout.slots["content"].components = [
            flex(*children, direction="column", gap="1rem")
        ]

        return layout
