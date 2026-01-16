"""
Database performance tests.

Tests connection pooling, query performance, and concurrent access.
"""

import pytest
import asyncio
import time
from uuid import uuid4
from sqlalchemy import text

from core.database import get_db, set_tenant_context, engine


@pytest.mark.asyncio
async def test_connection_pooling():
    """Test that connection pooling works correctly."""
    # Create multiple concurrent connections
    async def use_connection(conn_id: int):
        async with get_db() as session:
            result = await session.execute(text("SELECT :conn_id as id"), {"conn_id": conn_id})
            row = result.fetchone()
            return row.id

    # Create 50 concurrent connections
    tasks = [use_connection(i) for i in range(50)]
    results = await asyncio.gather(*tasks)

    assert len(results) == 50
    assert all(r == i for i, r in enumerate(results))


@pytest.mark.asyncio
async def test_connection_pool_under_load():
    """Test connection pool handles 100+ concurrent connections."""
    tenant_id = str(uuid4())

    async with get_db() as session:
        # Create tenant
        await session.execute(
            text("""
                INSERT INTO core.tenants (id, name, slug, status)
                VALUES (:tenant_id, 'Test Tenant', 'test-tenant', 'active')
            """),
            {"tenant_id": tenant_id}
        )
        await session.commit()

    async def create_user(user_num: int):
        async with get_db() as session:
            await set_tenant_context(session, tenant_id)
            await session.execute(
                text("""
                    INSERT INTO core.users (id, tenant_id, email, name, role)
                    VALUES (:user_id, :tenant_id, :email, :name, 'user')
                """),
                {
                    "user_id": str(uuid4()),
                    "tenant_id": tenant_id,
                    "email": f"user{user_num}@test.com",
                    "name": f"User {user_num}"
                }
            )
            await session.commit()

    # Create 100 concurrent user insertions
    start_time = time.perf_counter()
    tasks = [create_user(i) for i in range(100)]
    await asyncio.gather(*tasks)
    duration = time.perf_counter() - start_time

    # Should complete in reasonable time (< 10 seconds)
    assert duration < 10.0, f"100 concurrent inserts took {duration:.2f}s"

    # Verify all users were created
    async with get_db() as session:
        await set_tenant_context(session, tenant_id)
        result = await session.execute(
            text("SELECT COUNT(*) as count FROM core.users")
        )
        count = result.fetchone().count
        assert count == 100


@pytest.mark.asyncio
async def test_query_performance_indexes():
    """Test that indexes improve query performance."""
    tenant_id = str(uuid4())

    async with get_db() as session:
        # Create tenant and users
        await session.execute(
            text("""
                INSERT INTO core.tenants (id, name, slug, status)
                VALUES (:tenant_id, 'Test Tenant', 'test-tenant', 'active')
            """),
            {"tenant_id": tenant_id}
        )

        # Create 1000 users
        for i in range(1000):
            await session.execute(
                text("""
                    INSERT INTO core.users (id, tenant_id, email, name, role)
                    VALUES (:user_id, :tenant_id, :email, :name, 'user')
                """),
                {
                    "user_id": str(uuid4()),
                    "tenant_id": tenant_id,
                    "email": f"user{i}@test.com",
                    "name": f"User {i}"
                }
            )
        await session.commit()

        await set_tenant_context(session, tenant_id)

        # Query by email (indexed)
        start_time = time.perf_counter()
        result = await session.execute(
            text("SELECT id, email FROM core.users WHERE email = :email"),
            {"email": "user500@test.com"}
        )
        user = result.fetchone()
        indexed_duration = time.perf_counter() - start_time

        assert user is not None
        # Indexed query should be fast (< 100ms)
        assert indexed_duration < 0.1, f"Indexed query took {indexed_duration:.3f}s"


@pytest.mark.asyncio
async def test_concurrent_reads():
    """Test concurrent read operations."""
    tenant_id = str(uuid4())
    user_id = str(uuid4())

    async with get_db() as session:
        # Create tenant and user
        await session.execute(
            text("""
                INSERT INTO core.tenants (id, name, slug, status)
                VALUES (:tenant_id, 'Test Tenant', 'test-tenant', 'active')
            """),
            {"tenant_id": tenant_id}
        )

        await session.execute(
            text("""
                INSERT INTO core.users (id, tenant_id, email, name, role)
                VALUES (:user_id, :tenant_id, 'test@test.com', 'Test User', 'user')
            """),
            {
                "user_id": user_id,
                "tenant_id": tenant_id
            }
        )
        await session.commit()

    async def read_user():
        async with get_db() as session:
            await set_tenant_context(session, tenant_id)
            result = await session.execute(
                text("SELECT id, email FROM core.users WHERE id = :user_id"),
                {"user_id": user_id}
            )
            return result.fetchone()

    # 100 concurrent reads
    tasks = [read_user() for _ in range(100)]
    results = await asyncio.gather(*tasks)

    assert len(results) == 100
    assert all(r is not None for r in results)
    assert all(r.email == "test@test.com" for r in results)


@pytest.mark.asyncio
async def test_transaction_isolation():
    """Test transaction isolation between tenants."""
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

    # Create users concurrently for different tenants
    async def create_user_for_tenant(tenant_id: str, email: str):
        async with get_db() as session:
            await set_tenant_context(session, tenant_id)
            await session.execute(
                text("""
                    INSERT INTO core.users (id, tenant_id, email, name, role)
                    VALUES (:user_id, :tenant_id, :email, 'User', 'user')
                """),
                {
                    "user_id": str(uuid4()),
                    "tenant_id": tenant_id,
                    "email": email
                }
            )
            await session.commit()

    tasks = [
        create_user_for_tenant(tenant1_id, f"user{i}@tenant1.com")
        for i in range(50)
    ] + [
        create_user_for_tenant(tenant2_id, f"user{i}@tenant2.com")
        for i in range(50)
    ]

    await asyncio.gather(*tasks)

    # Verify isolation
    async with get_db() as session:
        await set_tenant_context(session, tenant1_id)
        result = await session.execute(
            text("SELECT COUNT(*) as count FROM core.users")
        )
        count1 = result.fetchone().count
        assert count1 == 50

        await set_tenant_context(session, tenant2_id)
        result = await session.execute(
            text("SELECT COUNT(*) as count FROM core.users")
        )
        count2 = result.fetchone().count
        assert count2 == 50


@pytest.mark.asyncio
async def test_connection_pool_size():
    """Test that connection pool size is configured correctly."""
    pool = engine.pool
    assert pool.size() <= 20, f"Pool size {pool.size()} exceeds configured max (20)"
    assert pool.overflow() <= 10, f"Pool overflow {pool.overflow()} exceeds configured max (10)"
