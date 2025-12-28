"""
KOSMOS V2.0 SDUI Protocol

Defines the message schema and types for Server-Driven UI communication.
The backend sends SDUI messages to control frontend layout and components.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import json
import uuid


class ComponentType(str, Enum):
    """Available SDUI component types."""
    # Containers
    CARD = "card"
    MODAL = "modal"
    DRAWER = "drawer"
    PANEL = "panel"
    ACCORDION = "accordion"
    TABS = "tabs"

    # Data Display
    TEXT = "text"
    HEADING = "heading"
    MARKDOWN = "markdown"
    CODE = "code"
    JSON_VIEWER = "json_viewer"
    IMAGE = "image"
    AVATAR = "avatar"
    BADGE = "badge"
    TAG = "tag"
    PROGRESS = "progress"
    SPINNER = "spinner"
    SKELETON = "skeleton"

    # Data Tables
    TABLE = "table"
    DATA_GRID = "data_grid"
    LIST = "list"
    TREE = "tree"

    # Charts & Visualization
    CHART = "chart"
    SPARKLINE = "sparkline"
    METRIC = "metric"
    GAUGE = "gauge"
    TIMELINE = "timeline"

    # Forms & Input
    INPUT = "input"
    TEXTAREA = "textarea"
    SELECT = "select"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    SWITCH = "switch"
    SLIDER = "slider"
    DATE_PICKER = "date_picker"
    TIME_PICKER = "time_picker"
    FILE_UPLOAD = "file_upload"
    COLOR_PICKER = "color_picker"

    # Buttons & Actions
    BUTTON = "button"
    BUTTON_GROUP = "button_group"
    ICON_BUTTON = "icon_button"
    FAB = "fab"  # Floating Action Button
    MENU = "menu"
    DROPDOWN = "dropdown"

    # Layout
    FLEX = "flex"
    GRID = "grid"
    STACK = "stack"
    DIVIDER = "divider"
    SPACER = "spacer"

    # Navigation
    BREADCRUMB = "breadcrumb"
    PAGINATION = "pagination"
    STEPPER = "stepper"

    # Feedback
    ALERT = "alert"
    TOAST = "toast"
    BANNER = "banner"
    TOOLTIP = "tooltip"
    POPOVER = "popover"

    # Custom / Composite
    KANBAN = "kanban"
    CALENDAR = "calendar"
    CHAT_MESSAGE = "chat_message"
    CHAT_BUBBLE = "chat_bubble"
    AGENT_STATUS = "agent_status"
    TOOL_CARD = "tool_card"
    WORKFLOW_STEP = "workflow_step"
    ENTITY_CARD = "entity_card"


class LayoutType(str, Enum):
    """Available layout templates."""
    # Core layouts
    DASHBOARD = "dashboard"
    CHAT = "chat"
    SPLIT = "split"
    FORM = "form"
    LIST_DETAIL = "list_detail"

    # Specialized layouts
    KANBAN = "kanban"
    TIMELINE = "timeline"
    ANALYTICS = "analytics"
    SETTINGS = "settings"
    WORKFLOW = "workflow"
    WIZARD = "wizard"

    # Utility layouts
    EMPTY = "empty"
    ERROR = "error"
    LOADING = "loading"
    CONFIRMATION = "confirmation"


class ActionType(str, Enum):
    """Types of actions that can be triggered."""
    # Navigation
    NAVIGATE = "navigate"
    OPEN_MODAL = "open_modal"
    CLOSE_MODAL = "close_modal"
    OPEN_DRAWER = "open_drawer"
    CLOSE_DRAWER = "close_drawer"

    # Data
    SUBMIT = "submit"
    FETCH = "fetch"
    REFRESH = "refresh"
    DOWNLOAD = "download"
    UPLOAD = "upload"

    # State
    SET_STATE = "set_state"
    TOGGLE = "toggle"
    SELECT = "select"
    DESELECT = "deselect"

    # KOSMOS specific
    ROUTE_TO_AGENT = "route_to_agent"
    EXECUTE_TOOL = "execute_tool"
    SEND_MESSAGE = "send_message"
    APPROVE = "approve"
    REJECT = "reject"
    ESCALATE = "escalate"

    # Custom
    CUSTOM = "custom"


class AnimationType(str, Enum):
    """Animation types for component transitions."""
    FADE = "fade"
    SLIDE_UP = "slide_up"
    SLIDE_DOWN = "slide_down"
    SLIDE_LEFT = "slide_left"
    SLIDE_RIGHT = "slide_right"
    SCALE = "scale"
    MORPH = "morph"
    SPRING = "spring"
    NONE = "none"


@dataclass
class SDUIStyle:
    """Styling properties for components."""
    # Glass morphism effects
    glass: bool = False
    glass_blur: int = 10  # px
    glass_opacity: float = 0.15
    glass_border: bool = True

    # Colors
    background: Optional[str] = None
    color: Optional[str] = None
    border_color: Optional[str] = None
    accent_color: Optional[str] = None

    # Spacing
    padding: Optional[str] = None
    margin: Optional[str] = None
    gap: Optional[str] = None

    # Size
    width: Optional[str] = None
    height: Optional[str] = None
    min_width: Optional[str] = None
    min_height: Optional[str] = None
    max_width: Optional[str] = None
    max_height: Optional[str] = None

    # Border
    border_radius: Optional[str] = None
    border_width: Optional[str] = None
    border_style: Optional[str] = None

    # Shadow
    shadow: Optional[str] = None
    glow: bool = False

    # Typography
    font_size: Optional[str] = None
    font_weight: Optional[str] = None
    text_align: Optional[str] = None

    # Animation
    animation: AnimationType = AnimationType.NONE
    animation_duration: float = 0.3  # seconds
    animation_delay: float = 0.0

    # Responsive
    responsive: Optional[Dict[str, Any]] = None  # breakpoint -> style overrides

    # Custom CSS class
    class_name: Optional[str] = None
    custom_css: Optional[Dict[str, str]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, excluding None values."""
        result = {}
        for key, value in self.__dict__.items():
            if value is not None and value != AnimationType.NONE:
                if isinstance(value, Enum):
                    result[key] = value.value
                else:
                    result[key] = value
        return result


