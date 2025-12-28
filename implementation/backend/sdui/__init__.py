"""
KOSMOS V2.0 Server-Driven UI (SDUI) Module

Enables the backend to control frontend layout and components dynamically.
"""

from sdui.protocol import (
    SDUIMessage,
    SDUIComponent,
    SDUILayout,
    SDUIAction,
    SDUIEvent,
    ComponentType,
    LayoutType,
    ActionType,
)
from sdui.controller import SDUIController, get_sdui_controller
from sdui.layouts import LayoutEngine, LayoutTemplate
from sdui.components import ComponentRegistry, ComponentDefinition

__all__ = [
    "SDUIMessage",
    "SDUIComponent",
    "SDUILayout",
    "SDUIAction",
    "SDUIEvent",
    "ComponentType",
    "LayoutType",
    "ActionType",
    "SDUIController",
    "get_sdui_controller",
    "LayoutEngine",
    "LayoutTemplate",
    "ComponentRegistry",
    "ComponentDefinition",
]
