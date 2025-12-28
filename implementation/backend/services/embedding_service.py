"""
KOSMOS V2.0 Embedding Service

Provides embedding generation for semantic routing, RAG, and memory.
Supports multiple embedding providers with automatic fallback.
"""

import asyncio
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union
from functools import lru_cache
import json

import structlog
import numpy as np

logger = structlog.get_logger()


class EmbeddingProvider(str, Enum):
    """Supported embedding providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    COHERE = "cohere"
    HUGGINGFACE = "huggingface"


@dataclass
class EmbeddingConfig:
    """Configuration for embedding generation."""
    provider: EmbeddingProvider = EmbeddingProvider.OPENAI
    model: str = "text-embedding-3-small"
    dimensions: int = 768
    batch_size: int = 100
    max_retries: int = 3
    timeout_seconds: float = 30.0
    cache_ttl_hours: int = 24
    normalize: bool = True


@dataclass
class EmbeddingResult:
    """Result of an embedding operation."""
    embedding: List[float]
    model: str
    provider: str
    dimensions: int
    tokens_used: int = 0
    latency_ms: float = 0.0
    cached: bool = False


@dataclass
class BatchEmbeddingResult:
    """Result of a batch embedding operation."""
    embeddings: List[List[float]]
    model: str
    provider: str
    dimensions: int
    total_tokens: int = 0
    latency_ms: float = 0.0
    cached_count: int = 0


class EmbeddingCache:
    """
    LRU cache for embeddings with TTL support.

    Uses text hash as key to avoid storing full text.
    """

    def __init__(self, max_size: int = 10000, ttl_hours: int = 24):
        self._cache: Dict[str, Tuple[List[float], datetime]] = {}
        self._max_size = max_size
        self._ttl = timedelta(hours=ttl_hours)
        self._access_order: List[str] = []
        self._lock = asyncio.Lock()
        self.logger = logger.bind(component="EmbeddingCache")

        # Stats
        self.hits = 0
        self.misses = 0

    def _hash_text(self, text: str, model: str) -> str:
        """Create hash key from text and model."""
        content = f"{model}:{text}"
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    async def get(self, text: str, model: str) -> Optional[List[float]]:
        """Get embedding from cache if exists and not expired."""
        key = self._hash_text(text, model)

        async with self._lock:
            if key in self._cache:
                embedding, timestamp = self._cache[key]

                # Check TTL
                if datetime.utcnow() - timestamp < self._ttl:
                    self.hits += 1
                    # Update access order
                    if key in self._access_order:
                        self._access_order.remove(key)
                    self._access_order.append(key)
                    return embedding
                else:
                    # Expired
                    del self._cache[key]
                    if key in self._access_order:
                        self._access_order.remove(key)

            self.misses += 1
            return None

    async def set(self, text: str, model: str, embedding: List[float]) -> None:
        """Store embedding in cache."""
        key = self._hash_text(text, model)

        async with self._lock:
            # Evict if at capacity
            while len(self._cache) >= self._max_size:
                oldest = self._access_order.pop(0)
                if oldest in self._cache:
                    del self._cache[oldest]

            self._cache[key] = (embedding, datetime.utcnow())
            if key in self._access_order:
                self._access_order.remove(key)
            self._access_order.append(key)

    async def get_batch(
        self,
        texts: List[str],
        model: str
    ) -> Tuple[Dict[int, List[float]], List[int]]:
        """
        Get cached embeddings for batch of texts.

        Returns:
            Tuple of (cached embeddings by index, uncached indices)
        """
        cached = {}
        uncached = []

        for i, text in enumerate(texts):
            embedding = await self.get(text, model)
            if embedding is not None:
                cached[i] = embedding
            else:
                uncached.append(i)

        return cached, uncached

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total = self.hits + self.misses
        hit_rate = self.hits / total if total > 0 else 0
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate
        }

    async def clear(self) -> None:
        """Clear all cached embeddings."""
        async with self._lock:
            self._cache.clear()
            self._access_order.clear()
            self.logger.info("Embedding cache cleared")


class BaseEmbeddingClient(ABC):
    """Abstract base class for embedding clients."""

    @abstractmethod
    async def embed(self, text: str) -> EmbeddingResult:
        """Generate embedding for a single text."""
        pass

    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> BatchEmbeddingResult:
        """Generate embeddings for a batch of texts."""
        pass

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Return embedding dimensions."""
        pass