@dataclass
class SDUIAction:
    """Action that can be triggered by user interaction."""
    type: ActionType
    label: Optional[str] = None
    icon: Optional[str] = None
    target: Optional[str] = None  # URL, modal ID, etc.
    payload: Optional[Dict[str, Any]] = None
    confirm: Optional[str] = None  # Confirmation message
    disabled: bool = False
    loading: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "label": self.label,
            "icon": self.icon,
            "target": self.target,
            "payload": self.payload,
            "confirm": self.confirm,
            "disabled": self.disabled,
            "loading": self.loading,
        }


@dataclass
class SDUIComponent:
    """A single UI component in the SDUI tree."""
    type: ComponentType
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    props: Dict[str, Any] = field(default_factory=dict)
    children: List['SDUIComponent'] = field(default_factory=list)
    style: Optional[SDUIStyle] = None
    actions: List[SDUIAction] = field(default_factory=list)
    events: Dict[str, SDUIAction] = field(default_factory=dict)  # event -> action
    visible: bool = True
    loading: bool = False
    error: Optional[str] = None
    key: Optional[str] = None  # For list rendering

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "id": self.id,
            "props": self.props,
            "children": [c.to_dict() for c in self.children],
            "style": self.style.to_dict() if self.style else None,
            "actions": [a.to_dict() for a in self.actions],
            "events": {k: v.to_dict() for k, v in self.events.items()},
            "visible": self.visible,
            "loading": self.loading,
            "error": self.error,
            "key": self.key,
        }


