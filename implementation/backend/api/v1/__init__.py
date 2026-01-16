"""
KOSMOS V2.0 API v1 Module

Combines all API v1 routers into a single router.
"""

from fastapi import APIRouter

from api.routes.auth import router as auth_router
from api.routes.chat import router as chat_router
from api.routes.cost import router as cost_router
from api.routes.routing import router as routing_router
from api.routes.tools import router as tools_router
from api.routes.agents import router as agents_router
from api.routes.autonomous import router as autonomous_router
from api.routes.jobs import router as jobs_router

# Create main v1 router
router = APIRouter()

# Include all route modules
# Auth routes - prefix already set to /api/v1/auth in the router
router.include_router(auth_router)
router.include_router(chat_router)
router.include_router(cost_router)
router.include_router(routing_router)
router.include_router(tools_router)
router.include_router(agents_router)
router.include_router(autonomous_router)
router.include_router(jobs_router)

__all__ = ["router"]