class OpenAIEmbeddingClient(BaseEmbeddingClient):
    """OpenAI embedding client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "text-embedding-3-small",
        dimensions: int = 768
    ):
        self.model = model
        self._dimensions = dimensions
        self._client = None
        self._api_key = api_key
        self.logger = logger.bind(client="OpenAI")

    async def _get_client(self):
        """Lazy load OpenAI client."""
        if self._client is None:
            try:
                from openai import AsyncOpenAI
                import os
                api_key = self._api_key or os.environ.get("OPENAI_API_KEY")
                self._client = AsyncOpenAI(api_key=api_key)
            except ImportError:
                raise ImportError("openai package required: pip install openai")
        return self._client

    @property
    def dimensions(self) -> int:
        return self._dimensions

    async def embed(self, text: str) -> EmbeddingResult:
        """Generate embedding using OpenAI."""
        import time
        start = time.perf_counter()

        client = await self._get_client()
        response = await client.embeddings.create(
            model=self.model,
            input=text,
            dimensions=self._dimensions
        )

        latency_ms = (time.perf_counter() - start) * 1000
        embedding = response.data[0].embedding

        return EmbeddingResult(
            embedding=embedding,
            model=self.model,
            provider="openai",
            dimensions=len(embedding),
            tokens_used=response.usage.total_tokens,
            latency_ms=latency_ms
        )

    async def embed_batch(self, texts: List[str]) -> BatchEmbeddingResult:
        """Generate embeddings for batch using OpenAI."""
        import time
        start = time.perf_counter()

        client = await self._get_client()
        response = await client.embeddings.create(
            model=self.model,
            input=texts,
            dimensions=self._dimensions
        )

        latency_ms = (time.perf_counter() - start) * 1000

        # Sort by index to maintain order
        sorted_data = sorted(response.data, key=lambda x: x.index)
        embeddings = [item.embedding for item in sorted_data]

        return BatchEmbeddingResult(
            embeddings=embeddings,
            model=self.model,
            provider="openai",
            dimensions=self._dimensions,
            total_tokens=response.usage.total_tokens,
            latency_ms=latency_ms
        )


class SentenceTransformerClient(BaseEmbeddingClient):
    """Local sentence-transformers client."""

    def __init__(self, model: str = "all-mpnet-base-v2"):
        self.model_name = model
        self._model = None
        self._dimensions = None
        self.logger = logger.bind(client="SentenceTransformers")

    def _get_model(self):
        """Lazy load sentence transformer model."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
                self._dimensions = self._model.get_sentence_embedding_dimension()
            except ImportError:
                # Keep KOSMOS runnable in constrained environments where installing
                # torch/sentence-transformers is impractical (very large wheels).
                # Fall back to a deterministic hash-based embedding.
                self._model = False  # sentinel meaning "hash fallback"
                self._dimensions = self._dimensions or 768
                self.logger.warning(
                    "sentence-transformers not installed; using deterministic hash embeddings",
                    model=self.model_name,
                    dimensions=self._dimensions,
                )
        return self._model

    @property
    def dimensions(self) -> int:
        if self._dimensions is None:
            self._get_model()
        return self._dimensions

    async def embed(self, text: str) -> EmbeddingResult:
        """Generate embedding using local model."""
        import time
        start = time.perf_counter()

        model = self._get_model()

        if model is False:
            # Deterministic pseudo-embedding: stable across runs, cheap to compute.
            seed_bytes = hashlib.sha256(f"{self.model_name}:{text}".encode("utf-8")).digest()[:8]
            seed = int.from_bytes(seed_bytes, "big", signed=False)
            rng = np.random.default_rng(seed)
            embedding_arr = rng.standard_normal(self._dimensions, dtype=np.float32)
            # Normalize to unit length for cosine similarity.
            norm = float(np.linalg.norm(embedding_arr)) or 1.0
            embedding = (embedding_arr / norm).astype(np.float32).tolist()
            latency_ms = (time.perf_counter() - start) * 1000
            return EmbeddingResult(
                embedding=embedding,
                model=self.model_name,
                provider="local_hash",
                dimensions=len(embedding),
                latency_ms=latency_ms,
            )

        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            None,
            lambda: model.encode(text, normalize_embeddings=True).tolist()
        )

        latency_ms = (time.perf_counter() - start) * 1000

        return EmbeddingResult(
            embedding=embedding,
            model=self.model_name,
            provider="sentence_transformers",
            dimensions=len(embedding),
            latency_ms=latency_ms
        )

    async def embed_batch(self, texts: List[str]) -> BatchEmbeddingResult:
        """Generate embeddings for batch using local model."""
        import time
        start = time.perf_counter()

        model = self._get_model()

        if model is False:
            embeddings: List[List[float]] = []
            for text in texts:
                seed_bytes = hashlib.sha256(f"{self.model_name}:{text}".encode("utf-8")).digest()[:8]
                seed = int.from_bytes(seed_bytes, "big", signed=False)
                rng = np.random.default_rng(seed)
                embedding_arr = rng.standard_normal(self._dimensions, dtype=np.float32)
                norm = float(np.linalg.norm(embedding_arr)) or 1.0
                embeddings.append((embedding_arr / norm).astype(np.float32).tolist())

            latency_ms = (time.perf_counter() - start) * 1000
            return BatchEmbeddingResult(
                embeddings=embeddings,
                model=self.model_name,
                provider="local_hash",
                dimensions=self._dimensions,
                latency_ms=latency_ms,
            )

        loop = asyncio.get_event_loop()
        embeddings_array = await loop.run_in_executor(
            None,
            lambda: model.encode(texts, normalize_embeddings=True)
        )

        embeddings = [e.tolist() for e in embeddings_array]
        latency_ms = (time.perf_counter() - start) * 1000

        return BatchEmbeddingResult(
            embeddings=embeddings,
            model=self.model_name,
            provider="sentence_transformers",
            dimensions=self.dimensions,
            latency_ms=latency_ms
        )


