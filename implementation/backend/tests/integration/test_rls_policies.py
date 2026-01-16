"""
Integration tests for Row-Level Security (RLS) policies.

Tests tenant isolation and cross-tenant access prevention.
"""

import pytest
from uuid import uuid4
from sqlalchemy import text

from core.database import get_db, set_tenant_context, TenantScopedSession


@pytest.mark.asyncio
async def test_tenant_isolation_users():
    """Test that users can only see their own tenant's users."""
    tenant1_id = str(uuid4())
    tenant2_id = str(uuid4())

    async with get_db() as session:
        # Create tenants
        await session.execute(
            text("""
                INSERT INTO core.tenants (id, name, slug, status)
                VALUES 
                    (:tenant1_id, 'Tenant 1', 'tenant-1', 'active'),
                    (:tenant2_id, 'Tenant 2', 'tenant-2', 'active')
            """),
            {"tenant1_id": tenant1_id, "tenant2_id": tenant2_id}
        )
        await session.commit()

        # Create users for tenant1
        await session.execute(
            text("""
                INSERT INTO core.users (id, tenant_id, email, name, role)
                VALUES 
                    (:user1_id, :tenant1_id, 'user1@tenant1.com', 'User 1', 'user'),
                    (:user2_id, :tenant1_id, 'user2@tenant1.com', 'User 2', 'user')
            """),
            {
                "user1_id": str(uuid4()),
                "user2_id": str(uuid4()),
                "tenant1_id": tenant1_id
            }
        )

        # Create user for tenant2
        await session.execute(
            text("""
                INSERT INTO core.users (id, tenant_id, email, name, role)
                VALUES (:user3_id, :tenant2_id, 'user3@tenant2.com', 'User 3', 'user')
            """),
            {
                "user3_id": str(uuid4()),
                "tenant2_id": tenant2_id
            }
        )
        await session.commit()

        # Set tenant1 context
        await set_tenant_context(session, tenant1_id)

        # Query users - should only see tenant1 users
        result = await session.execute(
            text("SELECT id, email FROM core.users")
        )
        users = result.fetchall()
        assert len(users) == 2
        assert all(user.email.endswith("@tenant1.com") for user in users)

        # Set tenant2 context
        await set_tenant_context(session, tenant2_id)

        # Query users - should only see tenant2 users
        result = await session.execute(
            text("SELECT id, email FROM core.users")
        )
        users = result.fetchall()
        assert len(users) == 1
        assert users[0].email.endswith("@tenant2.com")


@pytest.mark.asyncio
async def test_tenant_isolation_conversations():
    """Test that conversations are isolated by tenant."""
    tenant1_id = str(uuid4())
    tenant2_id = str(uuid4())

    async with get_db() as session:
        # Create tenants and users
        await session.execute(
            text("""
                INSERT INTO core.tenants (id, name, slug, status)
                VALUES 
                    (:tenant1_id, 'Tenant 1', 'tenant-1', 'active'),
                    (:tenant2_id, 'Tenant 2', 'tenant-2', 'active')
            """),
            {"tenant1_id": tenant1_id, "tenant2_id": tenant2_id}
        )

        user1_id = str(uuid4())
        user2_id = str(uuid4())

        await session.execute(
            text("""
                INSERT INTO core.users (id, tenant_id, email, name, role)
                VALUES 
                    (:user1_id, :tenant1_id, 'user1@tenant1.com', 'User 1', 'user'),
                    (:user2_id, :tenant2_id, 'user2@tenant2.com', 'User 2', 'user')
            """),
            {
                "user1_id": user1_id,
                "user2_id": user2_id,
                "tenant1_id": tenant1_id,
                "tenant2_id": tenant2_id
            }
        )
        await session.commit()

        # Create conversations
        conv1_id = str(uuid4())
        conv2_id = str(uuid4())

        await session.execute(
            text("""
                INSERT INTO core.conversations (id, tenant_id, user_id, title, status)
                VALUES 
                    (:conv1_id, :tenant1_id, :user1_id, 'Tenant 1 Conversation', 'active'),
                    (:conv2_id, :tenant2_id, :user2_id, 'Tenant 2 Conversation', 'active')
            """),
            {
                "conv1_id": conv1_id,
                "conv2_id": conv2_id,
                "tenant1_id": tenant1_id,
                "tenant2_id": tenant2_id,
                "user1_id": user1_id,
                "user2_id": user2_id
            }
        )
        await session.commit()

        # Set tenant1 context
        await set_tenant_context(session, tenant1_id)

        # Query conversations - should only see tenant1
        result = await session.execute(
            text("SELECT id, title FROM core.conversations")
        )
        conversations = result.fetchall()
        assert len(conversations) == 1
        assert conversations[0].title == "Tenant 1 Conversation"

        # Set tenant2 context
        await set_tenant_context(session, tenant2_id)

        # Query conversations - should only see tenant2
        result = await session.execute(
            text("SELECT id, title FROM core.conversations")
        )
        conversations = result.fetchall()
        assert len(conversations) == 1
        assert conversations[0].title == "Tenant 2 Conversation"


