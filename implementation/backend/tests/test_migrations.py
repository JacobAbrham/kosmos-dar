"""
Tests for Alembic database migrations.

Tests migration up/down, RLS policies, and data integrity.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from alembic import command
from alembic.config import Config
import os

# Test database URL
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://kosmos:kosmos_test@localhost:5432/kosmos_test"
)


@pytest.fixture(scope="module")
def alembic_cfg():
    """Get Alembic configuration."""
    alembic_ini_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "alembic.ini"
    )
    cfg = Config(alembic_ini_path)
    cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL.replace("+asyncpg", ""))
    return cfg


@pytest.fixture(scope="module")
async def test_db():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL)
    yield engine
    await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.migration
async def test_migration_up(test_db, alembic_cfg):
    """Test migration upgrade."""
    # Run migrations
    command.upgrade(alembic_cfg, "head")
    
    # Verify schemas exist
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name IN ('core', 'agents', 'governance', 'knowledge', 'audit', 'mcp', 'workflows', 'routing')
            ORDER BY schema_name
        """))
        schemas = [row[0] for row in result.fetchall()]
        
        assert 'core' in schemas
        assert 'agents' in schemas
        assert 'governance' in schemas
        assert 'knowledge' in schemas
        assert 'audit' in schemas
        assert 'mcp' in schemas
        assert 'workflows' in schemas
        assert 'routing' in schemas


@pytest.mark.asyncio
@pytest.mark.migration
async def test_core_tables_exist(test_db):
    """Test that core tables exist."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'core'
            ORDER BY table_name
        """))
        tables = [row[0] for row in result.fetchall()]
        
        assert 'tenants' in tables
        assert 'users' in tables
        assert 'conversations' in tables
        assert 'messages' in tables


@pytest.mark.asyncio
@pytest.mark.migration
async def test_rls_policies_enabled(test_db):
    """Test that RLS is enabled on tenant-scoped tables."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT tablename, rowsecurity
            FROM pg_tables
            WHERE schemaname = 'core'
            AND tablename IN ('users', 'conversations', 'messages')
        """))
        
        for row in result.fetchall():
            assert row[1] is True, f"RLS not enabled on core.{row[0]}"


@pytest.mark.asyncio
@pytest.mark.migration
async def test_rls_policies_exist(test_db):
    """Test that RLS policies exist."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT policyname, tablename
            FROM pg_policies
            WHERE schemaname = 'core'
            AND tablename = 'users'
        """))
        
        policies = [row[0] for row in result.fetchall()]
        assert 'tenant_isolation_users' in policies


@pytest.mark.asyncio
@pytest.mark.migration
async def test_vector_extensions(test_db):
    """Test that pgvector extension is enabled."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT extname 
            FROM pg_extension 
            WHERE extname = 'vector'
        """))
        
        assert result.fetchone() is not None, "pgvector extension not enabled"


@pytest.mark.asyncio
@pytest.mark.migration
async def test_vector_indexes_exist(test_db):
    """Test that vector indexes exist."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'knowledge'
            AND indexname LIKE '%embedding%'
        """))
        
        indexes = [row[0] for row in result.fetchall()]
        assert len(indexes) > 0, "No vector indexes found"


@pytest.mark.asyncio
@pytest.mark.migration
async def test_agent_registry_seed_data(test_db):
    """Test that agent registry seed data exists."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT COUNT(*) 
            FROM agents.registry
        """))
        
        count = result.scalar()
        assert count >= 11, f"Expected at least 11 agents, found {count}"


@pytest.mark.asyncio
@pytest.mark.migration
async def test_functions_exist(test_db):
    """Test that database functions exist."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT routine_name 
            FROM information_schema.routines
            WHERE routine_schema = 'routing'
            AND routine_name IN ('find_similar_intents', 'log_decision', 'update_daily_metrics')
        """))
        
        functions = [row[0] for row in result.fetchall()]
        assert 'find_similar_intents' in functions
        assert 'log_decision' in functions
        assert 'update_daily_metrics' in functions


@pytest.mark.asyncio
@pytest.mark.migration
async def test_views_exist(test_db):
    """Test that views exist."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.views
            WHERE table_name IN ('v_active_workflows', 'v_agent_performance', 'v_tool_popularity')
        """))
        
        views = [row[0] for row in result.fetchall()]
        assert 'v_active_workflows' in views
        assert 'v_agent_performance' in views
        assert 'v_tool_popularity' in views


@pytest.mark.asyncio
@pytest.mark.migration
async def test_migration_down(test_db, alembic_cfg):
    """Test migration downgrade."""
    # Downgrade to base
    command.downgrade(alembic_cfg, "base")
    
    # Verify schemas are removed (except public)
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name IN ('core', 'agents', 'governance', 'knowledge', 'audit', 'mcp', 'workflows', 'routing')
        """))
        
        schemas = [row[0] for row in result.fetchall()]
        assert len(schemas) == 0, f"Schemas still exist after downgrade: {schemas}"
    
    # Upgrade again for other tests
    command.upgrade(alembic_cfg, "head")


@pytest.mark.asyncio
@pytest.mark.migration
async def test_foreign_key_constraints(test_db):
    """Test that foreign key constraints exist."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT
                tc.constraint_name,
                tc.table_schema,
                tc.table_name,
                kcu.column_name,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'core'
            AND tc.table_name = 'users'
        """))
        
        constraints = result.fetchall()
        assert len(constraints) > 0, "No foreign key constraints found on core.users"
        
        # Check users -> tenants FK
        tenant_fk = [c for c in constraints if c[4] == 'core' and c[5] == 'tenants']
        assert len(tenant_fk) > 0, "Foreign key to tenants table not found"


@pytest.mark.asyncio
@pytest.mark.migration
async def test_audit_immutability(test_db):
    """Test that audit table is immutable."""
    async with test_db.begin() as conn:
        # Try to update (should fail)
        try:
            await conn.execute(text("""
                UPDATE audit.events 
                SET event_type = 'test' 
                WHERE id = (SELECT id FROM audit.events LIMIT 1)
            """))
            assert False, "Audit table should be immutable"
        except Exception as e:
            assert "immutable" in str(e).lower() or "prevent_modification" in str(e).lower()


@pytest.mark.asyncio
@pytest.mark.migration
async def test_schema_migrations_table(test_db):
    """Test that schema_migrations table exists and has entries."""
    async with test_db.begin() as conn:
        result = await conn.execute(text("""
            SELECT version 
            FROM public.schema_migrations
            ORDER BY version
        """))
        
        versions = [row[0] for row in result.fetchall()]
        assert '001_initial_schema' in versions
        assert '002_mcp_workflows' in versions
        assert '003_audit_logging' in versions
        assert '010_intent_embeddings' in versions
        assert '011_workflow_checkpoints' in versions
