"""
KOSMOS V2.0 API Module

FastAPI routers for all KOSMOS endpoints.
"""

from api.routes.routing import router as routing_router
from api.routes.tools import router as tools_router
from api.routes.agents import router as agents_router

__all__ = ["routing_router", "tools_router", "agents_router"]
