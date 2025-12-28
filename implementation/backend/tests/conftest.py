"""
KOSMOS V2.0 Test Configuration

Shared fixtures and configuration for all tests.
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta
from typing import Any, Dict, Generator, AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from pydantic import BaseModel

# Add implementation to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ============================================================================
# Pytest Configuration
# ============================================================================

def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "load: Load tests")
    config.addinivalue_line("markers", "slow: Slow running tests")
    config.addinivalue_line("markers", "agent: Agent-specific tests")
    config.addinivalue_line("markers", "core: Core module tests")
    config.addinivalue_line("markers", "api: API endpoint tests")


# ============================================================================
# Event Loop Fixture
# ============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Mock Configuration
# ============================================================================

@pytest.fixture
def mock_settings():
    """Mock application settings."""
    settings = MagicMock()
    settings.database_url = "postgresql://test:test@localhost:5432/kosmos_test"
    settings.redis_url = "redis://localhost:6379/0"
    settings.llm_provider = "anthropic"
    settings.llm_model = "claude-3-opus-20240229"
    settings.anthropic_api_key = "test-api-key"
    settings.openai_api_key = "test-openai-key"
    settings.environment = "test"
    settings.debug = True
    settings.log_level = "DEBUG"
    return settings


@pytest.fixture
def mock_llm():
    """Mock LLM client for testing."""
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value="Test LLM response")
    llm.chat = AsyncMock(return_value=MagicMock(content="Test chat response"))
    return llm


# ============================================================================
# Database Fixtures
# ============================================================================

@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def mock_db_pool():
    """Mock database connection pool."""
    pool = AsyncMock()
    pool.acquire = AsyncMock()
    pool.release = AsyncMock()
    return pool


# ============================================================================
# Cache Fixtures
# ============================================================================

@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=True)
    redis.exists = AsyncMock(return_value=False)
    redis.expire = AsyncMock(return_value=True)
    redis.hget = AsyncMock(return_value=None)
    redis.hset = AsyncMock(return_value=True)
    redis.hgetall = AsyncMock(return_value={})
    redis.publish = AsyncMock(return_value=1)
    redis.subscribe = AsyncMock()
    return redis


# ============================================================================
# Message Bus Fixtures
# ============================================================================

@pytest.fixture
def mock_agent_bus():
    """Mock agent message bus."""
    bus = AsyncMock()
    bus.publish = AsyncMock()
    bus.subscribe = AsyncMock()
    bus.request = AsyncMock()
    return bus


# ============================================================================
# Tool Registry Fixtures
# ============================================================================

@pytest.fixture
def mock_tool_registry():
    """Mock Global Tool Registry."""
    registry = MagicMock()
    registry.discover_tools = AsyncMock(return_value=[])
    registry.get_tool = MagicMock(return_value=None)
    registry.execute_tool = AsyncMock(return_value=MagicMock(
        success=True,
        result={"data": "test"},
        error=None
    ))
    registry.get_tools_for_category = MagicMock(return_value=[])
    registry.get_all_tools = MagicMock(return_value=[])
    return registry


@pytest.fixture
def sample_mcp_tool():
    """Sample MCP tool for testing."""
    return {
        "name": "test_tool",
        "description": "A test tool",
        "server": "test-server",
        "category": "test",
        "input_schema": {
            "type": "object",
            "properties": {
                "param1": {"type": "string"},
                "param2": {"type": "integer"}
            },
            "required": ["param1"]
        }
    }


# ============================================================================
# Circuit Breaker Fixtures
# ============================================================================

@pytest.fixture
def circuit_breaker_config():
    """Default circuit breaker configuration."""
    from core.circuit_breaker import CircuitBreakerConfig
    return CircuitBreakerConfig(
        failure_threshold=3,
        success_threshold=2,
        recovery_timeout=timedelta(seconds=10),
        half_open_max_calls=2
    )


@pytest.fixture
def mock_circuit_breaker():
    """Mock circuit breaker."""
    cb = MagicMock()
    cb.allow_request = MagicMock(return_value=True)
    cb.record_success = MagicMock()
    cb.record_failure = MagicMock()
    cb.state = "closed"
    return cb


# ============================================================================
# Semantic Router Fixtures
# ============================================================================

@pytest.fixture
def mock_semantic_router():
    """Mock semantic router."""
    router = AsyncMock()
    router.route = AsyncMock(return_value=MagicMock(
        intent="test_intent",
        confidence=0.95,
        agent="zeus",
        context={}
    ))
    router.add_intent = AsyncMock()
    router.get_intents = MagicMock(return_value=[])
    return router


@pytest.fixture
def sample_routing_context():
    """Sample routing context."""
    return {
        "user_id": str(uuid4()),
        "session_id": str(uuid4()),
        "tenant_id": "default",
        "history": [],
        "metadata": {}
    }


# ============================================================================
# Agent Fixtures
# ============================================================================

@pytest.fixture
def mock_agent_state():
    """Sample agent state for testing."""
    return {
        "messages": [],
        "phase": "planning",
        "context": {},
        "selected_tools": [],
        "pending_actions": [],
        "human_input_request": None,
        "human_input_response": None,
        "results": [],
        "errors": [],
        "metadata": {
            "agent_name": "test_agent",
            "session_id": str(uuid4()),
            "started_at": datetime.utcnow().isoformat()
        }
    }


@pytest.fixture
def mock_agent_context():
    """Sample agent context."""
    return {
        "user_id": str(uuid4()),
        "tenant_id": "default",
        "session_id": str(uuid4()),
        "conversation_id": str(uuid4()),
        "request_id": str(uuid4())
    }


# ============================================================================
# SDUI Fixtures
# ============================================================================

@pytest.fixture
def mock_sdui_controller():
    """Mock SDUI controller."""
    controller = AsyncMock()
    controller.render_component = AsyncMock(return_value={"type": "card", "props": {}})
    controller.render_layout = AsyncMock(return_value={"type": "dashboard", "children": []})
    return controller


@pytest.fixture
def sample_sdui_component():
    """Sample SDUI component."""
    return {
        "type": "glass_card",
        "props": {
            "title": "Test Card",
            "content": "Test content",
            "variant": "default"
        },
        "children": []
    }


# ============================================================================
# Enterprise Fixtures
# ============================================================================

@pytest.fixture
def mock_sso_manager():
    """Mock SSO manager."""
    sso = AsyncMock()
    sso.authenticate = AsyncMock(return_value={"user_id": str(uuid4()), "email": "test@example.com"})
    sso.validate_token = AsyncMock(return_value=True)
    return sso


@pytest.fixture
def mock_rbac_manager():
    """Mock RBAC manager."""
    rbac = MagicMock()
    rbac.check_permission = MagicMock(return_value=True)
    rbac.get_user_roles = MagicMock(return_value=["admin"])
    rbac.get_role_permissions = MagicMock(return_value=["*"])
    return rbac


@pytest.fixture
def mock_audit_manager():
    """Mock audit manager."""
    audit = AsyncMock()
    audit.log_event = AsyncMock()
    audit.query_events = AsyncMock(return_value=[])
    return audit


# ============================================================================
# Multi-tenancy Fixtures
# ============================================================================

@pytest.fixture
def sample_tenant():
    """Sample tenant data."""
    return {
        "id": str(uuid4()),
        "name": "Test Tenant",
        "slug": "test-tenant",
        "plan": "enterprise",
        "settings": {},
        "quotas": {
            "api_calls_per_day": 10000,
            "agents_per_month": 1000,
            "storage_gb": 100
        },
        "created_at": datetime.utcnow().isoformat()
    }


@pytest.fixture
def mock_tenant_registry():
    """Mock tenant registry."""
    registry = AsyncMock()
    registry.get_tenant = AsyncMock()
    registry.create_tenant = AsyncMock()
    registry.update_tenant = AsyncMock()
    registry.delete_tenant = AsyncMock()
    return registry


# ============================================================================
# Workflow Fixtures
# ============================================================================

@pytest.fixture
def sample_workflow():
    """Sample workflow definition."""
    return {
        "id": str(uuid4()),
        "name": "Test Workflow",
        "trigger": {"type": "manual"},
        "steps": [
            {"id": "step1", "action": "test_action", "params": {}},
            {"id": "step2", "action": "another_action", "params": {"depends_on": "step1"}}
        ],
        "created_at": datetime.utcnow().isoformat()
    }


@pytest.fixture
def mock_workflow_engine():
    """Mock workflow engine."""
    engine = AsyncMock()
    engine.execute_workflow = AsyncMock()
    engine.get_workflow_status = AsyncMock()
    engine.cancel_workflow = AsyncMock()
    return engine


# ============================================================================
# HTTP Client Fixtures
# ============================================================================

@pytest.fixture
def mock_http_client():
    """Mock HTTP client for API tests."""
    from unittest.mock import AsyncMock
    client = AsyncMock()
    client.get = AsyncMock()
    client.post = AsyncMock()
    client.put = AsyncMock()
    client.delete = AsyncMock()
    return client


# ============================================================================
# Test Data Generators
# ============================================================================

@pytest.fixture
def generate_uuid():
    """UUID generator for tests."""
    def _generate():
        return str(uuid4())
    return _generate


@pytest.fixture
def generate_timestamp():
    """Timestamp generator for tests."""
    def _generate(offset_days=0):
        return (datetime.utcnow() + timedelta(days=offset_days)).isoformat()
    return _generate


# ============================================================================
# Cleanup Fixtures
# ============================================================================

@pytest_asyncio.fixture(autouse=True)
async def cleanup_async_resources():
    """Clean up async resources after each test."""
    yield
    # Allow pending tasks to complete
    await asyncio.sleep(0)


# ============================================================================
# Performance Test Fixtures
# ============================================================================

@pytest.fixture
def performance_timer():
    """Timer for performance tests."""
    import time

    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None

        def start(self):
            self.start_time = time.perf_counter()

        def stop(self):
            self.end_time = time.perf_counter()

        @property
        def elapsed(self):
            if self.start_time is None or self.end_time is None:
                return None
            return self.end_time - self.start_time

        def assert_under(self, seconds):
            assert self.elapsed < seconds, f"Elapsed time {self.elapsed}s exceeded {seconds}s"

    return Timer()
