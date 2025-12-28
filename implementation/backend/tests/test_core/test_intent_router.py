"""
Tests for Intent Router

Tests agent routing based on intent classification.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.unit
@pytest.mark.core
class TestIntentResolution:
    """Tests for IntentResolution dataclass."""

    def test_intent_resolution_creation(self):
        """Test creating an intent resolution."""
        from core.intent_router import IntentResolution

        resolution = IntentResolution(
            primary_agent="chronos",
            supporting_agents=["athena", "memorix"],
            confidence=0.92,
            intent="schedule_meeting",
            context={"time": "tomorrow"}
        )

        assert resolution.primary_agent == "chronos"
        assert "athena" in resolution.supporting_agents
        assert resolution.confidence > 0.9

    def test_intent_resolution_single_agent(self):
        """Test resolution with single agent."""
        from core.intent_router import IntentResolution

        resolution = IntentResolution(
            primary_agent="hermes",
            supporting_agents=[],
            confidence=0.85,
            intent="query_data",
            context={}
        )

        assert len(resolution.supporting_agents) == 0
        assert resolution.primary_agent == "hermes"


@pytest.mark.unit
@pytest.mark.core
class TestIntentRouter:
    """Tests for IntentRouter."""

    def test_router_initialization(self):
        """Test router initialization."""
        from core.intent_router import IntentRouter

        router = IntentRouter()

        assert router is not None
        assert hasattr(router, 'resolve')

    def test_get_router_singleton(self):
        """Test that get_intent_router returns singleton."""
        from core.intent_router import get_intent_router

        router1 = get_intent_router()
        router2 = get_intent_router()

        assert router1 is router2

    @pytest.mark.asyncio
    async def test_resolve_scheduling_intent(self):
        """Test resolving scheduling intent to Chronos."""
        from core.intent_router import IntentRouter, IntentResolution
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="schedule_meeting",
            confidence=0.95,
            agent="chronos",
            context={}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "chronos"
        assert resolution.confidence > 0.9

    @pytest.mark.asyncio
    async def test_resolve_data_intent(self):
        """Test resolving data intent to Hermes."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="query_data",
            confidence=0.88,
            agent="hermes",
            context={"data_type": "sales"}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "hermes"

    @pytest.mark.asyncio
    async def test_resolve_security_intent(self):
        """Test resolving security intent to AEGIS."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="security_check",
            confidence=0.91,
            agent="aegis",
            context={}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "aegis"

    @pytest.mark.asyncio
    async def test_resolve_analytics_intent(self):
        """Test resolving analytics intent to Athena."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="analyze_data",
            confidence=0.87,
            agent="athena",
            context={}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "athena"

    @pytest.mark.asyncio
    async def test_resolve_code_generation_intent(self):
        """Test resolving code generation intent to Hephaestus."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="generate_code",
            confidence=0.93,
            agent="hephaestus",
            context={"language": "python"}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "hephaestus"

    @pytest.mark.asyncio
    async def test_resolve_communication_intent(self):
        """Test resolving communication intent to Iris."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="send_message",
            confidence=0.89,
            agent="iris",
            context={"channel": "email"}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "iris"

    @pytest.mark.asyncio
    async def test_resolve_memory_intent(self):
        """Test resolving memory intent to MEMORIX."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="recall_information",
            confidence=0.86,
            agent="memorix",
            context={}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "memorix"

    @pytest.mark.asyncio
    async def test_resolve_financial_intent(self):
        """Test resolving financial intent to Nur PROMETHEUS."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="financial_analysis",
            confidence=0.90,
            agent="nur_prometheus",
            context={}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "nur_prometheus"

    @pytest.mark.asyncio
    async def test_resolve_ops_intent(self):
        """Test resolving operations intent to Hestia."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="system_health_check",
            confidence=0.88,
            agent="hestia",
            context={}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "hestia"

    @pytest.mark.asyncio
    async def test_resolve_prediction_intent(self):
        """Test resolving prediction intent to Morpheus."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="forecast",
            confidence=0.85,
            agent="morpheus",
            context={"forecast_type": "sales"}
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "morpheus"

    @pytest.mark.asyncio
    async def test_resolve_complex_intent_with_supporting_agents(self):
        """Test resolving complex intent with multiple supporting agents."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        # Complex query that needs multiple agents
        routing_result = RoutingResult(
            intent="comprehensive_report",
            confidence=0.82,
            agent="zeus",  # Orchestrator for complex tasks
            context={
                "requires": ["data_query", "analysis", "visualization"]
            }
        )

        resolution = await router.resolve(routing_result)

        assert resolution.primary_agent == "zeus"
        # Should have supporting agents for data and analysis
        assert len(resolution.supporting_agents) > 0

    @pytest.mark.asyncio
    async def test_resolve_low_confidence_routes_to_zeus(self):
        """Test that low confidence routes to Zeus for clarification."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="unclear",
            confidence=0.35,
            agent=None,
            context={}
        )

        resolution = await router.resolve(routing_result)

        # Low confidence should route to Zeus
        assert resolution.primary_agent == "zeus"


