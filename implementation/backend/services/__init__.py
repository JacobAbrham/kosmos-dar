"""
KOSMOS V2.0 Backend Services

Service layer for clean separation between API routes and business logic.
Provides testable, mockable interfaces for all core operations.
"""

# Base service layer
from services.base import BaseService, ServiceContext, get_service_context

# Core services
from services.agent_service import AgentService, get_agent_service
from services.chat_service import ChatService, get_chat_service
from services.workflow_service import WorkflowService, get_workflow_service

# Existing services
from services.embedding_service import EmbeddingService, get_embedding_service
from services.llm_service import LLMService, get_llm_service, LLMRequest, LLMResponse

__all__ = [
    # Base
    "BaseService",
    "ServiceContext",
    "get_service_context",
    # Core services
    "AgentService",
    "get_agent_service",
    "ChatService",
    "get_chat_service",
    "WorkflowService",
    "get_workflow_service",
    # Existing services
    "EmbeddingService",
    "get_embedding_service",
    "LLMService",
    "get_llm_service",
    "LLMRequest",
    "LLMResponse",
]
