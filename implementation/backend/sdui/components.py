"""
KOSMOS V2.0 SDUI Component Registry

Registry of available components and their schemas.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Callable
from enum import Enum

import structlog

from sdui.protocol import ComponentType, SDUIComponent, SDUIStyle, SDUIAction

logger = structlog.get_logger()


@dataclass
class PropSchema:
    """Schema for a component prop."""
    name: str
    type: str  # 'string', 'number', 'boolean', 'array', 'object'
    required: bool = False
    default: Any = None
    description: str = ""
    enum: Optional[List[Any]] = None
    min: Optional[float] = None
    max: Optional[float] = None


@dataclass
class ComponentDefinition:
    """Definition of an SDUI component."""
    type: ComponentType
    name: str
    description: str
    category: str
    props: List[PropSchema] = field(default_factory=list)
    supports_children: bool = False
    supports_glass: bool = True
    icon: str = "box"
    preview_component: Optional[SDUIComponent] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "props": [
                {
                    "name": p.name,
                    "type": p.type,
                    "required": p.required,
                    "default": p.default,
                    "description": p.description,
                    "enum": p.enum,
                    "min": p.min,
                    "max": p.max
                }
                for p in self.props
            ],
            "supports_children": self.supports_children,
            "supports_glass": self.supports_glass,
            "icon": self.icon
        }


class ComponentRegistry:
    """
    Registry of all available SDUI components.

    Provides metadata about components for documentation,
    validation, and frontend rendering.
    """

    def __init__(self):
        self.components: Dict[ComponentType, ComponentDefinition] = {}
        self.logger = logger.bind(component="ComponentRegistry")
        self._register_default_components()

    def _register_default_components(self) -> None:
        """Register all built-in components."""
        # =====================================================================
        # Container Components
        # =====================================================================

        self.register(ComponentDefinition(
            type=ComponentType.CARD,
            name="Card",
            description="A container with optional header and actions",
            category="container",
            props=[
                PropSchema("title", "string", description="Card title"),
                PropSchema("subtitle", "string", description="Card subtitle"),
                PropSchema("elevated", "boolean", default=False),
                PropSchema("hoverable", "boolean", default=False),
            ],
            supports_children=True,
            icon="square"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.MODAL,
            name="Modal",
            description="Overlay dialog",
            category="container",
            props=[
                PropSchema("title", "string", description="Modal title"),
                PropSchema("open", "boolean", required=True, default=False),
                PropSchema("size", "string", enum=["sm", "md", "lg", "xl", "full"]),
                PropSchema("closeable", "boolean", default=True),
            ],
            supports_children=True,
            icon="layers"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.DRAWER,
            name="Drawer",
            description="Slide-out panel",
            category="container",
            props=[
                PropSchema("title", "string", description="Drawer title"),
                PropSchema("open", "boolean", required=True, default=False),
                PropSchema("side", "string", enum=["left", "right"], default="right"),
                PropSchema("width", "string", default="400px"),
            ],
            supports_children=True,
            icon="sidebar"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.PANEL,
            name="Panel",
            description="Collapsible panel section",
            category="container",
            props=[
                PropSchema("title", "string", description="Panel title"),
                PropSchema("collapsed", "boolean", default=False),
                PropSchema("collapsible", "boolean", default=True),
                PropSchema("count", "number", description="Badge count"),
            ],
            supports_children=True,
            icon="folder"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.ACCORDION,
            name="Accordion",
            description="Expandable sections",
            category="container",
            props=[
                PropSchema("items", "array", required=True, description="Accordion items"),
                PropSchema("multiple", "boolean", default=False),
                PropSchema("default_open", "array", default=[]),
            ],
            supports_children=False,
            icon="list"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.TABS,
            name="Tabs",
            description="Tabbed content",
            category="container",
            props=[
                PropSchema("tabs", "array", required=True, description="Tab definitions"),
                PropSchema("active", "string", description="Active tab ID"),
                PropSchema("variant", "string", enum=["line", "enclosed", "pill"]),
            ],
            supports_children=True,
            icon="folder"
        ))

        # =====================================================================
        # Data Display Components
        # =====================================================================

        self.register(ComponentDefinition(
            type=ComponentType.TEXT,
            name="Text",
            description="Text content",
            category="data_display",
            props=[
                PropSchema("content", "string", required=True),
                PropSchema("size", "string", enum=["xs", "sm", "md", "lg", "xl"]),
                PropSchema("weight", "string", enum=["normal", "medium", "semibold", "bold"]),
                PropSchema("color", "string"),
                PropSchema("truncate", "boolean", default=False),
            ],
            icon="type"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.HEADING,
            name="Heading",
            description="Section heading",
            category="data_display",
            props=[
                PropSchema("content", "string", required=True),
                PropSchema("level", "number", default=1, min=1, max=6),
            ],
            icon="heading"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.MARKDOWN,
            name="Markdown",
            description="Rendered markdown content",
            category="data_display",
            props=[
                PropSchema("content", "string", required=True),
                PropSchema("allow_html", "boolean", default=False),
            ],
            icon="file-text"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.CODE,
            name="Code",
            description="Syntax-highlighted code",
            category="data_display",
            props=[
                PropSchema("content", "string", required=True),
                PropSchema("language", "string", default="text"),
                PropSchema("line_numbers", "boolean", default=True),
                PropSchema("highlight_lines", "array", default=[]),
                PropSchema("copy_button", "boolean", default=True),
            ],
            icon="code"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.IMAGE,
            name="Image",
            description="Image display",
            category="data_display",
            props=[
                PropSchema("src", "string", required=True),
                PropSchema("alt", "string", required=True),
                PropSchema("width", "string"),
                PropSchema("height", "string"),
                PropSchema("fit", "string", enum=["cover", "contain", "fill"]),
            ],
            icon="image"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.BADGE,
            name="Badge",
            description="Status badge",
            category="data_display",
            props=[
                PropSchema("content", "string", required=True),
                PropSchema("variant", "string", enum=["default", "success", "warning", "error", "info"]),
                PropSchema("size", "string", enum=["sm", "md", "lg"]),
            ],
            icon="tag"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.PROGRESS,
            name="Progress",
            description="Progress indicator",
            category="data_display",
            props=[
                PropSchema("value", "number", required=True),
                PropSchema("max", "number", default=100),
                PropSchema("label", "string"),
                PropSchema("show_value", "boolean", default=False),
                PropSchema("variant", "string", enum=["default", "success", "warning", "error"]),
            ],
            icon="bar-chart"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.SPINNER,
            name="Spinner",
            description="Loading spinner",
            category="data_display",
            props=[
                PropSchema("size", "string", enum=["sm", "md", "lg", "xl"], default="md"),
                PropSchema("color", "string"),
            ],
            icon="loader"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.SKELETON,
            name="Skeleton",
            description="Loading skeleton placeholder",
            category="data_display",
            props=[
                PropSchema("variant", "string", enum=["text", "circular", "rectangular"]),
                PropSchema("width", "string"),
                PropSchema("height", "string"),
                PropSchema("lines", "number", default=1),
            ],
            icon="square"
        ))

        # =====================================================================
        # Data Tables
        # =====================================================================

        self.register(ComponentDefinition(
            type=ComponentType.TABLE,
            name="Table",
            description="Data table",
            category="data_table",
            props=[
                PropSchema("columns", "array", required=True, description="Column definitions"),
                PropSchema("data", "array", required=True, description="Row data"),
                PropSchema("sortable", "boolean", default=True),
                PropSchema("selectable", "boolean", default=False),
                PropSchema("pagination", "boolean", default=True),
                PropSchema("page_size", "number", default=10),
            ],
            supports_glass=True,
            icon="table"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.DATA_GRID,
            name="Data Grid",
            description="Advanced data grid with editing",
            category="data_table",
            props=[
                PropSchema("columns", "array", required=True),
                PropSchema("data", "array", required=True),
                PropSchema("editable", "boolean", default=False),
                PropSchema("row_height", "number", default=40),
                PropSchema("virtual", "boolean", default=True),
            ],
            icon="grid"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.LIST,
            name="List",
            description="Vertical list",
            category="data_table",
            props=[
                PropSchema("items", "array", required=True),
                PropSchema("variant", "string", enum=["simple", "detailed", "compact"]),
                PropSchema("dividers", "boolean", default=True),
            ],
            icon="list"
        ))

        # =====================================================================
        # Charts & Visualization
        # =====================================================================

        self.register(ComponentDefinition(
            type=ComponentType.CHART,
            name="Chart",
            description="Data visualization chart",
            category="chart",
            props=[
                PropSchema("chart_type", "string", required=True,
                           enum=["line", "bar", "area", "pie", "donut", "scatter", "radar"]),
                PropSchema("data", "array", required=True),
                PropSchema("title", "string"),
                PropSchema("options", "object", default={}),
                PropSchema("legend", "boolean", default=True),
                PropSchema("tooltip", "boolean", default=True),
            ],
            supports_glass=True,
            icon="bar-chart"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.METRIC,
            name="Metric",
            description="Single metric display",
            category="chart",
            props=[
                PropSchema("label", "string", required=True),
                PropSchema("value", "number", required=True),
                PropSchema("change", "number", description="Change percentage"),
                PropSchema("change_type", "string", enum=["positive", "negative", "neutral"]),
                PropSchema("format", "string", enum=["number", "currency", "percent"]),
                PropSchema("prefix", "string"),
                PropSchema("suffix", "string"),
            ],
            supports_glass=True,
            icon="activity"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.GAUGE,
            name="Gauge",
            description="Gauge meter",
            category="chart",
            props=[
                PropSchema("value", "number", required=True),
                PropSchema("min", "number", default=0),
                PropSchema("max", "number", default=100),
                PropSchema("label", "string"),
                PropSchema("thresholds", "array", default=[]),
            ],
            icon="circle"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.TIMELINE,
            name="Timeline",
            description="Event timeline",
            category="chart",
            props=[
                PropSchema("title", "string"),
                PropSchema("description", "string"),
                PropSchema("timestamp", "string"),
                PropSchema("icon", "string"),
                PropSchema("status", "string", enum=["pending", "active", "completed", "error"]),
            ],
            icon="git-branch"
        ))

        # =====================================================================
        # Form Components
        # =====================================================================

        self.register(ComponentDefinition(
            type=ComponentType.INPUT,
            name="Input",
            description="Text input field",
            category="form",
            props=[
                PropSchema("name", "string", required=True),
                PropSchema("label", "string"),
                PropSchema("type", "string", enum=["text", "email", "password", "number", "tel", "url"]),
                PropSchema("placeholder", "string"),
                PropSchema("value", "string"),
                PropSchema("required", "boolean", default=False),
                PropSchema("disabled", "boolean", default=False),
                PropSchema("error", "string"),
            ],
            supports_glass=True,
            icon="edit"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.TEXTAREA,
            name="Textarea",
            description="Multi-line text input",
            category="form",
            props=[
                PropSchema("name", "string", required=True),
                PropSchema("label", "string"),
                PropSchema("placeholder", "string"),
                PropSchema("value", "string"),
                PropSchema("rows", "number", default=4),
                PropSchema("resize", "string", enum=["none", "vertical", "horizontal", "both"]),
            ],
            supports_glass=True,
            icon="align-left"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.SELECT,
            name="Select",
            description="Dropdown select",
            category="form",
            props=[
                PropSchema("name", "string", required=True),
                PropSchema("label", "string"),
                PropSchema("options", "array", required=True),
                PropSchema("value", "string"),
                PropSchema("placeholder", "string", default="Select..."),
                PropSchema("multiple", "boolean", default=False),
                PropSchema("searchable", "boolean", default=False),
            ],
            supports_glass=True,
            icon="chevron-down"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.CHECKBOX,
            name="Checkbox",
            description="Checkbox input",
            category="form",
            props=[
                PropSchema("name", "string", required=True),
                PropSchema("label", "string", required=True),
                PropSchema("checked", "boolean", default=False),
                PropSchema("disabled", "boolean", default=False),
            ],
            icon="check-square"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.SWITCH,
            name="Switch",
            description="Toggle switch",
            category="form",
            props=[
                PropSchema("name", "string", required=True),
                PropSchema("label", "string"),
                PropSchema("checked", "boolean", default=False),
                PropSchema("disabled", "boolean", default=False),
            ],
            icon="toggle-left"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.DATE_PICKER,
            name="Date Picker",
            description="Date selection",
            category="form",
            props=[
                PropSchema("name", "string", required=True),
                PropSchema("label", "string"),
                PropSchema("value", "string"),
                PropSchema("min_date", "string"),
                PropSchema("max_date", "string"),
                PropSchema("format", "string", default="yyyy-MM-dd"),
            ],
            supports_glass=True,
            icon="calendar"
        ))

        # =====================================================================
        # Button Components
        # =====================================================================

        self.register(ComponentDefinition(
            type=ComponentType.BUTTON,
            name="Button",
            description="Clickable button",
            category="button",
            props=[
                PropSchema("label", "string", required=True),
                PropSchema("variant", "string", enum=["primary", "secondary", "outline", "ghost", "link", "danger"]),
                PropSchema("size", "string", enum=["sm", "md", "lg"]),
                PropSchema("icon", "string"),
                PropSchema("icon_position", "string", enum=["left", "right"], default="left"),
                PropSchema("loading", "boolean", default=False),
                PropSchema("disabled", "boolean", default=False),
                PropSchema("full_width", "boolean", default=False),
            ],
            supports_glass=True,
            icon="mouse-pointer"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.ICON_BUTTON,
            name="Icon Button",
            description="Icon-only button",
            category="button",
            props=[
                PropSchema("icon", "string", required=True),
                PropSchema("label", "string", description="Accessible label"),
                PropSchema("size", "string", enum=["sm", "md", "lg", "xl"]),
                PropSchema("variant", "string", enum=["primary", "secondary", "outline", "ghost"]),
            ],
            icon="circle"
        ))

        # =====================================================================
        # Layout Components
        # =====================================================================

        self.register(ComponentDefinition(
            type=ComponentType.FLEX,
            name="Flex",
            description="Flexbox container",
            category="layout",
            props=[
                PropSchema("direction", "string", enum=["row", "column", "row-reverse", "column-reverse"]),
                PropSchema("align", "string", enum=["start", "center", "end", "stretch", "baseline"]),
                PropSchema("justify", "string", enum=["start", "center", "end", "between", "around", "evenly"]),
                PropSchema("wrap", "string", enum=["nowrap", "wrap", "wrap-reverse"]),
            ],
            supports_children=True,
            supports_glass=False,
            icon="layout"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.GRID,
            name="Grid",
            description="CSS Grid container",
            category="layout",
            props=[
                PropSchema("columns", "number", default=3),
                PropSchema("column_template", "string", description="Custom grid-template-columns"),
                PropSchema("row_template", "string", description="Custom grid-template-rows"),
            ],
            supports_children=True,
            supports_glass=False,
            icon="grid"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.DIVIDER,
            name="Divider",
            description="Visual divider",
            category="layout",
            props=[
                PropSchema("orientation", "string", enum=["horizontal", "vertical"]),
                PropSchema("label", "string"),
            ],
            icon="minus"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.SPACER,
            name="Spacer",
            description="Empty space",
            category="layout",
            props=[
                PropSchema("size", "string", default="1rem"),
            ],
            icon="maximize-2"
        ))

        # =====================================================================
        # Feedback Components
        # =====================================================================

        self.register(ComponentDefinition(
            type=ComponentType.ALERT,
            name="Alert",
            description="Alert message",
            category="feedback",
            props=[
                PropSchema("title", "string"),
                PropSchema("message", "string", required=True),
                PropSchema("severity", "string", enum=["info", "success", "warning", "error"]),
                PropSchema("dismissible", "boolean", default=False),
            ],
            supports_glass=True,
            icon="alert-circle"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.TOAST,
            name="Toast",
            description="Toast notification",
            category="feedback",
            props=[
                PropSchema("message", "string", required=True),
                PropSchema("severity", "string", enum=["info", "success", "warning", "error"]),
                PropSchema("duration", "number", default=5000),
                PropSchema("action", "object"),
            ],
            icon="bell"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.TOOLTIP,
            name="Tooltip",
            description="Hover tooltip",
            category="feedback",
            props=[
                PropSchema("content", "string", required=True),
                PropSchema("position", "string", enum=["top", "bottom", "left", "right"]),
            ],
            supports_children=True,
            icon="message-square"
        ))

        # =====================================================================
        # KOSMOS-Specific Components
        # =====================================================================

        self.register(ComponentDefinition(
            type=ComponentType.CHAT_BUBBLE,
            name="Chat Bubble",
            description="Chat message bubble",
            category="kosmos",
            props=[
                PropSchema("content", "string", required=True),
                PropSchema("role", "string", enum=["user", "assistant", "system", "tool"]),
                PropSchema("agent", "string"),
                PropSchema("timestamp", "string"),
                PropSchema("streaming", "boolean", default=False),
            ],
            supports_glass=True,
            icon="message-circle"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.AGENT_STATUS,
            name="Agent Status",
            description="Agent status indicator",
            category="kosmos",
            props=[
                PropSchema("agent_id", "string", required=True),
                PropSchema("agent_name", "string", required=True),
                PropSchema("status", "string", enum=["idle", "thinking", "acting", "waiting"]),
                PropSchema("current_action", "string"),
            ],
            supports_glass=True,
            icon="bot"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.TOOL_CARD,
            name="Tool Card",
            description="MCP Tool display",
            category="kosmos",
            props=[
                PropSchema("tool_name", "string", required=True),
                PropSchema("server", "string", required=True),
                PropSchema("description", "string"),
                PropSchema("category", "string"),
                PropSchema("call_count", "number"),
            ],
            supports_glass=True,
            icon="tool"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.WORKFLOW_STEP,
            name="Workflow Step",
            description="Workflow step indicator",
            category="kosmos",
            props=[
                PropSchema("title", "string", required=True),
                PropSchema("description", "string"),
                PropSchema("status", "string", enum=["pending", "active", "completed", "error", "skipped"]),
                PropSchema("agent", "string"),
                PropSchema("step_number", "number"),
            ],
            icon="git-commit"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.KANBAN,
            name="Kanban Board",
            description="Kanban board component",
            category="kosmos",
            props=[
                PropSchema("columns", "array", required=True, description="Column definitions with cards"),
                PropSchema("draggable", "boolean", default=True),
                PropSchema("column_width", "string", default="300px"),
            ],
            supports_glass=True,
            icon="columns"
        ))

        self.register(ComponentDefinition(
            type=ComponentType.CALENDAR,
            name="Calendar",
            description="Calendar component",
            category="kosmos",
            props=[
                PropSchema("events", "array", default=[]),
                PropSchema("view", "string", enum=["month", "week", "day", "agenda"]),
                PropSchema("date", "string"),
                PropSchema("selectable", "boolean", default=True),
            ],
            supports_glass=True,
            icon="calendar"
        ))

    def register(self, definition: ComponentDefinition) -> None:
        """Register a component definition."""
        self.components[definition.type] = definition
        self.logger.debug(f"Registered component: {definition.type.value}")

    def get(self, component_type: ComponentType) -> Optional[ComponentDefinition]:
        """Get a component definition by type."""
        return self.components.get(component_type)

    def list_all(self) -> List[ComponentDefinition]:
        """List all registered components."""
        return list(self.components.values())

    def list_by_category(self, category: str) -> List[ComponentDefinition]:
        """List components by category."""
        return [c for c in self.components.values() if c.category == category]

    def get_categories(self) -> List[str]:
        """Get all component categories."""
        return list(set(c.category for c in self.components.values()))

    def validate_component(self, component: SDUIComponent) -> List[str]:
        """
        Validate a component against its definition.

        Returns list of validation errors.
        """
        errors = []
        definition = self.get(component.type)

        if not definition:
            errors.append(f"Unknown component type: {component.type}")
            return errors

        # Check required props
        for prop in definition.props:
            if prop.required and prop.name not in component.props:
                errors.append(f"Missing required prop '{prop.name}' for {component.type.value}")

        # Check children support
        if component.children and not definition.supports_children:
            errors.append(f"Component {component.type.value} does not support children")

        return errors

    def to_dict(self) -> Dict[str, Any]:
        """Export registry as dictionary."""
        return {
            "components": {
                ct.value: d.to_dict()
                for ct, d in self.components.items()
            },
            "categories": self.get_categories()
        }
