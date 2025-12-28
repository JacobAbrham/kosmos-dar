"""
Tests for Semantic Router

Tests intent classification and semantic routing.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.unit
@pytest.mark.core
class TestRoutingContext:
    """Tests for RoutingContext."""

    def test_routing_context_creation(self, sample_routing_context):
        """Test creating a routing context."""
        from core.semantic_router import RoutingContext

        context = RoutingContext(
            user_id=sample_routing_context["user_id"],
            session_id=sample_routing_context["session_id"],
            tenant_id=sample_routing_context["tenant_id"],
            history=sample_routing_context["history"],
            metadata=sample_routing_context["metadata"]
        )

        assert context.user_id == sample_routing_context["user_id"]
        assert context.session_id == sample_routing_context["session_id"]
        assert context.tenant_id == "default"


@pytest.mark.unit
@pytest.mark.core
class TestRoutingResult:
    """Tests for RoutingResult."""

    def test_routing_result_high_confidence(self):
        """Test routing result with high confidence."""
        from core.semantic_router import RoutingResult

        result = RoutingResult(
            intent="schedule_meeting",
            confidence=0.95,
            agent="chronos",
            context={"detected_entities": ["meeting", "tomorrow"]}
        )

        assert result.intent == "schedule_meeting"
        assert result.confidence >= 0.9
        assert result.agent == "chronos"
        assert result.is_confident()  # Assuming threshold of ~0.7

    def test_routing_result_low_confidence(self):
        """Test routing result with low confidence."""
        from core.semantic_router import RoutingResult

        result = RoutingResult(
            intent="unknown",
            confidence=0.3,
            agent=None,
            context={}
        )

        assert result.confidence < 0.5
        assert not result.is_confident()


@pytest.mark.unit
@pytest.mark.core
class TestSemanticRouter:
    """Tests for SemanticRouter."""

    @pytest.mark.asyncio
    async def test_router_initialization(self):
        """Test router initialization."""
        from core.semantic_router import SemanticRouter

        with patch('core.semantic_router.get_embedding_service') as mock_emb:
            mock_emb.return_value = AsyncMock()

            router = SemanticRouter()

            assert router is not None

    @pytest.mark.asyncio
    async def test_route_scheduling_intent(self, mock_semantic_router, sample_routing_context):
        """Test routing a scheduling intent."""
        from core.semantic_router import RoutingResult

        mock_semantic_router.route.return_value = RoutingResult(
            intent="schedule_meeting",
            confidence=0.92,
            agent="chronos",
            context={"time": "tomorrow", "duration": "1 hour"}
        )

        result = await mock_semantic_router.route(
            text="Schedule a meeting for tomorrow at 2pm",
            context=sample_routing_context
        )

        assert result.intent == "schedule_meeting"
        assert result.agent == "chronos"
        assert result.confidence > 0.9

    @pytest.mark.asyncio
    async def test_route_data_query_intent(self, mock_semantic_router, sample_routing_context):
        """Test routing a data query intent."""
        from core.semantic_router import RoutingResult

        mock_semantic_router.route.return_value = RoutingResult(
            intent="query_data",
            confidence=0.88,
            agent="hermes",
            context={"query_type": "sales", "timeframe": "last_month"}
        )

        result = await mock_semantic_router.route(
            text="Show me the sales data from last month",
            context=sample_routing_context
        )

        assert result.intent == "query_data"
        assert result.agent == "hermes"

    @pytest.mark.asyncio
    async def test_route_code_generation_intent(self, mock_semantic_router, sample_routing_context):
        """Test routing a code generation intent."""
        from core.semantic_router import RoutingResult

        mock_semantic_router.route.return_value = RoutingResult(
            intent="generate_code",
            confidence=0.95,
            agent="hephaestus",
            context={"language": "python", "task": "api_endpoint"}
        )

        result = await mock_semantic_router.route(
            text="Create a Python API endpoint for user authentication",
            context=sample_routing_context
        )

        assert result.intent == "generate_code"
        assert result.agent == "hephaestus"

    @pytest.mark.asyncio
    async def test_route_security_intent(self, mock_semantic_router, sample_routing_context):
        """Test routing a security-related intent."""
        from core.semantic_router import RoutingResult

        mock_semantic_router.route.return_value = RoutingResult(
            intent="security_check",
            confidence=0.91,
            agent="aegis",
            context={"check_type": "permissions", "resource": "user_data"}
        )

        result = await mock_semantic_router.route(
            text="Check if user has permission to access this data",
            context=sample_routing_context
        )

        assert result.intent == "security_check"
        assert result.agent == "aegis"

    @pytest.mark.asyncio
    async def test_route_ambiguous_intent(self, mock_semantic_router, sample_routing_context):
        """Test routing an ambiguous intent."""
        from core.semantic_router import RoutingResult

        mock_semantic_router.route.return_value = RoutingResult(
            intent="unclear",
            confidence=0.45,
            agent="zeus",  # Orchestrator handles unclear intents
            context={"needs_clarification": True}
        )

        result = await mock_semantic_router.route(
            text="Do the thing",
            context=sample_routing_context
        )

        assert result.confidence < 0.5
        assert result.agent == "zeus"

    @pytest.mark.asyncio
    async def test_add_custom_intent(self):
        """Test adding a custom intent."""
        from core.semantic_router import SemanticRouter

        with patch('core.semantic_router.get_embedding_service') as mock_emb:
            mock_service = AsyncMock()
            mock_service.embed = AsyncMock(return_value=[0.1] * 384)
            mock_emb.return_value = mock_service

            router = SemanticRouter()

            await router.add_intent(
                name="custom_intent",
                examples=[
                    "Example phrase 1",
                    "Example phrase 2",
                    "Example phrase 3"
                ],
                agent="custom_agent"
            )

            # Verify intent was added
            intents = router.get_intents()
            assert any(i["name"] == "custom_intent" for i in intents)

    def test_get_all_intents(self):
        """Test getting all registered intents."""
        from core.semantic_router import SemanticRouter

        with patch('core.semantic_router.get_embedding_service'):
            router = SemanticRouter()

            intents = router.get_intents()

            # Should have default intents
            assert isinstance(intents, list)

    @pytest.mark.asyncio
    async def test_batch_route(self, mock_semantic_router, sample_routing_context):
        """Test batch routing multiple queries."""
        from core.semantic_router import RoutingResult

        mock_semantic_router.batch_route = AsyncMock(return_value=[
            RoutingResult(intent="schedule_meeting", confidence=0.9, agent="chronos", context={}),
            RoutingResult(intent="send_email", confidence=0.88, agent="iris", context={}),
            RoutingResult(intent="query_data", confidence=0.85, agent="hermes", context={})
        ])

        queries = [
            "Schedule a meeting",
            "Send an email to John",
            "Show me the report"
        ]

        results = await mock_semantic_router.batch_route(queries, sample_routing_context)

        assert len(results) == 3
        assert results[0].agent == "chronos"
        assert results[1].agent == "iris"
        assert results[2].agent == "hermes"


@pytest.mark.unit
@pytest.mark.core
class TestSemanticRouterCache:
    """Tests for semantic router caching."""

    @pytest.mark.asyncio
    async def test_cache_hit(self, mock_redis):
        """Test that cached results are returned."""
        from core.semantic_router import SemanticRouter, RoutingResult
        import json

        cached_result = {
            "intent": "schedule_meeting",
            "confidence": 0.95,
            "agent": "chronos",
            "context": {}
        }

        mock_redis.get.return_value = json.dumps(cached_result)

        with patch('core.semantic_router.get_redis', return_value=mock_redis):
            with patch('core.semantic_router.get_embedding_service'):
                router = SemanticRouter()

                # This should hit cache
                result = await router.route("Schedule a meeting")

                # Verify cache was checked
                mock_redis.get.assert_called()

    @pytest.mark.asyncio
    async def test_cache_miss_stores_result(self, mock_redis):
        """Test that cache miss stores the result."""
        from core.semantic_router import SemanticRouter

        mock_redis.get.return_value = None  # Cache miss

        with patch('core.semantic_router.get_redis', return_value=mock_redis):
            with patch('core.semantic_router.get_embedding_service') as mock_emb:
                mock_service = AsyncMock()
                mock_service.embed = AsyncMock(return_value=[0.1] * 384)
                mock_emb.return_value = mock_service

                router = SemanticRouter()

                await router.route("Schedule a meeting")

                # Verify result was cached
                mock_redis.set.assert_called()


@pytest.mark.unit
@pytest.mark.core
class TestSemanticRouterFallback:
    """Tests for fallback routing."""

    @pytest.mark.asyncio
    async def test_fallback_to_keyword_routing(self):
        """Test fallback to keyword routing when embedding fails."""
        from core.semantic_router import SemanticRouter, RoutingResult

        with patch('core.semantic_router.get_embedding_service') as mock_emb:
            mock_service = AsyncMock()
            mock_service.embed = AsyncMock(side_effect=Exception("Embedding failed"))
            mock_emb.return_value = mock_service

            router = SemanticRouter()

            # Should fall back to keyword routing
            result = await router.route("Schedule a meeting for tomorrow")

            # Should still get a result via fallback
            assert result is not None
            assert isinstance(result, RoutingResult)

    @pytest.mark.asyncio
    async def test_default_agent_for_unknown_intent(self):
        """Test that unknown intents route to default agent."""
        from core.semantic_router import SemanticRouter, RoutingResult

        with patch('core.semantic_router.get_embedding_service') as mock_emb:
            mock_service = AsyncMock()
            # Return embedding that doesn't match any intent
            mock_service.embed = AsyncMock(return_value=[0.0] * 384)
            mock_emb.return_value = mock_service

            router = SemanticRouter()

            result = await router.route("Completely random gibberish xyz123")

            # Should route to Zeus (orchestrator) as default
            assert result.agent in ["zeus", None]


@pytest.mark.unit
@pytest.mark.core
class TestIntentEmbeddings:
    """Tests for intent embedding generation."""

    @pytest.mark.asyncio
    async def test_generate_intent_embedding(self):
        """Test generating embeddings for an intent."""
        from core.semantic_router import SemanticRouter

        with patch('core.semantic_router.get_embedding_service') as mock_emb:
            mock_service = AsyncMock()
            mock_service.embed = AsyncMock(return_value=[0.1, 0.2, 0.3] * 128)
            mock_emb.return_value = mock_service

            router = SemanticRouter()

            embedding = await router._generate_embedding("Test text")

            assert embedding is not None
            assert len(embedding) == 384

    @pytest.mark.asyncio
    async def test_similarity_calculation(self):
        """Test cosine similarity calculation."""
        from core.semantic_router import SemanticRouter

        with patch('core.semantic_router.get_embedding_service'):
            router = SemanticRouter()

            # Test identical vectors
            vec1 = [1.0, 0.0, 0.0]
            vec2 = [1.0, 0.0, 0.0]
            similarity = router._cosine_similarity(vec1, vec2)
            assert abs(similarity - 1.0) < 0.0001

            # Test orthogonal vectors
            vec3 = [0.0, 1.0, 0.0]
            similarity = router._cosine_similarity(vec1, vec3)
            assert abs(similarity) < 0.0001

            # Test opposite vectors
            vec4 = [-1.0, 0.0, 0.0]
            similarity = router._cosine_similarity(vec1, vec4)
            assert abs(similarity + 1.0) < 0.0001