@pytest.mark.asyncio
async def test_tenant_isolation_messages():
    """Test that messages are isolated by tenant."""
    tenant1_id = str(uuid4())
    tenant2_id = str(uuid4())

    async with get_db() as session:
        # Create tenants, users, conversations
        await session.execute(
            text("""
                INSERT INTO core.tenants (id, name, slug, status)
                VALUES 
                    (:tenant1_id, 'Tenant 1', 'tenant-1', 'active'),
                    (:tenant2_id, 'Tenant 2', 'tenant-2', 'active')
            """),
            {"tenant1_id": tenant1_id, "tenant2_id": tenant2_id}
        )

        user1_id = str(uuid4())
        user2_id = str(uuid4())
        conv1_id = str(uuid4())
        conv2_id = str(uuid4())

        await session.execute(
            text("""
                INSERT INTO core.users (id, tenant_id, email, name, role)
                VALUES 
                    (:user1_id, :tenant1_id, 'user1@tenant1.com', 'User 1', 'user'),
                    (:user2_id, :tenant2_id, 'user2@tenant2.com', 'User 2', 'user')
            """),
            {
                "user1_id": user1_id,
                "user2_id": user2_id,
                "tenant1_id": tenant1_id,
                "tenant2_id": tenant2_id
            }
        )

        await session.execute(
            text("""
                INSERT INTO core.conversations (id, tenant_id, user_id, title, status)
                VALUES 
                    (:conv1_id, :tenant1_id, :user1_id, 'Conv 1', 'active'),
                    (:conv2_id, :tenant2_id, :user2_id, 'Conv 2', 'active')
            """),
            {
                "conv1_id": conv1_id,
                "conv2_id": conv2_id,
                "tenant1_id": tenant1_id,
                "tenant2_id": tenant2_id,
                "user1_id": user1_id,
                "user2_id": user2_id
            }
        )
        await session.commit()

        # Create messages
        msg1_id = str(uuid4())
        msg2_id = str(uuid4())

        await session.execute(
            text("""
                INSERT INTO core.messages (id, conversation_id, tenant_id, role, content)
                VALUES 
                    (:msg1_id, :conv1_id, :tenant1_id, 'user', 'Message from tenant 1'),
                    (:msg2_id, :conv2_id, :tenant2_id, 'user', 'Message from tenant 2')
            """),
            {
                "msg1_id": msg1_id,
                "msg2_id": msg2_id,
                "conv1_id": conv1_id,
                "conv2_id": conv2_id,
                "tenant1_id": tenant1_id,
                "tenant2_id": tenant2_id
            }
        )
        await session.commit()

        # Set tenant1 context
        await set_tenant_context(session, tenant1_id)

        # Query messages - should only see tenant1
        result = await session.execute(
            text("SELECT id, content FROM core.messages")
        )
        messages = result.fetchall()
        assert len(messages) == 1
        assert "tenant 1" in messages[0].content.lower()


@pytest.mark.asyncio
async def test_cross_tenant_access_prevention():
    """Test that users cannot access other tenant's data even with direct queries."""
    tenant1_id = str(uuid4())
    tenant2_id = str(uuid4())

    async with get_db() as session:
        # Create tenants
        await session.execute(
            text("""
                INSERT INTO core.tenants (id, name, slug, status)
                VALUES 
                    (:tenant1_id, 'Tenant 1', 'tenant-1', 'active'),
                    (:tenant2_id, 'Tenant 2', 'tenant-2', 'active')
            """),
            {"tenant1_id": tenant1_id, "tenant2_id": tenant2_id}
        )

        user1_id = str(uuid4())
        user2_id = str(uuid4())

        await session.execute(
            text("""
                INSERT INTO core.users (id, tenant_id, email, name, role)
                VALUES 
                    (:user1_id, :tenant1_id, 'user1@tenant1.com', 'User 1', 'user'),
                    (:user2_id, :tenant2_id, 'user2@tenant2.com', 'User 2', 'user')
            """),
            {
                "user1_id": user1_id,
                "user2_id": user2_id,
                "tenant1_id": tenant1_id,
                "tenant2_id": tenant2_id
            }
        )
        await session.commit()

        # Set tenant1 context
        await set_tenant_context(session, tenant1_id)

        # Try to access tenant2's user directly by ID - should return empty
        result = await session.execute(
            text("SELECT id, email FROM core.users WHERE id = :user2_id"),
            {"user2_id": user2_id}
        )
        users = result.fetchall()
        assert len(users) == 0  # RLS prevents access


@pytest.mark.asyncio
async def test_tenant_scoped_session():
    """Test TenantScopedSession wrapper."""
    tenant1_id = str(uuid4())

    async with get_db() as session:
        # Create tenant
        await session.execute(
            text("""
                INSERT INTO core.tenants (id, name, slug, status)
                VALUES (:tenant1_id, 'Tenant 1', 'tenant-1', 'active')
            """),
            {"tenant1_id": tenant1_id}
        )
        await session.commit()

    # Use TenantScopedSession
    async with get_db() as base_session:
        async with TenantScopedSession(base_session, tenant1_id) as scoped_session:
            # Verify tenant context is set
            result = await scoped_session.execute(
                text("SELECT current_setting('app.current_tenant', true)::uuid as tenant_id")
            )
            row = result.fetchone()
            assert str(row.tenant_id) == tenant1_id


@pytest.mark.asyncio
async def test_rls_policy_on_all_tables():
    """Test that RLS is enabled on all tenant-scoped tables."""
    async with get_db() as session:
        # Check RLS status on key tables
        tables = [
            "core.users",
            "core.conversations",
            "core.messages",
            "governance.proposals",
            "governance.votes",
            "knowledge.documents",
            "knowledge.chunks",
        ]

        for table in tables:
            result = await session.execute(
                text("""
                    SELECT relname, relrowsecurity
                    FROM pg_class
                    WHERE relname = :table_name
                    AND relnamespace = (
                        SELECT oid FROM pg_namespace WHERE nspname = :schema
                    )
                """),
                {
                    "table_name": table.split(".")[1],
                    "schema": table.split(".")[0]
                }
            )
            row = result.fetchone()
            if row:
                assert row.relrowsecurity is True, f"RLS not enabled on {table}"