class EmbeddingService:
    """
    Central embedding service with caching and fallback support.

    Features:
    - Multiple provider support (OpenAI, local models)
    - Automatic caching with TTL
    - Batch processing for efficiency
    - Fallback to local model if API fails
    - Metrics and monitoring
    """

    _instance: Optional['EmbeddingService'] = None

    def __new__(cls) -> 'EmbeddingService':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.config = EmbeddingConfig()
        self.cache = EmbeddingCache(
            max_size=10000,
            ttl_hours=self.config.cache_ttl_hours
        )

        # Initialize clients
        self._clients: Dict[EmbeddingProvider, BaseEmbeddingClient] = {}
        self._primary_client: Optional[BaseEmbeddingClient] = None
        self._fallback_client: Optional[BaseEmbeddingClient] = None

        self.logger = logger.bind(component="EmbeddingService")

        # Metrics
        self._total_requests = 0
        self._total_tokens = 0
        self._total_latency_ms = 0.0
        self._errors = 0

        self._initialized = True

    async def initialize(
        self,
        provider: EmbeddingProvider = EmbeddingProvider.OPENAI,
        model: Optional[str] = None,
        dimensions: int = 768,
        enable_fallback: bool = True
    ) -> None:
        """Initialize the embedding service with specified provider."""
        self.config.provider = provider
        self.config.dimensions = dimensions

        if model:
            self.config.model = model

        # Set up primary client
        if provider == EmbeddingProvider.OPENAI:
            self._primary_client = OpenAIEmbeddingClient(
                model=self.config.model,
                dimensions=dimensions
            )
        elif provider == EmbeddingProvider.SENTENCE_TRANSFORMERS:
            model_name = model or "all-mpnet-base-v2"
            self._primary_client = SentenceTransformerClient(model=model_name)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        self._clients[provider] = self._primary_client

        # Set up fallback (local model)
        if enable_fallback and provider != EmbeddingProvider.SENTENCE_TRANSFORMERS:
            try:
                self._fallback_client = SentenceTransformerClient()
                self._clients[EmbeddingProvider.SENTENCE_TRANSFORMERS] = self._fallback_client
                self.logger.info("Fallback embedding client initialized")
            except Exception as e:
                self.logger.warning(f"Could not initialize fallback client: {e}")

        self.logger.info(
            "Embedding service initialized",
            provider=provider.value,
            model=self.config.model,
            dimensions=dimensions
        )

    async def embed(
        self,
        text: str,
        use_cache: bool = True
    ) -> EmbeddingResult:
        """
        Generate embedding for text.

        Args:
            text: Input text
            use_cache: Whether to use caching

        Returns:
            EmbeddingResult with embedding vector
        """
        self._total_requests += 1

        # Check cache first
        if use_cache:
            cached = await self.cache.get(text, self.config.model)
            if cached:
                return EmbeddingResult(
                    embedding=cached,
                    model=self.config.model,
                    provider=self.config.provider.value,
                    dimensions=len(cached),
                    cached=True
                )

        # Generate embedding
        try:
            result = await self._primary_client.embed(text)

            # Cache result
            if use_cache:
                await self.cache.set(text, self.config.model, result.embedding)

            # Update metrics
            self._total_tokens += result.tokens_used
            self._total_latency_ms += result.latency_ms

            return result

        except Exception as e:
            self._errors += 1
            self.logger.warning(f"Primary embedding failed: {e}")

            # Try fallback
            if self._fallback_client:
                try:
                    result = await self._fallback_client.embed(text)
                    if use_cache:
                        await self.cache.set(text, "fallback", result.embedding)
                    return result
                except Exception as e2:
                    self.logger.error(f"Fallback also failed: {e2}")

            raise

    async def embed_batch(
        self,
        texts: List[str],
        use_cache: bool = True,
        batch_size: Optional[int] = None
    ) -> BatchEmbeddingResult:
        """
        Generate embeddings for a batch of texts.

        Args:
            texts: List of input texts
            use_cache: Whether to use caching
            batch_size: Override batch size

        Returns:
            BatchEmbeddingResult with embeddings
        """
        if not texts:
            return BatchEmbeddingResult(
                embeddings=[],
                model=self.config.model,
                provider=self.config.provider.value,
                dimensions=self.config.dimensions
            )

        self._total_requests += 1
        actual_batch_size = batch_size or self.config.batch_size

        # Check cache for all texts
        cached_embeddings: Dict[int, List[float]] = {}
        uncached_indices: List[int] = []

        if use_cache:
            cached_embeddings, uncached_indices = await self.cache.get_batch(
                texts, self.config.model
            )
        else:
            uncached_indices = list(range(len(texts)))

        # Generate embeddings for uncached texts
        new_embeddings: Dict[int, List[float]] = {}

        if uncached_indices:
            uncached_texts = [texts[i] for i in uncached_indices]

            # Process in batches
            for batch_start in range(0, len(uncached_texts), actual_batch_size):
                batch_end = min(batch_start + actual_batch_size, len(uncached_texts))
                batch = uncached_texts[batch_start:batch_end]
                batch_indices = uncached_indices[batch_start:batch_end]

                try:
                    result = await self._primary_client.embed_batch(batch)

                    for i, idx in enumerate(batch_indices):
                        new_embeddings[idx] = result.embeddings[i]
                        if use_cache:
                            await self.cache.set(
                                texts[idx],
                                self.config.model,
                                result.embeddings[i]
                            )

                    self._total_tokens += result.total_tokens
                    self._total_latency_ms += result.latency_ms

                except Exception as e:
                    self._errors += 1
                    self.logger.warning(f"Batch embedding failed: {e}")

                    # Try fallback one by one
                    if self._fallback_client:
                        for i, idx in enumerate(batch_indices):
                            try:
                                fallback_result = await self._fallback_client.embed(batch[i])
                                new_embeddings[idx] = fallback_result.embedding
                            except Exception:
                                # Return zero vector as last resort
                                new_embeddings[idx] = [0.0] * self.config.dimensions
                    else:
                        raise

        # Combine cached and new embeddings in order
        all_embeddings = {}
        all_embeddings.update(cached_embeddings)
        all_embeddings.update(new_embeddings)

        final_embeddings = [all_embeddings[i] for i in range(len(texts))]

        return BatchEmbeddingResult(
            embeddings=final_embeddings,
            model=self.config.model,
            provider=self.config.provider.value,
            dimensions=self.config.dimensions,
            cached_count=len(cached_embeddings)
        )

    async def embed_for_search(
        self,
        query: str
    ) -> List[float]:
        """
        Generate embedding optimized for semantic search.

        Returns just the embedding vector for convenience.
        """
        result = await self.embed(query, use_cache=True)
        return result.embedding

    def cosine_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """Calculate cosine similarity between two embeddings."""
        a = np.array(embedding1)
        b = np.array(embedding2)

        if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
            return 0.0

        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    def find_most_similar(
        self,
        query_embedding: List[float],
        candidate_embeddings: List[List[float]],
        top_k: int = 5
    ) -> List[Tuple[int, float]]:
        """
        Find most similar embeddings to query.

        Returns:
            List of (index, similarity) tuples, sorted by similarity descending
        """
        similarities = [
            (i, self.cosine_similarity(query_embedding, emb))
            for i, emb in enumerate(candidate_embeddings)
        ]

        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]

    def get_metrics(self) -> Dict[str, Any]:
        """Get service metrics."""
        return {
            "total_requests": self._total_requests,
            "total_tokens": self._total_tokens,
            "total_latency_ms": self._total_latency_ms,
            "avg_latency_ms": (
                self._total_latency_ms / self._total_requests
                if self._total_requests > 0 else 0
            ),
            "errors": self._errors,
            "error_rate": (
                self._errors / self._total_requests
                if self._total_requests > 0 else 0
            ),
            "cache_stats": self.cache.get_stats(),
            "config": {
                "provider": self.config.provider.value,
                "model": self.config.model,
                "dimensions": self.config.dimensions
            }
        }

    async def clear_cache(self) -> None:
        """Clear embedding cache."""
        await self.cache.clear()


# Singleton accessor
_service: Optional[EmbeddingService] = None


async def get_embedding_service() -> EmbeddingService:
    """Get the global embedding service instance."""
    global _service
    if _service is None:
        _service = EmbeddingService()
        await _service.initialize()
    return _service
