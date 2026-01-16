"""
Dependency Injection for KOSMOS V2.0

Provides FastAPI dependencies for services and core components.
"""

from typing import Optional

from fastapi import Request, Depends
from services.base import ServiceContext
from services.agent_service import get_agent_service, AgentService
from services.chat_service import get_chat_service, ChatService
from services.workflow_service import get_workflow_service, WorkflowService


def get_service_context_dep(request: Request) -> ServiceContext:
    """FastAPI dependency to get service context from request."""
    return ServiceContext.from_request(request)


def get_agent_service_dep() -> AgentService:
    """FastAPI dependency to get agent service."""
    # Note: This returns a coroutine, FastAPI will await it
    import asyncio
    return asyncio.create_task(get_agent_service())


# Simplified dependencies that work with FastAPI
async def get_agent_service_dependency() -> AgentService:
    """FastAPI dependency for agent service."""
    return await get_agent_service()


async def get_chat_service_dependency() -> ChatService:
    """FastAPI dependency for chat service."""
    return await get_chat_service()


async def get_workflow_service_dependency() -> WorkflowService:
    """FastAPI dependency for workflow service."""
    return await get_workflow_service()