@pytest.mark.unit
@pytest.mark.core
class TestIntentRouterMapping:
    """Tests for intent to agent mapping."""

    def test_get_agent_capabilities(self):
        """Test getting agent capabilities."""
        from core.intent_router import IntentRouter

        router = IntentRouter()

        capabilities = router.get_agent_capabilities("chronos")

        assert "scheduling" in capabilities or "calendar" in capabilities

    def test_get_all_agent_mappings(self):
        """Test getting all intent-agent mappings."""
        from core.intent_router import IntentRouter

        router = IntentRouter()

        mappings = router.get_all_mappings()

        assert isinstance(mappings, dict)
        assert len(mappings) > 0

    def test_add_custom_mapping(self):
        """Test adding custom intent-agent mapping."""
        from core.intent_router import IntentRouter

        router = IntentRouter()

        router.add_mapping(
            intent="custom_intent",
            agent="custom_agent",
            priority=1
        )

        # Verify mapping was added
        agent = router.get_agent_for_intent("custom_intent")
        assert agent == "custom_agent"

    def test_priority_based_routing(self):
        """Test that higher priority mappings take precedence."""
        from core.intent_router import IntentRouter

        router = IntentRouter()

        # Add two mappings for same intent with different priorities
        router.add_mapping("shared_intent", "low_priority_agent", priority=1)
        router.add_mapping("shared_intent", "high_priority_agent", priority=10)

        agent = router.get_agent_for_intent("shared_intent")

        assert agent == "high_priority_agent"


@pytest.mark.unit
@pytest.mark.core
class TestIntentRouterContext:
    """Tests for context-aware routing."""

    @pytest.mark.asyncio
    async def test_context_affects_routing(self):
        """Test that context affects routing decisions."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        # Same intent, different context
        result1 = RoutingResult(
            intent="send_message",
            confidence=0.9,
            agent="iris",
            context={"channel": "email", "urgent": False}
        )

        result2 = RoutingResult(
            intent="send_message",
            confidence=0.9,
            agent="iris",
            context={"channel": "slack", "urgent": True}
        )

        resolution1 = await router.resolve(result1)
        resolution2 = await router.resolve(result2)

        # Both should route to Iris but context is preserved
        assert resolution1.primary_agent == "iris"
        assert resolution2.primary_agent == "iris"

    @pytest.mark.asyncio
    async def test_user_preference_affects_routing(self):
        """Test that user preferences affect routing."""
        from core.intent_router import IntentRouter
        from core.semantic_router import RoutingResult

        router = IntentRouter()

        routing_result = RoutingResult(
            intent="analyze_data",
            confidence=0.85,
            agent="athena",
            context={
                "user_preferences": {
                    "preferred_visualization": "charts",
                    "detail_level": "summary"
                }
            }
        )

        resolution = await router.resolve(routing_result)

        # Preferences should be passed through
        assert resolution.context.get("user_preferences") is not None


@pytest.mark.unit
@pytest.mark.core
class TestIntentRouterValidation:
    """Tests for intent validation."""

    def test_validate_known_intent(self):
        """Test validating a known intent."""
        from core.intent_router import IntentRouter

        router = IntentRouter()

        is_valid = router.validate_intent("schedule_meeting")

        assert is_valid is True

    def test_validate_unknown_intent(self):
        """Test validating an unknown intent."""
        from core.intent_router import IntentRouter

        router = IntentRouter()

        is_valid = router.validate_intent("completely_unknown_intent_xyz")

        # Unknown intents should still be valid (route to Zeus)
        assert is_valid is True

    def test_validate_agent_availability(self):
        """Test validating agent availability."""
        from core.intent_router import IntentRouter

        router = IntentRouter()

        # Known agents should be available
        assert router.is_agent_available("zeus") is True
        assert router.is_agent_available("chronos") is True
        assert router.is_agent_available("hermes") is True

        # Unknown agent
        assert router.is_agent_available("nonexistent_agent") is False