@dataclass
class SDUISlot:
    """Named slot for component placement in layouts."""
    name: str
    components: List[SDUIComponent] = field(default_factory=list)
    style: Optional[SDUIStyle] = None
    collapsible: bool = False
    collapsed: bool = False
    min_width: Optional[str] = None
    max_width: Optional[str] = None
    resizable: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "components": [c.to_dict() for c in self.components],
            "style": self.style.to_dict() if self.style else None,
            "collapsible": self.collapsible,
            "collapsed": self.collapsed,
            "min_width": self.min_width,
            "max_width": self.max_width,
            "resizable": self.resizable,
        }


@dataclass
class SDUILayout:
    """Layout template with named slots."""
    type: LayoutType
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    slots: Dict[str, SDUISlot] = field(default_factory=dict)
    style: Optional[SDUIStyle] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    header: Optional[SDUIComponent] = None
    footer: Optional[SDUIComponent] = None
    sidebar: Optional[SDUISlot] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "id": self.id,
            "slots": {k: v.to_dict() for k, v in self.slots.items()},
            "style": self.style.to_dict() if self.style else None,
            "title": self.title,
            "subtitle": self.subtitle,
            "header": self.header.to_dict() if self.header else None,
            "footer": self.footer.to_dict() if self.footer else None,
            "sidebar": self.sidebar.to_dict() if self.sidebar else None,
            "metadata": self.metadata,
        }


class SDUIMessageType(str, Enum):
    """Types of SDUI messages."""
    # Layout operations
    RENDER = "render"  # Full layout render
    UPDATE = "update"  # Partial update
    PATCH = "patch"  # Component-level patch

    # Navigation
    NAVIGATE = "navigate"
    MODAL = "modal"
    DRAWER = "drawer"
    TOAST = "toast"

    # State
    STATE_UPDATE = "state_update"
    LOADING = "loading"
    ERROR = "error"

    # Streaming
    STREAM_START = "stream_start"
    STREAM_CHUNK = "stream_chunk"
    STREAM_END = "stream_end"

    # Events
    EVENT = "event"
    ACTION_RESULT = "action_result"


@dataclass
class SDUIMessage:
    """Message sent from backend to frontend."""
    type: SDUIMessageType
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)

    # Content (one of these based on type)
    layout: Optional[SDUILayout] = None
    component: Optional[SDUIComponent] = None
    components: Optional[List[SDUIComponent]] = None

    # For patches/updates
    target_id: Optional[str] = None
    operation: Optional[str] = None  # 'replace', 'append', 'prepend', 'remove'
    path: Optional[str] = None  # JSON path for nested updates

    # For navigation
    url: Optional[str] = None
    modal_id: Optional[str] = None
    drawer_id: Optional[str] = None

    # For state
    state_key: Optional[str] = None
    state_value: Optional[Any] = None

    # For streaming
    stream_id: Optional[str] = None
    chunk: Optional[str] = None

    # For toasts/notifications
    message: Optional[str] = None
    severity: Optional[str] = None  # 'info', 'success', 'warning', 'error'
    duration: Optional[int] = None  # milliseconds

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "layout": self.layout.to_dict() if self.layout else None,
            "component": self.component.to_dict() if self.component else None,
            "components": [c.to_dict() for c in self.components] if self.components else None,
            "target_id": self.target_id,
            "operation": self.operation,
            "path": self.path,
            "url": self.url,
            "modal_id": self.modal_id,
            "drawer_id": self.drawer_id,
            "state_key": self.state_key,
            "state_value": self.state_value,
            "stream_id": self.stream_id,
            "chunk": self.chunk,
            "message": self.message,
            "severity": self.severity,
            "duration": self.duration,
            "metadata": self.metadata,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


@dataclass
class SDUIEvent:
    """Event sent from frontend to backend."""
    type: str
    component_id: str
    action: Optional[SDUIAction] = None
    value: Optional[Any] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SDUIEvent':
        return cls(
            type=data["type"],
            component_id=data["component_id"],
            action=SDUIAction(**data["action"]) if data.get("action") else None,
            value=data.get("value"),
            metadata=data.get("metadata", {})
        )


# ============================================================================
# Builder Pattern for Easy Component Construction
# ============================================================================

