"""KOSMOS V2.0 API Routes."""

from api.routes.agents import router as agents_router
from api.routes.auth import router as auth_router
from api.routes.chat import router as chat_router
from api.routes.cost import router as cost_router
from api.routes.routing import router as routing_router
from api.routes.tools import router as tools_router

__all__ = [
    "agents_router",
    "auth_router",
    "chat_router",
    "cost_router",
    "routing_router",
    "tools_router",
]
