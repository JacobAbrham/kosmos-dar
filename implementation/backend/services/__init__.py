"""
KOSMOS V2.0 Backend Services

Shared services for embedding generation, caching, and other utilities.
"""

from services.embedding_service import EmbeddingService, get_embedding_service

__all__ = ["EmbeddingService", "get_embedding_service"]