class ComponentBuilder:
    """Fluent builder for SDUI components."""

    def __init__(self, component_type: ComponentType):
        self._component = SDUIComponent(type=component_type)

    def id(self, component_id: str) -> 'ComponentBuilder':
        self._component.id = component_id
        return self

    def props(self, **kwargs) -> 'ComponentBuilder':
        self._component.props.update(kwargs)
        return self

    def prop(self, key: str, value: Any) -> 'ComponentBuilder':
        self._component.props[key] = value
        return self

    def glass(self, blur: int = 10, opacity: float = 0.15) -> 'ComponentBuilder':
        if not self._component.style:
            self._component.style = SDUIStyle()
        self._component.style.glass = True
        self._component.style.glass_blur = blur
        self._component.style.glass_opacity = opacity
        return self

    def style(self, **kwargs) -> 'ComponentBuilder':
        if not self._component.style:
            self._component.style = SDUIStyle()
        for key, value in kwargs.items():
            if hasattr(self._component.style, key):
                setattr(self._component.style, key, value)
        return self

    def animate(
        self,
        animation: AnimationType,
        duration: float = 0.3,
        delay: float = 0.0
    ) -> 'ComponentBuilder':
        if not self._component.style:
            self._component.style = SDUIStyle()
        self._component.style.animation = animation
        self._component.style.animation_duration = duration
        self._component.style.animation_delay = delay
        return self

    def child(self, component: SDUIComponent) -> 'ComponentBuilder':
        self._component.children.append(component)
        return self

    def children(self, *components: SDUIComponent) -> 'ComponentBuilder':
        self._component.children.extend(components)
        return self

    def action(self, action: SDUIAction) -> 'ComponentBuilder':
        self._component.actions.append(action)
        return self

    def on(self, event: str, action: SDUIAction) -> 'ComponentBuilder':
        self._component.events[event] = action
        return self

    def loading(self, is_loading: bool = True) -> 'ComponentBuilder':
        self._component.loading = is_loading
        return self

    def hidden(self, is_hidden: bool = True) -> 'ComponentBuilder':
        self._component.visible = not is_hidden
        return self

    def key(self, key: str) -> 'ComponentBuilder':
        self._component.key = key
        return self

    def build(self) -> SDUIComponent:
        return self._component


def component(component_type: ComponentType) -> ComponentBuilder:
    """Start building a component."""
    return ComponentBuilder(component_type)


# Convenience factory functions
def text(content: str, **style_kwargs) -> SDUIComponent:
    """Create a text component."""
    builder = component(ComponentType.TEXT).props(content=content)
    if style_kwargs:
        builder.style(**style_kwargs)
    return builder.build()


def heading(content: str, level: int = 1, **style_kwargs) -> SDUIComponent:
    """Create a heading component."""
    builder = component(ComponentType.HEADING).props(content=content, level=level)
    if style_kwargs:
        builder.style(**style_kwargs)
    return builder.build()


def card(*children: SDUIComponent, glass: bool = True, **props) -> SDUIComponent:
    """Create a card component."""
    builder = component(ComponentType.CARD).props(**props).children(*children)
    if glass:
        builder.glass()
    return builder.build()


def button(
    label: str,
    action: SDUIAction,
    variant: str = "primary",
    icon: Optional[str] = None
) -> SDUIComponent:
    """Create a button component."""
    return (
        component(ComponentType.BUTTON)
        .props(label=label, variant=variant, icon=icon)
        .action(action)
        .build()
    )


def flex(*children: SDUIComponent, direction: str = "row", gap: str = "1rem") -> SDUIComponent:
    """Create a flex container."""
    return (
        component(ComponentType.FLEX)
        .props(direction=direction)
        .style(gap=gap)
        .children(*children)
        .build()
    )


def grid(*children: SDUIComponent, columns: int = 3, gap: str = "1rem") -> SDUIComponent:
    """Create a grid container."""
    return (
        component(ComponentType.GRID)
        .props(columns=columns)
        .style(gap=gap)
        .children(*children)
        .build()
    )
